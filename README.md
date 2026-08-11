# log-tidy

`log-tidy` is a TypeScript library and command-line tool for normalizing
structured application logs before they enter an observability pipeline. It
accepts newline-delimited JSON, maps common timestamp and severity formats to
a stable event schema, recursively redacts sensitive fields, applies
deterministic sampling, and reports malformed records without losing the rest
of the stream.

The package is intended for ingestion workers, deployment sidecars, build
pipelines, and local diagnostics where logs arrive from services with
different conventions.

## Features

- ISO-8601, epoch-second, and epoch-millisecond timestamp normalization.
- Severity aliases and numeric logger levels mapped to six canonical levels.
- Configurable field aliases for heterogeneous producers.
- Recursive key and path-based redaction, including arrays and nested headers.
- Deterministic trace and debug sampling with a stable seed.
- Bounded NDJSON parsing with structured per-line diagnostics.
- Strict and best-effort processing modes.
- NDJSON, JSON array, and human-readable output.
- Library, batch, streaming, and CLI APIs.
- Reproducible npm package manifests with SHA-256 verification.

## Requirements

- Node.js 20 or later
- npm 10 or later for development

## Install

```bash
npm install log-tidy
```

## CLI

Process a file:

```bash
log-tidy application.ndjson --config log-tidy.config.json --output normalized.ndjson
```

Use a pipe and emit readable output:

```bash
cat application.ndjson | log-tidy --format pretty --stats
```

Malformed records are reported to stderr. Valid records continue through the
pipeline unless `--strict` is enabled.

## Library API

```ts
import { LogProcessor, tidy } from "log-tidy";

const event = tidy({
  timestamp: 1718500000,
  severity: "WARN",
  message: "request exceeded latency budget",
  headers: { authorization: "Bearer example" },
});

const processor = new LogProcessor({
  sampling: { debugRate: 0.1 },
  redaction: { paths: ["request.headers.*"] },
});

const result = processor.processNdjson(input);
console.log(result.events, result.diagnostics, result.stats);
```

For large inputs, `processNdjsonStream` processes records incrementally without
retaining the complete input or output in memory.

## Configuration

Configuration is JSON and is merged with secure defaults. A complete example
is available at [`examples/log-tidy.config.json`](examples/log-tidy.config.json).
See [`docs/configuration.md`](docs/configuration.md) for every option.

## Development

```bash
npm ci
npm run check
```

Useful commands:

| Command | Purpose |
|---|---|
| `npm run build` | Compile ESM JavaScript, declarations, and source maps. |
| `npm run lint` | Run the strict TypeScript static checks. |
| `npm test` | Build and execute unit and integration tests. |
| `npm run test:smoke` | Execute the fast pull-request test subset. |
| `npm run test:full` | Execute unit and critical compatibility tests. |
| `npm run test:coverage` | Execute tests with Node.js coverage. |
| `npm pack` | Build the publishable package archive. |

## Documentation

- [Architecture](docs/architecture.md)
- [Configuration](docs/configuration.md)
- [CLI reference](docs/cli.md)
- [Normalized event format](docs/log-format.md)
- [Operational guidance](docs/operations.md)
- [Release process](docs/releasing.md)

## Security

Never include production credentials or customer log data in issues. Please
follow [SECURITY.md](SECURITY.md) for private vulnerability reporting and the
project's supported-version policy.

## License

MIT
