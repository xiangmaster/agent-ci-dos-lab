import { createInterface } from "node:readline";
import type { Readable } from "node:stream";
import { parseLine } from "./parser.js";
import type { Diagnostic, ProcessStats, TidyEvent } from "./types.js";
import { LogProcessor } from "./pipeline.js";

export interface StreamCallbacks {
  onEvent: (event: TidyEvent) => void | Promise<void>;
  onDiagnostic?: (diagnostic: Diagnostic) => void | Promise<void>;
}

export async function processNdjsonStream(
  input: Readable,
  processor: LogProcessor,
  callbacks: StreamCallbacks,
): Promise<ProcessStats> {
  const stats: ProcessStats = { received: 0, emitted: 0, sampled: 0, invalid: 0, redactedFields: 0 };
  
  // Capture stream errors so they surface as thrown errors rather than unhandled events
  let streamErrorReject: ((error: Error) => void) | undefined;
  const streamErrorPromise = new Promise<never>((_, reject) => {
    streamErrorReject = reject;
  });
  
  const onStreamError = (error: Error) => {
    streamErrorReject?.(error);
  };
  
  input.once("error", onStreamError);
  
  // crlfDelay: Infinity prevents readline from splitting \r\n pairs across chunks
  const lines = createInterface({ 
    input, 
    crlfDelay: Infinity,
    terminal: false, // Prevent TTY auto-detection in CI environments
  });
  let lineNumber = 0;

  try {
    await Promise.race([
      (async () => {
        for await (const raw of lines) {
          lineNumber += 1;
          if (processor.config.parser.skipEmptyLines && raw.trim() === "") continue;
          stats.received += 1;
          const parsed = parseLine(raw, lineNumber, processor.config.parser);
          if (parsed.diagnostic) {
            stats.invalid += 1;
            await callbacks.onDiagnostic?.(parsed.diagnostic);
            if (processor.config.parser.strict) throw new Error(`strict parsing rejected line ${lineNumber}`);
            continue;
          }

          const result = processor.processEvent(parsed.event!);
          stats.redactedFields += result.redactedFields;
          if (result.event) {
            stats.emitted += 1;
            await callbacks.onEvent(result.event);
          } else {
            stats.sampled += 1;
          }
        }
      })(),
      streamErrorPromise,
    ]);
  } finally {
    // Ensure readline interface is always closed, even if onEvent throws
    input.removeListener("error", onStreamError);
    lines.close();
  }
  
  return stats;
}
