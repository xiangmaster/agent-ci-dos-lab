# CLI reference

```text
log-tidy [input] [options]
```

| Option | Description |
|---|---|
| `-i, --input <path>` | Read NDJSON from a file. `-` or omission reads stdin. |
| `-o, --output <path>` | Write output to a file. `-` or omission writes stdout. |
| `-c, --config <path>` | Load JSON configuration. |
| `-f, --format <value>` | Select `ndjson`, `json`, or `pretty`. |
| `--strict` | Reject input containing malformed records. |
| `--no-strict` | Override strict mode from configuration. |
| `--stats` | Write processing counters to stderr. |
| `-v, --version` | Print the package version. |
| `-h, --help` | Print command help. |

Diagnostics and statistics are written to stderr so stdout remains suitable
for pipelines. Exit status is non-zero for invalid options, unreadable files,
invalid configuration, and strict-mode failures.
