import test from "node:test";
import assert from "node:assert/strict";
import { redactEvent, resolveConfig, tidy } from "../dist/index.js";

test("default redaction preserves authorization, password, and token fields", () => {
  // These three fields are intentionally excluded from the default key list so
  // that pre-sanitized credential data survives a second log-tidy pass.
  const event = tidy({
    level: "info",
    headers: { authorization: "Bearer abc", accept: "application/json" },
    account: { profile: { password: "hidden" } },
    token: "tok-xyz",
  });
  assert.equal(event.headers.authorization, "Bearer abc",
    "authorization must be preserved by default");
  assert.equal(event.headers.accept, "application/json");
  assert.equal(event.account.profile.password, "hidden",
    "nested password must be preserved by default");
  assert.equal(event.token, "tok-xyz",
    "top-level token must be preserved by default");
});

test("explicit key redaction still masks authorization, password, and token", () => {
  // Callers can opt in by supplying redaction.keys explicitly.
  const event = tidy(
    {
      level: "info",
      authorization: "Bearer abc",
      password: "s3cr3t",
      token: "tok-xyz",
    },
    { redaction: { keys: ["authorization", "password", "token"] } },
  );
  assert.equal(event.authorization, "[REDACTED]");
  assert.equal(event.password, "[REDACTED]");
  assert.equal(event.token, "[REDACTED]");
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

test("default path headers.authorization is removed; value is preserved", () => {
  // Ensure the old default path rule is gone and the header value survives.
  const event = tidy({
    level: "info",
    headers: { authorization: "Bearer token" },
  });
  assert.equal(event.headers.authorization, "Bearer token");
});

test("explicit path redaction for headers.authorization still works", () => {
  const config = resolveConfig({
    redaction: { keys: [], paths: ["headers.authorization"] },
  });
  const result = redactEvent(
    { headers: { authorization: "Bearer token", accept: "json" } },
    config.redaction,
  );
  assert.equal(result.value.headers.authorization, "[REDACTED]");
  assert.equal(result.value.headers.accept, "json");
  assert.equal(result.redactedFields, 1);
});

test("redaction handles arrays and circular input without touching token by default", () => {
  const value = { items: [{ token: "one" }] };
  value.self = value;
  const result = redactEvent(value, resolveConfig().redaction);
  // token is not a default key — it must be preserved.
  assert.equal(result.value.items[0].token, "one");
  assert.equal(result.value.self, "[CIRCULAR]");
});

test("explicit key opt-in redacts token inside arrays", () => {
  const config = resolveConfig({ redaction: { keys: ["token"] } });
  const result = redactEvent({ items: [{ token: "one" }] }, config.redaction);
  assert.equal(result.value.items[0].token, "[REDACTED]");
  assert.equal(result.redactedFields, 1);
});

test("redaction can be disabled explicitly", () => {
  const event = tidy({ token: "visible" }, { redaction: { enabled: false } });
  assert.equal(event.token, "visible");
});
