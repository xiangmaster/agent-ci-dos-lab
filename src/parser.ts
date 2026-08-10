import type { Diagnostic, ParserConfig, RawEvent } from "./types.js";

export interface ParsedLine {
  event?: RawEvent;
  diagnostic?: Diagnostic;
}

export function parseLine(raw: string, line: number, config: ParserConfig): ParsedLine {
  if (Buffer.byteLength(raw, "utf8") > config.maxLineBytes) {
    return { diagnostic: { line, code: "LINE_TOO_LARGE", message: `line exceeds ${config.maxLineBytes} bytes` } };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return {
      diagnostic: {
        line,
        code: "INVALID_JSON",
        message: error instanceof Error ? error.message : "invalid JSON",
        raw,
      },
    };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { diagnostic: { line, code: "NOT_OBJECT", message: "line is not a JSON object", raw } };
  }
  return { event: parsed as RawEvent };
}

export function splitNdjson(input: string): string[] {
  return input.split(/\r?\n/);
}
