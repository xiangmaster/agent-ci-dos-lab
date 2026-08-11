export interface TimestampResult {
  value: string;
  source: "input" | "fallback";
}

const ISO_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function assertIsoFormat(value: string): void {
  if (!ISO_REGEX.test(value)) {
    throw new TypeError(`Date.toISOString() produced an unexpected format: ${value}`);
  }
}

export function normalizeTimestamp(input: unknown, now: () => Date = () => new Date()): string {
  return normalizeTimestampWithSource(input, now).value;
}

export function normalizeTimestampWithSource(input: unknown, now: () => Date = () => new Date()): TimestampResult {
  const date = toDate(input);
  if (date) {
    const value = date.toISOString();
    assertIsoFormat(value);
    return { value, source: "input" };
  }
  const value = now().toISOString();
  assertIsoFormat(value);
  return { value, source: "fallback" };
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
