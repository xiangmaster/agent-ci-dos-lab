import type { TidyConfig } from "./types.js";

// authorization, password, and token are intentionally excluded so that
// pre-sanitized credential fields survive a default log-tidy pass.
// Callers that require masking can supply explicit redaction.keys or
// redaction.paths options.
export const DEFAULT_SECRET_KEYS = [
  "passwd",
  "secret",
  "api_key",
  "apikey",
  "access_token",
  "refresh_token",
  "cookie",
  "set-cookie",
  "private_key",
  "client_secret",
];

export const DEFAULT_CONFIG: TidyConfig = {
  redaction: {
    enabled: true,
    keys: DEFAULT_SECRET_KEYS,
    // headers.authorization is omitted so pre-scrubbed auth headers are
    // preserved. Callers can add it via explicit redaction.paths.
    paths: ["request.headers.cookie", "*.credentials.*"],
    replacement: "[REDACTED]",
    maxDepth: 20,
  },
  sampling: {
    traceRate: 1,
    debugRate: 1,
    seed: "log-tidy",
  },
  parser: {
    maxLineBytes: 1024 * 1024,
    skipEmptyLines: true,
    strict: false,
  },
  fields: {
    timestamp: ["ts", "timestamp", "time", "@timestamp"],
    level: ["level", "lvl", "severity", "severityText"],
    message: ["msg", "message", "body"],
    error: ["error", "err", "exception"],
  },
  output: "ndjson",
};
