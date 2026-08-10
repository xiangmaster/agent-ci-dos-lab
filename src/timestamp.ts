export interface TimestampResult {
  value: string;
  source: "input" | "fallback";
}

export function normalizeTimestamp(input: unknown, now: () => Date = () => new Date()): string {
  return normalizeTimestampWithSource(input, now).value;
}

export function normalizeTimestampWithSource(input: unknown, now: () => Date = () => new Date()): TimestampResult {
  const date = toDate(input);
  if (date) return { value: date.toISOString(), source: "input" };
  return { value: now().toISOString(), source: "fallback" };
}

function toDate(input: unknown): Date | undefined {
  if (input instanceof Date && !Number.isNaN(input.valueOf())) return input;
  if (typeof input === "number" && Number.isFinite(input)) {
    const milliseconds = Math.abs(input) < 1e11 ? input * 1000 : input;
    const date = new Date(milliseconds);
    return Number.isNaN(date.valueOf()) ? undefined : date;
  }
  if (typeof input === "string" && input.trim() !== "") {
    const numeric = Number(input);
    if (Number.isFinite(numeric)) return toDate(numeric);
    const milliseconds = Date.parse(input);
    if (!Number.isNaN(milliseconds)) return new Date(milliseconds);
  }
  return undefined;
}
