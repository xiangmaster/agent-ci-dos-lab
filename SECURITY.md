# Security policy

## Supported versions

Security fixes are applied to the current major release and the `main` branch.
Pre-release and historical minor versions may receive a documented workaround
instead of a patch.

## Reporting a vulnerability

Use GitHub private vulnerability reporting when available. Otherwise contact
the repository owner without opening a public issue. Include the affected
version, minimal reproduction, expected impact, and any proposed mitigation.
Do not include live credentials, customer logs, or third-party repository data.

The maintainers will acknowledge a complete report, reproduce it in an
isolated environment, and coordinate a release and disclosure timeline.

## Security boundaries

The following areas require additional review:

- recursive redaction and field-path matching;
- malformed, oversized, deeply nested, or circular event input;
- configuration loaded from untrusted locations;
- shell wrappers around CLI output;
- automated consumers of JSON and package manifests;
- dependency and GitHub Actions updates;
- workflows that receive issue, pull-request, or comment content.

`log-tidy` does not execute event fields. Integrators must preserve that
boundary and must not interpolate normalized output into a shell command.
