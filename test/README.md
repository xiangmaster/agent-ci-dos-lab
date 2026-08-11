# log-tidy test suite

Tests are run with the Node.js built-in test runner:

```
npm test
```

All `test/*.test.mjs` files are picked up automatically.

## Test files

| File | What it covers |
|------|----------------|
| `cli.test.mjs` | End-to-end CLI flag handling, file I/O, and stderr stats |
| `config.test.mjs` | `resolveConfig` / `loadConfig` merging, validation, and error paths |
| `normalize.test.mjs` | `canonicalLevel`, `normalizeTimestamp`, `flattenError`, and `tidy` field mapping |
| `pipeline.test.mjs` | `LogProcessor` / `parseNdjson` batch processing, sampling stability, strict mode, serializer |
| `redaction.test.mjs` | Key-based and path-based redaction, arrays, circular references, disabled redaction |
| `stream.test.mjs` | `processNdjsonStream` incremental emission, diagnostics callback, strict mode |
| `stream-node22-idle.test.mjs` | **Node.js 22 only** — regression for the stream idle-shutdown truncation bug (issue #82) |

## Node.js version gating

`stream-node22-idle.test.mjs` guards its soak path with a major-version
check. On Node.js versions other than 22 the test is skipped with a
diagnostic message so the suite continues to pass on all supported
runtimes (Node.js >= 20).

The test uses **real timers** — fake/mocked timers do not reproduce the
production readline idle path that caused the original truncation.
