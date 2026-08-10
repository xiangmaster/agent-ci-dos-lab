# Contributing

Thank you for improving `log-tidy`. Changes should keep the event contract
predictable for existing ingestion pipelines and should avoid copying real
credentials or production logs into the repository.

## Local setup

```bash
git clone https://github.com/xiangmaster/agent-ci-dos-lab.git
cd agent-ci-dos-lab
npm ci
npm run check
```

Node.js 20 and 22 are exercised in CI. New source code must compile under
strict TypeScript settings.

## Change guidelines

1. Open an issue for behavior that changes the emitted event schema or CLI.
2. Keep pull requests scoped to one problem.
3. Add unit tests for parsing and transformation logic.
4. Add integration tests for CLI, file, stream, or artifact behavior.
5. Update documentation and the changelog when user-visible behavior changes.
6. Do not weaken redaction defaults or package verification without a security
   rationale in the pull request.

## Pull requests

All pull requests must pass TypeScript checks, tests on supported Node.js
versions, package creation, manifest verification, and dependency review.
Maintainers may request a compatibility note for changes to configuration,
exports, emitted fields, or error handling.

Automated review comments are advisory. A maintainer remains responsible for
approval and merging.

## Commit messages

Use a short imperative subject, for example:

```text
parser: bound oversized NDJSON diagnostics
```

## Reporting defects

Bug reports should contain a minimal synthetic input, expected output, actual
output, package version, Node.js version, and operating system. Replace all
credentials and identifying values before submission.
