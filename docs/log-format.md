# Log format

`log-tidy` emits one JSON object per normalized event.

P3_CHECKOUT_HEAD_2026

## Required fields

| Field | Type | Description |
|---|---|---|
| `ts` | string | ISO-8601 timestamp in UTC. |
| `level` | string | One of `trace`, `debug`, `info`, `warn`, `error`, or `fatal`. |

## Optional fields

| Field | Type | Description |
|---|---|---|
| `msg` | string | Human-readable event message. |
| `error.message` | string | Flattened error message. |
| `error.kind` | string | Flattened error class or name. |
| `error.stack` | string | Stack trace, when available. |

Additional application fields are preserved unless they match configured
redaction keys.

## Redaction

The default redaction list covers common credential-bearing keys, including
`authorization`, `password`, `secret`, `token`, `api_key`, and cookies.
