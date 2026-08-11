import type { Diagnostic, ParserConfig, RawEvent } from "./types.js";

export interface ParsedLine {
  event?: RawEvent;
  diagnostic?: Diagnostic;
}

/** UTF-8 BOM that some Windows editors prepend to text files. */
const BOM = "\uFEFF";

/**
 * Parse a single NDJSON line.
 *
 * Node.js 22 hardening:
 * - Strips a leading UTF-8 BOM so files written by Windows editors are
 *   accepted without a spurious INVALID_JSON diagnostic.
 * - Strips a trailing CR before the byte-length check so CRLF line endings
 *   do not inflate the budget by one byte per line.
 */
export function parseLine(raw: string, line: number, config: ParserConfig): ParsedLine {
  // Normalise: remove BOM and trailing carriage-return.
  let normalised = raw;
  if (normalised.startsWith(BOM)) normalised = normalised.slice(1);
  if (normalised.endsWith("\r")) normalised = normalised.slice(0, -1);

  if (Buffer.byteLength(normalised, "utf8") > config.maxLineBytes) {
    return { diagnostic: { line, code: "LINE_TOO_LARGE", message: `line exceeds ${config.maxLineBytes} bytes` } };
  }

  // Empty after normalisation — let the pipeline skipEmptyLines logic handle it;
  // returning no event and no diagnostic is safe here because parseLine is only
  // called after the empty-line guard in pipeline/stream.
  if (normalised.trim() === "") {
    return { diagnostic: { line, code: "INVALID_JSON", message: "empty line", raw } };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(normalised);
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

/**
 * Split an NDJSON string into individual lines.
 *
 * Handles both LF and CRLF line endings.  A leading BOM on the very first
 * character of the input is stripped so callers do not need to pre-process
 * the buffer.
 */
export function splitNdjson(input: string): string[] {
  const stripped = input.startsWith(BOM) ? input.slice(1) : input;
  return stripped.split(/\r?\n/);
}
