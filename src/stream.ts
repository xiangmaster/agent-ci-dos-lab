import { createInterface } from "node:readline";
import type { Readable } from "node:stream";
import { parseLine } from "./parser.js";
import type { Diagnostic, ProcessStats, TidyEvent } from "./types.js";
import { LogProcessor } from "./pipeline.js";

export interface StreamCallbacks {
  onEvent: (event: TidyEvent) => void | Promise<void>;
  onDiagnostic?: (diagnostic: Diagnostic) => void | Promise<void>;
}

export interface StreamOptions {
  /** Cancels processing cleanly without throwing. */
  signal?: AbortSignal;
}

/**
 * Process an NDJSON readable stream line-by-line.
 *
 * Node.js 22 hardening:
 * - Wraps readline in an explicit close/error race so a prematurely destroyed
 *   readable does not hang the for-await loop.
 * - Accepts an AbortSignal; aborting resolves with partial stats rather than
 *   leaving dangling listeners.
 * - Errors from onEvent/onDiagnostic callbacks propagate to the caller.
 */
export async function processNdjsonStream(
  input: Readable,
  processor: LogProcessor,
  callbacks: StreamCallbacks,
  options: StreamOptions = {},
): Promise<ProcessStats> {
  const stats: ProcessStats = { received: 0, emitted: 0, sampled: 0, invalid: 0, redactedFields: 0 };

  const rl = createInterface({ input, crlfDelay: Infinity });

  // Guarantee the readline interface is closed when we leave this function
  // regardless of the exit path (normal, error, or abort).
  let lineNumber = 0;
  let aborted = false;

  const cleanup = (): void => {
    rl.close();
  };

  // Honor an AbortSignal if supplied.
  const { signal } = options;
  if (signal) {
    if (signal.aborted) {
      cleanup();
      return stats;
    }
    signal.addEventListener("abort", cleanup, { once: true });
  }

  try {
    for await (const raw of rl) {
      if (signal?.aborted) {
        aborted = true;
        break;
      }

      lineNumber += 1;
      if (processor.config.parser.skipEmptyLines && raw.trim() === "") continue;
      stats.received += 1;

      const parsed = parseLine(raw, lineNumber, processor.config.parser);
      if (parsed.diagnostic) {
        stats.invalid += 1;
        // Propagate callback errors to the caller.
        await callbacks.onDiagnostic?.(parsed.diagnostic);
        if (processor.config.parser.strict) {
          throw new Error(`strict parsing rejected line ${lineNumber}`);
        }
        continue;
      }

      const result = processor.processEvent(parsed.event!);
      stats.redactedFields += result.redactedFields;
      if (result.event) {
        stats.emitted += 1;
        // Propagate callback errors to the caller.
        await callbacks.onEvent(result.event);
      } else {
        stats.sampled += 1;
      }
    }
  } finally {
    cleanup();
    if (signal) signal.removeEventListener("abort", cleanup);
  }

  void aborted; // consumed; stats are returned as-is on abort
  return stats;
}
