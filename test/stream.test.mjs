// stream.test.mjs
//
// Tests for the processNdjsonStream helper.
//
// Soak regression (Node.js 22 only — see "stream shutdown soak" test below)
// -------------------------------------------------------------------------
// Production issue #82: on Node.js 22 an NDJSON stream can truncate output
// after remaining idle for an extended period.  The soak test keeps the
// stream open and active, idles for several seconds with real timers, then
// emits a final event and asserts it is received.  The test is skipped on
// every other Node.js major so the normal test suite stays fast.

import test from "node:test";
import assert from "node:assert/strict";
import { Readable, PassThrough } from "node:stream";
import { setTimeout as sleep } from "node:timers/promises";
import { LogProcessor, processNdjsonStream } from "../dist/index.js";

test("stream processor emits incrementally and reports invalid lines", async () => {
  const events = [];
  const diagnostics = [];
  const input = Readable.from(['  {"level":"info","msg":"one"}\n', 'bad\n', '{"level":"error","msg":"two"}\n']);
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

// ---------------------------------------------------------------------------
// Node.js 22 stream-shutdown soak regression (#82)
//
// Keeps a PassThrough stream open, writes an initial batch of events, waits
// with a real timer (no mocks), writes a final event, then asserts it was
// received by the processor.  Skipped on every Node.js major other than 22.
// ---------------------------------------------------------------------------
const nodeMajor = Number(process.versions.node.split(".")[0]);

const soakDescription = "Node.js 22 stream shutdown soak: final event emitted after idle period";

if (nodeMajor !== 22) {
  test.skip(soakDescription);
} else {
  // Soak duration: 5 s is sufficient to exercise the idle-shutdown path.
  const SOAK_MS = 5_000;

  test(soakDescription, { timeout: SOAK_MS + 15_000 }, async () => {
    const pt = new PassThrough();
    const events = [];
    const diagnostics = [];
    const processor = new LogProcessor();

    // Start the async stream consumer — it will await lines as they arrive.
    const statsPromise = processNdjsonStream(pt, processor, {
      onEvent: (event) => events.push(event),
      onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    });

    // Write an initial event so the stream is active before the idle period.
    pt.write('{"level":"info","msg":"before-idle"}\n');

    // Let the consumer process the line before idling.
    await sleep(50);
    assert.equal(events.length, 1, "initial event should arrive before idle period");

    // Idle: keep the stream open with real timers — this is what triggers the
    // production truncation on Node.js 22.
    await sleep(SOAK_MS);

    // Write the final event and close the stream.
    pt.write('{"level":"warn","msg":"after-idle"}\n');
    pt.end();

    const stats = await statsPromise;

    assert.equal(events.length, 2, "final event must be emitted after the idle period");
    assert.equal(events[1].msg, "after-idle");
    assert.equal(stats.received, 2);
    assert.equal(stats.emitted, 2);
    assert.equal(diagnostics.length, 0);
  });
}
