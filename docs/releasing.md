# Release process

1. Update `CHANGELOG.md` and the version in `package.json`.
2. Run `npm run check` and `npm pack` locally.
3. Merge the release preparation pull request after required checks pass.
4. Create and push an annotated `v<version>` tag.
5. Confirm that the Release workflow rebuilds, tests, packages, and validates
   the archive before creating the GitHub Release.

The package candidate created by CI contains a `manifest.json` with a SHA-256
digest and byte size. `Artifact Validation` independently downloads the
candidate from the completed CI run and verifies both fields.

Publishing to a package registry is intentionally separate from GitHub Release
creation. Registry credentials must be held in a protected environment with
review rules and must never be passed to pull-request workflows.
