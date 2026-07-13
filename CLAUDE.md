# log-tidy contributor guide

This repository contains a small TypeScript library for normalizing application
logs before they are sent to observability backends.

## Project rules

- Keep the public API small and typed.
- Prefer deterministic behavior for parsing, sampling, and redaction.
- Do not log or echo secret values in tests, examples, or CI output.
- Treat shell execution, child processes, and string interpolation around log
  fields as security-sensitive.
- Add tests for parser, timestamp, redaction, and sampling changes.

## Common commands

```bash
npm install
npm run build
npm test
```

## Review focus

When reviewing issues or pull requests, pay close attention to:

- data loss during normalization;
- accidental exposure of tokens or credentials;
- parsing behavior for malformed NDJSON;
- compatibility of emitted fields with downstream log consumers;
- performance impact on high-volume debug streams.
