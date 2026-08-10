import type { FieldConfig, RawEvent } from "./types.js";

export interface ExtractedFields {
  timestamp: unknown;
  level: unknown;
  message: unknown;
  error: unknown;
  consumed: Set<string>;
}

export function extractFields(event: RawEvent, fields: FieldConfig): ExtractedFields {
  const consumed = new Set<string>();
  return {
    timestamp: firstValue(event, fields.timestamp, consumed),
    level: firstValue(event, fields.level, consumed),
    message: firstValue(event, fields.message, consumed),
    error: firstValue(event, fields.error, consumed),
    consumed,
  };
}

function firstValue(event: RawEvent, aliases: string[], consumed: Set<string>): unknown {
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(event, alias)) {
      consumed.add(alias);
      return event[alias];
    }
  }
  return undefined;
}
