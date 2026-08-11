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

test("stream error mid-read rejects with upstream error", async () => {
  const input = new Readable({
    read() {
      this.push('{"level":"info","msg":"first"}\n');
      this.destroy(new Error("simulated read failure"));
    },
  });
  await assert.rejects(
    () => processNdjsonStream(input, new LogProcessor(), { onEvent() {} }),
    /simulated read failure/,
  );
});

test("empty stream returns zero stats without throwing", async () => {
  const input = Readable.from([]);
  const stats = await processNdjsonStream(input, new LogProcessor(), { onEvent() {} });
  assert.deepEqual(stats, { received: 0, emitted: 0, sampled: 0, invalid: 0, redactedFields: 0 });
});

test("onEvent callback throws and readline interface is cleaned up", async () => {
  const input = Readable.from(['{"level":"info","msg":"one"}\n', '{"level":"info","msg":"two"}\n']);
  await assert.rejects(
    () => processNdjsonStream(input, new LogProcessor(), {
      onEvent() {
        throw new Error("callback failed");
      },
    }),
    /callback failed/,
  );
  // If the finally block runs, the interface is closed and this test completes without hanging
});
