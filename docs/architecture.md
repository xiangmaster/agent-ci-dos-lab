# Architecture

`log-tidy` separates parsing, normalization, policy, and output so each stage
can be tested and embedded independently.

```text
NDJSON input
    |
    v
bounded parser -----> structured diagnostics
    |
    v
field extraction -> timestamp/level/error normalization
    |
    v
recursive redaction
    |
    v
deterministic sampling
    |
    v
NDJSON / JSON / pretty serialization
```

`LogProcessor` owns a validated immutable configuration. `processEvent`
handles one object, `processNdjson` handles a bounded in-memory batch, and
`processNdjsonStream` drives the same event pipeline from a Node.js readable
stream.

The package has no runtime dependencies. File and process integration exists
only in the CLI. Core transformations operate on objects and return explicit
events, diagnostics, and counters.

CI creates an npm archive and a manifest containing the archive name, size,
and SHA-256 digest. A separate workflow downloads and verifies the artifact
produced by CI. Release jobs rebuild and validate the package before attaching
it to a GitHub Release.
