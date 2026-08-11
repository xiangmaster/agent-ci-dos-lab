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
  await writeFile(input, '{"severity":"warn","message":"slow","token":"secret"}\n');
  const run = spawnSync(process.execPath, ["dist/cli.js", input, "--output", output, "--format", "json", "--stats"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
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

test("CLI reports missing input file with clear error", () => {
  const run = spawnSync(process.execPath, ["dist/cli.js", "--input", "/nonexistent/file.ndjson"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /cannot read input file/);
});

test("CLI reports error when flag is missing required value", () => {
  const run = spawnSync(process.execPath, ["dist/cli.js", "--input"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /requires a value/);
});

test("CLI reports error for invalid format value", () => {
  const run = spawnSync(process.execPath, ["dist/cli.js", "--format", "xml"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /unsupported format/);
});
