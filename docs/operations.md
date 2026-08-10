# Operations

## Pipeline placement

Place `log-tidy` at the first trusted boundary after log collection and before
storage, indexing, alerting, or forwarding. Redaction should happen before an
event is copied to another system.

## Failure behavior

Best-effort mode emits valid events and reports malformed lines as diagnostics.
Strict mode stops the batch or stream when invalid input is encountered. Use
strict mode for build and migration validation; use best-effort mode for
long-running ingestion where one malformed producer must not halt the service.

## Capacity controls

- Set `parser.maxLineBytes` below the downstream ingestion limit.
- Sample trace and debug records with a stable seed.
- Count `received`, `emitted`, `sampled`, `invalid`, and `redactedFields`.
- Rate-limit diagnostics before sending them into another logging pipeline.
- Prefer `processNdjsonStream` for large files and unbounded streams.

## Output handling

Treat all output as data. Do not evaluate event fields as shell, YAML,
JavaScript, templates, or workflow expressions. Automated consumers should
validate expected fields and reject unknown schema versions before acting.

## Deployment checklist

1. Test redaction rules with synthetic fixtures.
2. Verify sampling behavior with stable event identifiers.
3. Define an invalid-record budget and alert threshold.
4. Pin package and deployment artifacts by digest.
5. Record the active configuration version with deployment metadata.
6. Exercise rollback using a representative input sample.
