import { normalizeTimestamp } from "./timestamp";
import { canonicalLevel } from "./level";
import { flattenError } from "./error";

export interface RawEvent {
  [key: string]: unknown;
}

export interface TidyEvent {
  ts: string;
  level: "trace" | "debug" | "info" | "warn" | "error" | "fatal";
  msg?: string;
  [key: string]: unknown;
}

export function tidy(raw: RawEvent): TidyEvent {
  const ts = normalizeTimestamp(raw.ts ?? raw.timestamp ?? raw.time);
  const level = canonicalLevel(raw.level ?? raw.lvl ?? raw.severity);
  const msg = (raw.msg ?? raw.message) as string | undefined;
  const out: TidyEvent = { ts, level };
  if (msg) out.msg = msg;
  if (raw.error) Object.assign(out, flattenError(raw.error));
  return out;
}
