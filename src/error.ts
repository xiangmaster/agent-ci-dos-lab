const ERROR_FIELDS = ["name", "message", "stack", "code"] as const;

export function flattenError(input: unknown, prefix = "error", maxCauseDepth = 3): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  let current = asRecord(input);
  let currentPrefix = prefix;
  let depth = 0;

  while (current && depth <= maxCauseDepth) {
    for (const field of ERROR_FIELDS) {
      const value = current[field];
      if (typeof value === "string" || typeof value === "number") {
        const target = field === "name" ? "kind" : field;
        output[`${currentPrefix}.${target}`] = value;
      }
    }
    current = asRecord(current.cause);
    currentPrefix = `${currentPrefix}.cause`;
    depth += 1;
  }

  return output;
}

function asRecord(input: unknown): Record<string, unknown> | undefined {
  return input && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : undefined;
}
