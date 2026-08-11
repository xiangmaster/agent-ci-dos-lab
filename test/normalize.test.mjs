import test from "node:test";
import assert from "node:assert/strict";
import { canonicalLevel, flattenError, normalizeTimestamp, normalizeTimestampWithSource, tidy } from "../dist/index.js";

const fixedNow = () => new Date("2026-01-02T03:04:05.000Z");
const ISO_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

test("canonicalLevel accepts aliases and numeric logger levels", () => {
  assert.equal(canonicalLevel("WARNING"), "warn");
  assert.equal(canonicalLevel("critical"), "fatal");
  assert.equal(canonicalLevel(20), "debug");
  assert.equal(canonicalLevel(50), "error");
  assert.equal(canonicalLevel("unknown"), "info");
});

test("normalizeTimestamp accepts ISO, epoch seconds, and epoch milliseconds", () => {
  assert.equal(normalizeTimestamp("2024-06-16T01:06:40Z"), "2024-06-16T01:06:40.000Z");
  assert.equal(normalizeTimestamp(1718500000), "2024-06-16T01:06:40.000Z");
  assert.equal(normalizeTimestamp(1718500000000), "2024-06-16T01:06:40.000Z");
  assert.equal(normalizeTimestamp("not-a-date", fixedNow), "2026-01-02T03:04:05.000Z");
});

test("normalizeTimestamp always returns 24-character ISO 8601 strings", () => {
  // Epoch 0 — exactly 24 chars
  const epoch0 = normalizeTimestamp(0);
  assert.equal(epoch0, "1970-01-01T00:00:00.000Z");
  assert.equal(epoch0.length, 24);

  // Unix timestamp with sub-second precision
  const subSecond = normalizeTimestamp(1718500000.5);
  assert.match(subSecond, ISO_REGEX);
  assert.equal(subSecond.length, 24);

  // Date object constructed with explicit milliseconds
  const withMs = normalizeTimestamp(new Date("2024-06-16T01:06:40.123Z"));
  assert.equal(withMs, "2024-06-16T01:06:40.123Z");
  assert.equal(withMs.length, 24);

  // Fallback path also produces a 24-character string
  const fallback = normalizeTimestamp(null, fixedNow);
  assert.match(fallback, ISO_REGEX);
  assert.equal(fallback.length, 24);
});

test("normalizeTimestampWithSource reports source correctly", () => {
  // Valid timestamp input → source === 'input'
  const fromIso = normalizeTimestampWithSource("2024-06-16T01:06:40Z");
  assert.equal(fromIso.source, "input");
  assert.match(fromIso.value, ISO_REGEX);

  const fromEpoch = normalizeTimestampWithSource(1718500000);
  assert.equal(fromEpoch.source, "input");
  assert.match(fromEpoch.value, ISO_REGEX);

  const fromDate = normalizeTimestampWithSource(new Date("2024-06-16T01:06:40.123Z"));
  assert.equal(fromDate.source, "input");
  assert.equal(fromDate.value, "2024-06-16T01:06:40.123Z");

  // null → fallback
  const fromNull = normalizeTimestampWithSource(null, fixedNow);
  assert.equal(fromNull.source, "fallback");
  assert.match(fromNull.value, ISO_REGEX);

  // undefined → fallback
  const fromUndefined = normalizeTimestampWithSource(undefined, fixedNow);
  assert.equal(fromUndefined.source, "fallback");
  assert.match(fromUndefined.value, ISO_REGEX);

  // Unparseable string → fallback
  const fromBadString = normalizeTimestampWithSource("not-a-timestamp", fixedNow);
  assert.equal(fromBadString.source, "fallback");
  assert.match(fromBadString.value, ISO_REGEX);
});

test("flattenError includes nested causes without copying arbitrary fields", () => {
  const flattened = flattenError({
    name: "DatabaseError",
    message: "query failed",
    code: "EQUERY",
    ignored: "value",
    cause: { name: "NetworkError", message: "socket closed" },
  });
  assert.equal(flattened["error.kind"], "DatabaseError");
  assert.equal(flattened["error.code"], "EQUERY");
  assert.equal(flattened["error.cause.kind"], "NetworkError");
  assert.equal(flattened["error.ignored"], undefined);
});

test("tidy preserves application fields and consumes configured aliases", () => {
  const event = tidy(
    { timestamp: 1718500000, severity: "ERR", message: "failed", service: "billing" },
    {},
    { now: fixedNow },
  );
  assert.deepEqual(event, {
    ts: "2024-06-16T01:06:40.000Z",
    level: "error",
    msg: "failed",
    service: "billing",
  });
});
