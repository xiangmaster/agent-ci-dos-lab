import { LogProcessor } from "./pipeline.js";
import type { DeepPartial, ProcessingContext, RawEvent, TidyConfig, TidyEvent } from "./types.js";

export function tidy(
  raw: RawEvent,
  config: DeepPartial<TidyConfig> = {},
  context: ProcessingContext = {},
): TidyEvent | null {
  return new LogProcessor(config, context).processEvent(raw).event;
}

export function parseNdjson(
  input: string,
  config: DeepPartial<TidyConfig> = {},
  context: ProcessingContext = {},
) {
  return new LogProcessor(config, context).processNdjson(input);
}

export { ConfigError, loadConfig, resolveConfig, validateConfig } from "./config.js";
export { DEFAULT_CONFIG, DEFAULT_SECRET_KEYS } from "./defaults.js";
export { flattenError } from "./error.js";
export { canonicalLevel } from "./level.js";
export { normalizeEvent } from "./normalize.js";
export { parseLine, splitNdjson } from "./parser.js";
export { LogProcessor } from "./pipeline.js";
export { redactEvent } from "./redaction.js";
export { shouldSample } from "./sampling.js";
export { serializeEvents } from "./serialize.js";
export { processNdjsonStream } from "./stream.js";
export { normalizeTimestamp, normalizeTimestampWithSource } from "./timestamp.js";
export type * from "./types.js";
