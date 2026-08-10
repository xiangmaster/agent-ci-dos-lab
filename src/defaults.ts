import type { TidyConfig } from "./types.js";

export const DEFAULT_SECRET_KEYS = [
  "authorization",
  "password",
  "passwd",
  "secret",
  "token",
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
    paths: ["headers.authorization", "request.headers.cookie", "*.credentials.*"],
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
