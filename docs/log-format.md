# Normalized event format

Every emitted event is a JSON object with `ts` and `level` fields. Additional
application fields are preserved after configured aliases and error objects
have been consumed.

## Core fields

| Field | Type | Required | Description |
|---|---|---:|---|
| `ts` | string | yes | UTC ISO-8601 timestamp. |
| `level` | string | yes | `trace`, `debug`, `info`, `warn`, `error`, or `fatal`. |
| `msg` | string | no | Human-readable event message. |
| `error.kind` | string | no | Error class or name. |
| `error.message` | string | no | Error message. |
| `error.stack` | string | no | Stack trace when provided. |
| `error.code` | string/number | no | Application or platform error code. |

Nested causes use `error.cause.*`, up to the configured implementation limit.

## Field aliases

Default timestamp aliases are `ts`, `timestamp`, `time`, and `@timestamp`.
Default level aliases are `level`, `lvl`, `severity`, and `severityText`.
Message and error aliases can also be configured.

When multiple aliases occur in one object, the first configured alias wins.
Unused aliases are preserved as application fields only when they were not
selected.

## Redaction

Redaction occurs after normalization and before sampling or serialization.
Key matching is case-insensitive and recursive. Path patterns are dot-separated
and support `*` for one path segment. The original event object is not mutated.

## Compatibility

New optional fields may be added in minor releases. Removing or changing the
meaning of a core field requires a major release.
