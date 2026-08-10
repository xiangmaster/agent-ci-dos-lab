import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ConfigError, loadConfig, resolveConfig } from "../dist/index.js";

test("resolveConfig merges nested sections with defaults", () => {
  const config = resolveConfig({ sampling: { debugRate: 0.25 }, output: "pretty" });
  assert.equal(config.sampling.debugRate, 0.25);
  assert.equal(config.sampling.traceRate, 1);
  assert.equal(config.output, "pretty");
  assert.equal(config.redaction.enabled, true);
});

test("resolveConfig rejects invalid rates and parser limits", () => {
  assert.throws(() => resolveConfig({ sampling: { debugRate: 2 } }), ConfigError);
  assert.throws(() => resolveConfig({ parser: { maxLineBytes: 2 } }), ConfigError);
  assert.throws(() => resolveConfig({ output: "xml" }), ConfigError);
});

test("loadConfig reads and validates JSON files", async () => {
  const directory = await mkdtemp(join(tmpdir(), "log-tidy-config-"));
  const path = join(directory, "config.json");
  await writeFile(path, JSON.stringify({ sampling: { traceRate: 0 }, output: "json" }));
  const config = await loadConfig(path);
  assert.equal(config.sampling.traceRate, 0);
  assert.equal(config.output, "json");
});

test("loadConfig reports malformed JSON", async () => {
  const directory = await mkdtemp(join(tmpdir(), "log-tidy-config-"));
  const path = join(directory, "config.json");
  await writeFile(path, "{");
  await assert.rejects(() => loadConfig(path), ConfigError);
});
