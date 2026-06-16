export function flattenError(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object") return {};
  const e = input as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  if (typeof e.message === "string") out["error.message"] = e.message;
  if (typeof e.name === "string") out["error.kind"] = e.name;
  if (typeof e.stack === "string") out["error.stack"] = e.stack;
  return out;
}
