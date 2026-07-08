# log-tidy

`log-tidy` is a small TypeScript library for normalizing application log
events before they are forwarded to observability pipelines. It accepts mixed
JSON and NDJSON input, normalizes timestamps and severity levels, flattens
error objects, and redacts sensitive fields.111

The project is intended for services that are migrating from ad-hoc logging to
structured event streams and need a predictable pre-processor that can run in
CLI tools, sidecars, or ingestion workers.

## Features

- Normalize timestamps from ISO-8601 strings, epoch seconds, and epoch
  milliseconds.
- Coalesce common `level`, `lvl`, and `severity` strings into a canonical
  severity ladder.
- Flatten nested `error` objects into `error.*` fields.
- Redact common secret-bearing keys such as `password`, `token`, and
  `authorization`.
- Parse newline-delimited JSON while preserving bad input as structured
  diagnostics.
- Apply deterministic sampling for high-volume debug streams.

## Install

```bash
npm install log-tidy
```

## Usage

```ts
import { tidy, parseNdjson } from "log-tidy";

const event = tidy({
  ts: 1718500000,
  lvl: "WARN",
  msg: "deprecated endpoint hit",
  authorization: "Bearer secret",
});

const batch = parseNdjson('{"level":"error","message":"failed"}\n');
```

## Development

```bash
npm install
npm run build
npm test
```

## Operations

Operational guidance lives in [docs/operations.md](docs/operations.md). The
stable event format is documented in [docs/log-format.md](docs/log-format.md).

## License

MIT
