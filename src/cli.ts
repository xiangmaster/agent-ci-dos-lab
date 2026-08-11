#!/usr/bin/env node

import { createWriteStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { stdin, stderr, stdout } from "node:process";
import { loadConfig, resolveConfig } from "./config.js";
import { LogProcessor } from "./pipeline.js";
import { serializeEvents } from "./serialize.js";
import type { DeepPartial, OutputFormat, TidyConfig } from "./types.js";

const VERSION = "1.0.0";

interface CliOptions {
  input?: string;
  output?: string;
  config?: string;
  format?: OutputFormat;
  strict?: boolean;
  stats: boolean;
  help: boolean;
  version: boolean;
}

async function main(): Promise<void> {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    stdout.write(helpText());
    return;
  }
  if (options.version) {
    stdout.write(`${VERSION}\n`);
    return;
  }

  const fileConfig = options.config ? await loadConfig(options.config) : resolveConfig();
  const overrides: DeepPartial<TidyConfig> = {};
  if (options.format) overrides.output = options.format;
  if (options.strict !== undefined) overrides.parser = { strict: options.strict };
  const config = resolveConfig({
    ...fileConfig,
    ...overrides,
    parser: { ...fileConfig.parser, ...overrides.parser },
  });

  const input = await readInput(options.input);
  const result = new LogProcessor(config).processNdjson(input);
  const serialized = serializeEvents(result.events, config.output);
  await writeOutput(options.output, serialized);

  for (const diagnostic of result.diagnostics) {
    stderr.write(`log-tidy:${diagnostic.line}: ${diagnostic.code}: ${diagnostic.message}\n`);
  }
  if (options.stats) stderr.write(`${JSON.stringify(result.stats)}\n`);
  if (config.parser.strict && result.diagnostics.length) process.exitCode = 2;
}

function parseArguments(args: string[]): CliOptions {
  const options: CliOptions = { stats: false, help: false, version: false };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    if (argument === "--help" || argument === "-h") options.help = true;
    else if (argument === "--version" || argument === "-v") options.version = true;
    else if (argument === "--stats") options.stats = true;
    else if (argument === "--strict") options.strict = true;
    else if (argument === "--no-strict") options.strict = false;
    else if (["--input", "-i"].includes(argument)) options.input = requiredValue(args, ++index, argument);
    else if (["--output", "-o"].includes(argument)) options.output = requiredValue(args, ++index, argument);
    else if (["--config", "-c"].includes(argument)) options.config = requiredValue(args, ++index, argument);
    else if (["--format", "-f"].includes(argument)) options.format = parseFormat(requiredValue(args, ++index, argument));
    else if (argument.startsWith("-")) throw new Error(`unknown option: ${argument}`);
    else if (!options.input) options.input = argument;
    else throw new Error(`unexpected argument: ${argument}`);
  }
  return options;
}

function requiredValue(args: string[], index: number, option: string): string {
  const value = args[index];
  if (!value || value.startsWith("-")) throw new Error(`${option} requires a value`);
  return value;
}

function parseFormat(value: string): OutputFormat {
  if (value === "ndjson" || value === "json" || value === "pretty") return value;
  throw new Error(`unsupported format: ${value}`);
}

async function readInput(path?: string): Promise<string> {
  if (path && path !== "-") return readFile(path, "utf8");
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

async function writeOutput(path: string | undefined, value: string): Promise<void> {
  if (!path || path === "-") {
    stdout.write(value);
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const stream = createWriteStream(path, { encoding: "utf8" });
    
    const onError = (error: Error) => {
      stream.removeListener("finish", onFinish);
      reject(error);
    };
    
    const onFinish = () => {
      stream.removeListener("error", onError);
      resolve();
    };
    
    stream.once("error", onError);
    stream.once("finish", onFinish);
    stream.end(value);
  });
}

function helpText(): string {
  return `log-tidy ${VERSION}\n\n` +
    "Normalize, redact, sample, and validate JSON log streams.\n\n" +
    "Usage: log-tidy [input] [options]\n\n" +
    "Options:\n" +
    "  -i, --input <path>    Input NDJSON file; defaults to stdin\n" +
    "  -o, --output <path>   Output file; defaults to stdout\n" +
    "  -c, --config <path>   JSON configuration file\n" +
    "  -f, --format <value>  ndjson, json, or pretty\n" +
    "      --strict          Exit on malformed input\n" +
    "      --stats           Write processing statistics to stderr\n" +
    "  -v, --version         Print version\n" +
    "  -h, --help            Show this help\n";
}

main().catch((error: unknown) => {
  stderr.write(`log-tidy: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
