import { flattenError } from "./error.js";
import { extractFields } from "./fields.js";
import { canonicalLevel } from "./level.js";
import { normalizeTimestamp } from "./timestamp.js";
import type { ProcessingContext, RawEvent, TidyConfig, TidyEvent } from "./types.js";

export function normalizeEvent(raw: RawEvent, config: TidyConfig, context: ProcessingContext = {}): TidyEvent {
  const extracted = extractFields(raw, config.fields);
  const output: TidyEvent = {
    ts: normalizeTimestamp(extracted.timestamp, context.now),
    level: canonicalLevel(extracted.level),
  };

  if (typeof extracted.message === "string" && extracted.message.trim()) output.msg = extracted.message;
  if (extracted.error !== undefined) Object.assign(output, flattenError(extracted.error));

  for (const [key, value] of Object.entries(raw)) {
    if (!extracted.consumed.has(key) && key !== "error") output[key] = value;
  }
  return output;
}
