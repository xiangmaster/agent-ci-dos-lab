import type { RedactionConfig } from "./types.js";

export interface RedactionResult<T> {
  value: T;
  redactedFields: number;
}

export function redactEvent<T extends Record<string, unknown>>(event: T, config: RedactionConfig): RedactionResult<T> {
  if (!config.enabled) return { value: structuredCloneSafe(event), redactedFields: 0 };

  const keys = new Set(config.keys.map((key) => key.toLowerCase()));
  const paths = config.paths.map((path) => path.toLowerCase().split("."));
  const seen = new WeakSet<object>();
  let redactedFields = 0;

  const visit = (value: unknown, path: string[], depth: number): unknown => {
    if (depth > config.maxDepth) return "[MAX_DEPTH]";
    if (!value || typeof value !== "object") return value;
    if (seen.has(value)) return "[CIRCULAR]";
    seen.add(value);

    if (Array.isArray(value)) return value.map((entry, index) => visit(entry, [...path, String(index)], depth + 1));

    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const nextPath = [...path, key.toLowerCase()];
      if (keys.has(key.toLowerCase()) || paths.some((pattern) => pathMatches(nextPath, pattern))) {
        output[key] = config.replacement;
        redactedFields += 1;
      } else {
        output[key] = visit(child, nextPath, depth + 1);
      }
    }
    return output;
  };

  return { value: visit(event, [], 0) as T, redactedFields };
}

function pathMatches(path: string[], pattern: string[]): boolean {
  if (path.length !== pattern.length) return false;
  return pattern.every((part, index) => part === "*" || part === path[index]);
}

function structuredCloneSafe<T>(value: T): T {
  try {
    return structuredClone(value);
  } catch {
    return value;
  }
}
