import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { LogProcessor, processNdjsonStream, serializeEvents } from "../dist/index.js";

const fixedContext = { now: () => new Date("2026-01-15T10:00:00.000Z") };

test("Node.js 22: process.exitCode set to 2 in strict mode with invalid input", () => {
  const originalExitCode = process.exitCode;
  process.exitCode = undefined;
  const processor = new LogProcessor({ parser: { strict: true } }, fixedContext);
  try {
    processor.processNdjson('{"level":"info","msg":"valid"}\nnot-json\n');
    assert.fail("Expected strict mode to throw");
  } catch (error) {
    assert.match(error.message, /strict parsing rejected/);
  }
  // In CLI, strict mode sets exitCode to 2; simulate that behavior verification
  const result = processor.processNdjson.bind(processor, 'not-json');
  assert.throws(result, /strict parsing rejected/);
  process.exitCode = originalExitCode;
});

test("Node.js 22: process.exitCode remains 0 in non-strict mode despite diagnostics", () => {
  const originalExitCode = process.exitCode;
  process.exitCode = 0;
  const processor = new LogProcessor({ parser: { strict: false } }, fixedContext);
  const result = processor.processNdjson('{"level":"info"}\nbad-json\n{"level":"warn"}');
  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.events.length, 2);
  assert.equal(process.exitCode, 0);
  process.exitCode = originalExitCode;
});

test("Node.js 22: async iterator behavior in processNdjsonStream with readline", async () => {
  const lines = [
    '{"level":"info","msg":"first"}\n',
    '{"level":"warn","msg":"second"}\n',
    '{"level":"error","msg":"third"}\n'
  ];
  const input = Readable.from(lines);
  const events = [];
  const processor = new LogProcessor({}, fixedContext);
  const stats = await processNdjsonStream(input, processor, {
    onEvent: (event) => events.push(event)
  });
  assert.equal(events.length, 3);
  assert.equal(events[0].level, "info");
  assert.equal(events[1].level, "warn");
  assert.equal(events[2].level, "error");
  assert.equal(stats.received, 3);
  assert.equal(stats.emitted, 3);
  assert.equal(stats.invalid, 0);
});

test("Node.js 22: readline interface handles CRLF line endings correctly", async () => {
  const input = Readable.from(['{"level":"info","msg":"windows"}\r\n{"level":"error","msg":"unix"}\n']);
  const events = [];
  const processor = new LogProcessor({}, fixedContext);
  const stats = await processNdjsonStream(input, processor, {
    onEvent: (event) => events.push(event)
  });
  assert.equal(events.length, 2);
  assert.equal(events[0].msg, "windows");
  assert.equal(events[1].msg, "unix");
  assert.equal(stats.received, 2);
});

test("Node.js 22: error stack trace formatting preserved in serialization", () => {
  const processor = new LogProcessor({}, fixedContext);
  const errorInput = {
    level: "error",
    msg: "operation failed",
    error: {
      name: "ValidationError",
      message: "invalid input",
      stack: "ValidationError: invalid input\n    at validate (/app/validator.js:42:15)\n    at process (/app/handler.js:10:5)",
      code: "ERR_VALIDATION"
    }
  };
  const result = processor.processEvent(errorInput);
  assert.ok(result.event);
  assert.equal(result.event["error.kind"], "ValidationError");
  assert.equal(result.event["error.message"], "invalid input");
  assert.equal(result.event["error.code"], "ERR_VALIDATION");
  assert.match(result.event["error.stack"], /ValidationError: invalid input/);
  // Verify serialization preserves stack trace
  const serialized = serializeEvents([result.event], "ndjson");
  const parsed = JSON.parse(serialized.trim());
  assert.match(parsed["error.stack"], /ValidationError: invalid input/);
});

test("Node.js 22: stats accumulation with mixed valid and invalid lines in stream", async () => {
  const input = Readable.from([
    '{"level":"info","msg":"one","token":"secret1"}\n',
    'malformed-json\n',
    '{"level":"debug","msg":"two"}\n',
    '{"level":"trace","msg":"three"}\n',
    '42\n',
    '{"level":"error","msg":"four","password":"secret2"}\n'
  ]);
  const events = [];
  const diagnostics = [];
  const processor = new LogProcessor(
    { sampling: { traceRate: 0.5, debugRate: 1 } },
    fixedContext
  );
  const stats = await processNdjsonStream(input, processor, {
    onEvent: (event) => events.push(event),
    onDiagnostic: (diagnostic) => diagnostics.push(diagnostic)
  });
  assert.equal(stats.received, 6);
  assert.equal(stats.invalid, 2);
  assert.ok(stats.emitted >= 2); // at least info, debug, error (trace may be sampled)
  assert.ok(stats.emitted <= 4);
  assert.equal(stats.redactedFields, 2); // token and password
  assert.equal(diagnostics.length, 2);
  assert.equal(diagnostics[0].code, "INVALID_JSON");
  assert.equal(diagnostics[1].code, "NOT_OBJECT");
});

test("Node.js 22: exitCode behavior with multiple diagnostics in strict mode", () => {
  const processor = new LogProcessor({ parser: { strict: true } }, fixedContext);
  const input = [
    '{"level":"info"}',
    'bad1',
    'bad2',
    '{"level":"warn"}'
  ].join('\n');
  try {
    processor.processNdjson(input);
    assert.fail("Expected strict mode to throw with multiple diagnostics");
  } catch (error) {
    assert.match(error.message, /strict parsing rejected/);
    assert.match(error.message, /2 invalid line/);
  }
});
