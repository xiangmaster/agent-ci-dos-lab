import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

test("CLI processes a file, writes output, and reports stats", async () => {
  const directory = await mkdtemp(join(tmpdir(), "log-tidy-cli-"));
  const input = join(directory, "input.ndjson");
  const output = join(directory, "output.json");
  const configPath = join(directory, "config.json");
  // Explicitly opt in to token redaction; it is no longer a default key.
  await writeFile(configPath, JSON.stringify({ redaction: { keys: ["token"] } }));
  await writeFile(input, '{"severity":"warn","message":"slow","token":"secret"}\n');
  const run = spawnSync(
    process.execPath,
    ["dist/cli.js", input, "--config", configPath, "--output", output, "--format", "json", "--stats"],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  assert.equal(run.status, 0, run.stderr);
  const events = JSON.parse(await readFile(output, "utf8"));
  assert.equal(events[0].level, "warn");
  assert.equal(events[0].token, "[REDACTED]");
  assert.match(run.stderr, /"received":1/);
});

test("CLI accepts stdin and pretty output", () => {
  const run = spawnSync(process.execPath, ["dist/cli.js", "--format", "pretty"], {
    cwd: process.cwd(),
    input: '{"level":"info","msg":"ready"}\n',
    encoding: "utf8",
  });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /INFO\s+ready/);
});

test("CLI prints help and rejects unknown options", () => {
  const help = spawnSync(process.execPath, ["dist/cli.js", "--help"], { cwd: process.cwd(), encoding: "utf8" });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Usage: log-tidy/);
  const invalid = spawnSync(process.execPath, ["dist/cli.js", "--wat"], { cwd: process.cwd(), encoding: "utf8" });
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /unknown option/);
});
