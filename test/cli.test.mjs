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

test("writeOutput handles a moderately large payload without truncation", async () => {
  const directory = await mkdtemp(join(tmpdir(), "log-tidy-cli-"));
  const input = join(directory, "input.ndjson");
  const output = join(directory, "output.json");
  
  // Generate 500 minimal log events
  const events = [];
  for (let i = 0; i < 500; i += 1) {
    events.push(`{"level":"info","msg":"event ${i}","index":${i}}`);
  }
  await writeFile(input, events.join("\n") + "\n");
  
  const run = spawnSync(process.execPath, ["dist/cli.js", input, "--output", output, "--format", "json"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  
  assert.equal(run.status, 0, run.stderr);
  const content = await readFile(output, "utf8");
  const parsed = JSON.parse(content);
  assert.equal(parsed.length, 500, "All 500 events should be present in output");
  
  // Verify first and last events to ensure no truncation
  assert.equal(parsed[0].msg, "event 0");
  assert.equal(parsed[0].index, 0);
  assert.equal(parsed[499].msg, "event 499");
  assert.equal(parsed[499].index, 499);
});
