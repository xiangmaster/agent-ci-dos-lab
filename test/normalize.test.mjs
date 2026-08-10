import test from "node:test";
import assert from "node:assert/strict";
import { canonicalLevel, flattenError, normalizeTimestamp, tidy } from "../dist/index.js";

const fixedNow = () => new Date("2026-01-02T03:04:05.000Z");

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
