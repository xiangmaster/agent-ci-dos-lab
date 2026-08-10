export type CanonicalLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

export type OutputFormat = "ndjson" | "json" | "pretty";

export interface RawEvent {
  [key: string]: unknown;
}

export interface TidyEvent {
  ts: string;
  level: CanonicalLevel;
  msg?: string;
  [key: string]: unknown;
}

export interface RedactionConfig {
  enabled: boolean;
  keys: string[];
  paths: string[];
  replacement: string;
  maxDepth: number;
}

export interface SamplingConfig {
  traceRate: number;
  debugRate: number;
  seed: string;
}

export interface ParserConfig {
  maxLineBytes: number;
  skipEmptyLines: boolean;
  strict: boolean;
}

export interface FieldConfig {
  timestamp: string[];
  level: string[];
  message: string[];
  error: string[];
}

export interface TidyConfig {
  redaction: RedactionConfig;
  sampling: SamplingConfig;
  parser: ParserConfig;
  fields: FieldConfig;
  output: OutputFormat;
}

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends Array<infer U>
    ? U[]
    : T[P] extends object
      ? DeepPartial<T[P]>
      : T[P];
};

export interface Diagnostic {
  line: number;
  code: "INVALID_JSON" | "NOT_OBJECT" | "LINE_TOO_LARGE" | "PROCESSING_ERROR";
  message: string;
  raw?: string;
}

export interface ProcessStats {
  received: number;
  emitted: number;
  sampled: number;
  invalid: number;
  redactedFields: number;
}

export interface ProcessResult {
  events: TidyEvent[];
  diagnostics: Diagnostic[];
  stats: ProcessStats;
}

export interface ProcessingContext {
  now?: () => Date;
}
