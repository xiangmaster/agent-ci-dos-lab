import { resolveConfig } from "./config.js";
import { normalizeEvent } from "./normalize.js";
import { parseLine, splitNdjson } from "./parser.js";
import { redactEvent } from "./redaction.js";
import { shouldSample } from "./sampling.js";
import type {
  DeepPartial,
  Diagnostic,
  ProcessResult,
  ProcessStats,
  ProcessingContext,
  RawEvent,
  TidyConfig,
  TidyEvent,
} from "./types.js";

export class LogProcessor {
  readonly config: TidyConfig;
  private readonly context: ProcessingContext;

  constructor(config: DeepPartial<TidyConfig> = {}, context: ProcessingContext = {}) {
    this.config = resolveConfig(config);
    this.context = context;
  }

  processEvent(raw: RawEvent): { event: TidyEvent | null; redactedFields: number } {
    const normalized = normalizeEvent(raw, this.config, this.context);
    const redacted = redactEvent(normalized, this.config.redaction);
    return {
      event: shouldSample(redacted.value, this.config.sampling) ? redacted.value : null,
      redactedFields: redacted.redactedFields,
    };
  }

  processNdjson(input: string): ProcessResult {
    const events: TidyEvent[] = [];
    const diagnostics: Diagnostic[] = [];
    const stats = emptyStats();

    splitNdjson(input).forEach((raw, index) => {
      if (this.config.parser.skipEmptyLines && raw.trim() === "") return;
      stats.received += 1;
      const parsed = parseLine(raw, index + 1, this.config.parser);
      if (parsed.diagnostic) {
        diagnostics.push(parsed.diagnostic);
        stats.invalid += 1;
        return;
      }

      try {
        const result = this.processEvent(parsed.event!);
        stats.redactedFields += result.redactedFields;
        if (result.event) {
          events.push(result.event);
          stats.emitted += 1;
        } else {
          stats.sampled += 1;
        }
      } catch (error) {
        diagnostics.push({
          line: index + 1,
          code: "PROCESSING_ERROR",
          message: error instanceof Error ? error.message : String(error),
        });
        stats.invalid += 1;
      }
    });

    if (this.config.parser.strict && diagnostics.length > 0) {
      throw new Error(`strict parsing rejected ${diagnostics.length} invalid line(s)`);
    }
    return { events, diagnostics, stats };
  }
}

function emptyStats(): ProcessStats {
  return { received: 0, emitted: 0, sampled: 0, invalid: 0, redactedFields: 0 };
}
