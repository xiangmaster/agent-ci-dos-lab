import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { LogProcessor, processNdjsonStream } from "../dist/index.js";

test("stream processor emits incrementally and reports invalid lines", async () => {
  const events = [];
  const diagnostics = [];
  const input = Readable.from(['{"level":"info","msg":"one"}\n', 'bad\n', '{"level":"error","msg":"two"}\n']);
  const stats = await processNdjsonStream(input, new LogProcessor(), {
    onEvent: (event) => events.push(event),
    onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
  });
  assert.equal(events.length, 2);
  assert.equal(diagnostics.length, 1);
  assert.equal(stats.received, 3);
  assert.equal(stats.invalid, 1);
});

test("stream processor honors strict mode", async () => {
  const input = Readable.from(["bad\n"]);
  await assert.rejects(
    () => processNdjsonStream(input, new LogProcessor({ parser: { strict: true } }), { onEvent() {} }),
    /strict parsing rejected line 1/,
  );
});
