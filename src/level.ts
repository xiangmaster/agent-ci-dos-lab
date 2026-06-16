type CanonicalLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

const map: Record<string, CanonicalLevel> = {
  trace: "trace",
  debug: "debug",
  info: "info",
  warn: "warn",
  warning: "warn",
  err: "error",
  error: "error",
  fatal: "fatal",
  crit: "fatal",
  critical: "fatal",
};

export function canonicalLevel(input: unknown): CanonicalLevel {
  if (typeof input !== "string") return "info";
  return map[input.toLowerCase()] ?? "info";
}
