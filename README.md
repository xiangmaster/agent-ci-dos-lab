# log-tidy

A small utility for normalizing structured application logs (JSON / NDJSON) and emitting clean event streams for downstream ingestion.

`log-tidy` is designed for small services that produce mixed log formats during their development phase and need a lightweight pre-processor before forwarding events to centralized observability tools.

## Features

- Detect and normalize timestamps across ISO-8601, epoch seconds, and epoch milliseconds.
- Coalesce free-form `level` strings into a canonical severity ladder.
- Drop empty fields and collapse nested error objects into a flat `error.*` namespace.
- Optional sampling for high-volume debug events.

## Install

```bash
npm install log-tidy
```

## Usage

```ts
import { tidy } from "log-tidy";

const cleaned = tidy({
  ts: 1718500000,
  lvl: "WARN",
  msg: "deprecated endpoint hit",
});
```

## Status

Pre-1.0. APIs may change. See open issues for current roadmap.

## License

MIT
