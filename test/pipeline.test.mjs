import test from "node:test";
import assert from "node:assert/strict";
import { LogProcessor, parseNdjson, serializeEvents, tidy } from "../dist/index.js";

const context = { now: () => new Date("2026-01-02T03:04:05.000Z") };

test("pipeline emits valid events and structured diagnostics", () => {
  const result = parseNdjson(
    '{"level":"error","msg":"failed"}\nnot-json\n42\n{"level":"debug","token":"x"}',
    {},
    context,
  );
  assert.equal(result.events.length, 2);
  assert.deepEqual(result.diagnostics.map((item) => item.code), ["INVALID_JSON", "NOT_OBJECT"]);
  assert.deepEqual(result.stats, { received: 4, emitted: 2, sampled: 0, invalid: 2, redactedFields: 1 });
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

// Node.js 22 serialization regression tests

test("ndjson serializer round-trips multi-byte UTF-8 messages", () => {
  const original = {
    ts: "2026-01-02T03:04:05.000Z",
    level: "info",
    msg: "日本語\u{1F4BB}e\u0301", // CJK + emoji + combining acute accent on 'e'
  };
  const serialized = serializeEvents([original], "ndjson");
  const lines = serialized.split("\n").filter((line) => line.trim() !== "");
  assert.equal(lines.length, 1);
  const parsed = JSON.parse(lines[0]);
  assert.equal(parsed.msg, original.msg);
});

test("json serializer produces valid UTF-8 for all BMP code points in field values", () => {
  const events = [];
  // Sample every 256th code point in BMP (U+0000–U+FFFF), skipping lone surrogates (U+D800–U+DFFF)
  for (let cp = 0; cp <= 0xffff; cp += 256) {
    if (cp >= 0xd800 && cp <= 0xdfff) continue; // Skip surrogate range
    events.push({
      ts: "2026-01-02T03:04:05.000Z",
      level: "info",
      msg: String.fromCodePoint(cp),
    });
  }
  const serialized = serializeEvents(events, "json");
  const parsed = JSON.parse(serialized);
  assert.equal(parsed.length, events.length);
  for (let i = 0; i < events.length; i++) {
    assert.equal(parsed[i].msg, events[i].msg);
  }
});

test("pretty serializer does not crash on events with no msg, no extra fields", () => {
  const minimal = [{ ts: "2026-01-02T03:04:05.000Z", level: "info" }];
  const result = serializeEvents(minimal, "pretty");
  assert.equal(typeof result, "string");
  assert.ok(result.length > 0);
  assert.ok(result.includes("INFO"));
  assert.ok(result.endsWith("\n"));
});

test("ndjson serializer emits one line per event with no blank lines", () => {
  const events = [];
  for (let i = 0; i < 10; i++) {
    events.push({ ts: "2026-01-02T03:04:05.000Z", level: "info" });
  }
  const serialized = serializeEvents(events, "ndjson");
  const lines = serialized.split("\n").filter((line) => line.trim() !== "");
  assert.equal(lines.length, 10);
  for (const line of lines) {
    const parsed = JSON.parse(line);
    assert.equal(typeof parsed, "object");
    assert.ok(parsed.ts);
    assert.ok(parsed.level);
  }
});

test("serializeEvents is referentially transparent — same input always same output", () => {
  const events = [
    { ts: "2026-01-02T03:04:05.000Z", level: "info", msg: "test" },
    { ts: "2026-01-02T03:04:06.000Z", level: "warn", msg: "warning" },
  ];
  
  const ndjson1 = serializeEvents(events, "ndjson");
  const ndjson2 = serializeEvents(events, "ndjson");
  const ndjson3 = serializeEvents(events, "ndjson");
  assert.equal(ndjson1, ndjson2);
  assert.equal(ndjson2, ndjson3);
  
  const json1 = serializeEvents(events, "json");
  const json2 = serializeEvents(events, "json");
  const json3 = serializeEvents(events, "json");
  assert.equal(json1, json2);
  assert.equal(json2, json3);
  
  const pretty1 = serializeEvents(events, "pretty");
  const pretty2 = serializeEvents(events, "pretty");
  const pretty3 = serializeEvents(events, "pretty");
  assert.equal(pretty1, pretty2);
  assert.equal(pretty2, pretty3);
});
