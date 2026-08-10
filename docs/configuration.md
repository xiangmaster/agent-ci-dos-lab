# Configuration

Configuration files are JSON objects. Omitted values inherit defaults.

## `redaction`

| Option | Type | Default | Description |
|---|---|---|---|
| `enabled` | boolean | `true` | Enable redaction. |
| `keys` | string[] | credential-related keys | Recursive case-insensitive key matches. |
| `paths` | string[] | selected header/credential paths | Dot paths with one-segment `*`. |
| `replacement` | string | `[REDACTED]` | Replacement value. |
| `maxDepth` | integer | `20` | Maximum recursive object depth. |

## `sampling`

`traceRate` and `debugRate` are numbers from `0` through `1`. The `seed`
participates in a stable FNV-1a decision using `event_id`, `request_id`, or a
fallback event fingerprint. Events at info level or higher are never sampled.

## `parser`

| Option | Default | Description |
|---|---:|---|
| `maxLineBytes` | 1048576 | Reject larger NDJSON records. |
| `skipEmptyLines` | true | Ignore blank lines. |
| `strict` | false | Stop when invalid input is encountered. |

## `fields`

The `timestamp`, `level`, `message`, and `error` arrays define aliases in
priority order. Each array must contain at least one non-empty string.

## `output`

Supported values are `ndjson`, `json`, and `pretty`. Programmatic consumers
should use NDJSON or JSON rather than the human-readable format.
