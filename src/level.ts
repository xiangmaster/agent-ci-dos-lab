import type { CanonicalLevel } from "./types.js";

const aliases: Record<string, CanonicalLevel> = {
  trace: "trace",
  verbose: "debug",
  debug: "debug",
  info: "info",
  information: "info",
  notice: "info",
  warn: "warn",
  warning: "warn",
  err: "error",
  error: "error",
  crit: "fatal",
  critical: "fatal",
  fatal: "fatal",
  emerg: "fatal",
  emergency: "fatal",
};

export function canonicalLevel(input: unknown): CanonicalLevel {
  if (typeof input === "number" && Number.isFinite(input)) return numericLevel(input);
  if (typeof input !== "string") return "info";
  return aliases[input.trim().toLowerCase()] ?? numericStringLevel(input) ?? "info";
}

function numericStringLevel(input: string): CanonicalLevel | undefined {
  const value = Number(input);
  return Number.isFinite(value) ? numericLevel(value) : undefined;
}

function numericLevel(value: number): CanonicalLevel {
  if (value <= 10) return "trace";
  if (value <= 20) return "debug";
  if (value <= 30) return "info";
  if (value <= 40) return "warn";
  if (value <= 50) return "error";
  return "fatal";
}
