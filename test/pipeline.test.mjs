import test from "node:test";
import assert from "node:assert/strict";
import { LogProcessor, parseNdjson, serializeEvents, tidy } from "../dist/index.js";

const context = { now: () => new Date("2026-01-02T03:04:05.000Z") };

test("pipeline emits valid events and structured diagnostics", () => {
  // token is no longer a default redaction key, so it passes through unchanged
  // and redactedFields is 0 for this input.
  const result = parseNdjson(
    '{"level":"error","msg":"failed"}\nnot-json\n42\n{"level":"debug","token":"x"}',
    {},
    context,
  );
  assert.equal(result.events.length, 2);
  assert.deepEqual(result.diagnostics.map((item) => item.code), ["INVALID_JSON", "NOT_OBJECT"]);
  assert.deepEqual(result.stats, { received: 4, emitted: 2, sampled: 0, invalid: 2, redactedFields: 0 });
  // Confirm the token value is preserved by default.
  assert.equal(result.events[1].token, "x");
});

test("sampling is stable for the same event and seed", () => {
  const options = { sampling: { debugRate: 0.5, seed: "stable" } };
  const input = { level: "debug", event_id: "evt-42", msg: "verbose" };
  const first = tidy(input, options, context);
  for (let index = 0; index < 20; index += 1) assert.deepEqual(tidy(input, options, context), first);
});

test("sampling never drops warn, error, or fatal events", () => {
  const processor = new LogProcessor({ sampling: { traceRate: 0, debugRate: 0 } }, context);
  assert.equal(processor.processEvent({ level: "trace" }).event, null);
  assert.equal(processor.processEvent({ level: "debug" }).event, null);
  assert.equal(processor.processEvent({ level: "warn" }).event.level, "warn");
  assert.equal(processor.processEvent({ level: "error" }).event.level, "error");
});

test("strict mode rejects a batch containing invalid data", () => {
  const processor = new LogProcessor({ parser: { strict: true } }, context);
  assert.throws(() => processor.processNdjson("not-json"), /strict parsing rejected/);
});

test("serializer supports ndjson, JSON arrays, and readable lines", () => {
  const events = [{ ts: "2026-01-02T03:04:05.000Z", level: "info", msg: "ready", service: "api" }];
  assert.match(serializeEvents(events, "ndjson"), /^\{"ts":/);
  assert.deepEqual(JSON.parse(serializeEvents(events, "json")), events);
  assert.match(serializeEvents(events, "pretty"), /INFO\s+ready.*service/);
});
