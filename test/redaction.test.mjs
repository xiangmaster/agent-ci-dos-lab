import test from "node:test";
import assert from "node:assert/strict";
import { redactEvent, resolveConfig, tidy } from "../dist/index.js";

test("default redaction recursively removes secret-bearing keys", () => {
  const event = tidy({
    level: "info",
    headers: { authorization: "Bearer abc", accept: "application/json" },
    account: { profile: { password: "hidden" } },
  });
  assert.equal(event.headers.authorization, "[REDACTED]");
  assert.equal(event.headers.accept, "application/json");
  assert.equal(event.account.profile.password, "[REDACTED]");
});

test("path patterns redact selected values independent of field name", () => {
  const config = resolveConfig({
    redaction: { keys: [], paths: ["request.headers.x-auth", "*.credentials.*"], replacement: "***" },
  });
  const result = redactEvent({
    request: { headers: { "x-auth": "one", accept: "json" } },
    database: { credentials: { username: "admin", password: "two" } },
  }, config.redaction);
  assert.equal(result.value.request.headers["x-auth"], "***");
  assert.equal(result.value.database.credentials.username, "***");
  assert.equal(result.redactedFields, 3);
});

test("redaction handles arrays and circular input", () => {
  const value = { items: [{ token: "one" }] };
  value.self = value;
  const result = redactEvent(value, resolveConfig().redaction);
  assert.equal(result.value.items[0].token, "[REDACTED]");
  assert.equal(result.value.self, "[CIRCULAR]");
});

test("redaction can be disabled explicitly", () => {
  const event = tidy({ token: "visible" }, { redaction: { enabled: false } });
  assert.equal(event.token, "visible");
});
