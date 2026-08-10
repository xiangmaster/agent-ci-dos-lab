import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { DEFAULT_CONFIG } from "./defaults.js";
import type { DeepPartial, OutputFormat, TidyConfig } from "./types.js";

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export function resolveConfig(input: DeepPartial<TidyConfig> = {}): TidyConfig {
  const config: TidyConfig = {
    redaction: { ...DEFAULT_CONFIG.redaction, ...input.redaction },
    sampling: { ...DEFAULT_CONFIG.sampling, ...input.sampling },
    parser: { ...DEFAULT_CONFIG.parser, ...input.parser },
    fields: { ...DEFAULT_CONFIG.fields, ...input.fields },
    output: input.output ?? DEFAULT_CONFIG.output,
  };

  validateConfig(config);
  return config;
}

export async function loadConfig(path: string): Promise<TidyConfig> {
  let text: string;
  try {
    text = await readFile(resolve(path), "utf8");
  } catch (error) {
    throw new ConfigError(`cannot read config ${path}: ${errorMessage(error)}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new ConfigError(`invalid JSON in config ${path}: ${errorMessage(error)}`);
  }

  if (!isRecord(parsed)) throw new ConfigError("config must be a JSON object");
  return resolveConfig(parsed as DeepPartial<TidyConfig>);
}

export function validateConfig(config: TidyConfig): void {
  validateRate("sampling.traceRate", config.sampling.traceRate);
  validateRate("sampling.debugRate", config.sampling.debugRate);

  if (!Number.isInteger(config.parser.maxLineBytes) || config.parser.maxLineBytes < 64) {
    throw new ConfigError("parser.maxLineBytes must be an integer greater than or equal to 64");
  }
  if (!Number.isInteger(config.redaction.maxDepth) || config.redaction.maxDepth < 1) {
    throw new ConfigError("redaction.maxDepth must be a positive integer");
  }
  if (!config.redaction.replacement) throw new ConfigError("redaction.replacement cannot be empty");
  validateStringList("redaction.keys", config.redaction.keys, false);
  validateStringList("redaction.paths", config.redaction.paths, false);
  validateStringList("fields.timestamp", config.fields.timestamp, true);
  validateStringList("fields.level", config.fields.level, true);
  validateStringList("fields.message", config.fields.message, true);
  validateStringList("fields.error", config.fields.error, true);

  const formats: OutputFormat[] = ["ndjson", "json", "pretty"];
  if (!formats.includes(config.output)) throw new ConfigError(`unsupported output format: ${config.output}`);
}

function validateRate(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new ConfigError(`${name} must be between 0 and 1`);
  }
}

function validateStringList(name: string, values: string[], requireValue: boolean): void {
  if (!Array.isArray(values) || (requireValue && values.length === 0)) {
    throw new ConfigError(`${name} must be ${requireValue ? "a non-empty" : "an"} array`);
  }
  if (values.some((value) => typeof value !== "string" || value.trim() === "")) {
    throw new ConfigError(`${name} must contain non-empty strings`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
