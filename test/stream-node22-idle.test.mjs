/**
 * Regression test for the Node.js 22 stream idle-shutdown bug (issue #82).
 *
 * Production symptom: an NDJSON stream processed via processNdjsonStream()
 * silently dropped the final event when the readable source went idle for a
 * period between chunks. The bug was specific to the readline interface
 * behaviour in Node.js 22 and did not reproduce under fake/mocked timers.
 *
 * This test:
 *  - Runs only on Node.js 22 (skipped with a diagnostic on all other majors).
 *  - Uses real timers so that the underlying readline idle path is exercised.
 *  - Inserts a genuine asynchronous pause between stream chunks to simulate
 *    the production idle window.
 *  - Asserts that the final event is received after the idle period, which
 *    was the exact failure mode in production.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { LogProcessor, processNdjsonStream } from '../dist/index.js';

// ---------------------------------------------------------------------------
// Helper: build a Readable that emits chunks with a real-timer delay between
// them.  Using a custom async generator keeps the stream in object/string
// mode and exercises the readline crlfDelay path in processNdjsonStream.
// ---------------------------------------------------------------------------
function makeIdleStream(pauseMs) {
  // Two chunks separated by a genuine setTimeout pause.
  async function* generate() {
    yield '{"level":"info","msg":"before-idle"}\n';
    // Real timer pause — this is what triggers the production bug path.
    await new Promise((resolve) => setTimeout(resolve, pauseMs));
    yield '{"level":"info","msg":"final"}\n';
  }
  return Readable.from(generate());
}

// ---------------------------------------------------------------------------
// Detect Node.js major version without importing semver.
// ---------------------------------------------------------------------------
const nodeMajor = Number(process.versions.node.split('.')[0]);

test(
  'Node.js 22 stream idle shutdown regression (issue #82)',
  { timeout: 30_000 },
  async (t) => {
    if (nodeMajor !== 22) {
      t.diagnostic(
        `Skipping Node.js 22 stream idle regression: running on Node.js ${nodeMajor}.`,
      );
      t.skip();
      return;
    }

    // 100 ms is enough to move through the event loop idle checkpoints that
    // triggered the production truncation without slowing down the test suite.
    const IDLE_MS = 100;

    const events = [];
    const processor = new LogProcessor();

    const stats = await processNdjsonStream(
      makeIdleStream(IDLE_MS),
      processor,
      { onEvent: (ev) => events.push(ev) },
    );

    // Both events must have been received — the bug caused the second one to
    // be silently dropped.
    assert.equal(stats.received, 2, 'stream should have received 2 lines');
    assert.equal(stats.emitted, 2, 'stream should have emitted 2 events');
    assert.equal(events.length, 2, 'onEvent should have been called twice');

    // The critical assertion: the final event (emitted after the idle period)
    // must be present.
    const lastEvent = events[events.length - 1];
    assert.equal(
      lastEvent?.msg,
      'final',
      'final event emitted after the idle period must not be dropped',
    );
  },
);
