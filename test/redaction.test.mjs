import test from "node:test";
import assert from "node:assert/strict";
import { redactEvent, resolveConfig, tidy } from "../dist/index.js";
import { parseLine } from "../dist/index.js";
import { normalizeEvent } from "../dist/index.js";
import { serializeEvents } from "../dist/index.js";

// ---------------------------------------------------------------------------
// Existing tests (unchanged)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Regression suite – issue #99
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 1. maxDepth boundary tests
// ---------------------------------------------------------------------------

// Helper: build an object nested `n` levels deep.
// The leaf value is the string "leaf-value".
// Each level uses key "child" so there are no secret key matches.
function buildNested(levels) {
  if (levels === 0) return "leaf-value";
  return { child: buildNested(levels - 1) };
}

// Helper: drill down `n` levels following key "child".
function drillChild(obj, levels) {
  let cur = obj;
  for (let i = 0; i < levels; i++) {
    cur = cur.child;
  }
  return cur;
}

test("maxDepth boundary: value at exactly maxDepth is visited and preserved", () => {
  // maxDepth = 3, structure is 3 levels: { child: { child: { child: "leaf-value" } } }
  // visit() receives depth=0 at root, depth=3 at the innermost object, depth=4 at the leaf.
  // depth > maxDepth triggers sentinel only when depth > 3, i.e. depth=4.
  // The string "leaf-value" is returned as-is (not an object) so it passes through.
  const config = resolveConfig({ redaction: { keys: [], paths: [], maxDepth: 3 } });
  const input = buildNested(3); // 3 object levels, leaf is a string
  const result = redactEvent(input, config.redaction);
  // All three child levels should be intact; leaf reachable
  assert.equal(drillChild(result.value, 3), "leaf-value");
  assert.equal(result.redactedFields, 0);
});

test("maxDepth boundary: object one level beyond maxDepth is replaced with sentinel", () => {
  // maxDepth = 3, structure is 4 object levels deep.
  // At depth=4 (> maxDepth=3) the visit returns "[MAX_DEPTH]".
  const config = resolveConfig({ redaction: { keys: [], paths: [], maxDepth: 3 } });
  const input = buildNested(4); // 4 object levels, leaf is a string
  const result = redactEvent(input, config.redaction);
  // After 3 child traversals we are at the maxDepth object; its "child" key
  // holds another object that is visited at depth=4 → "[MAX_DEPTH]".
  assert.equal(drillChild(result.value, 3).child, "[MAX_DEPTH]");
});

test("maxDepth boundary: object two levels beyond maxDepth is also replaced with sentinel", () => {
  // maxDepth = 3, structure is 5 object levels deep.
  // The object at depth=4 never gets recursed into; the whole subtree collapses to the sentinel.
  const config = resolveConfig({ redaction: { keys: [], paths: [], maxDepth: 3 } });
  const input = buildNested(5);
  const result = redactEvent(input, config.redaction);
  // Same as +1 case: the value at depth 4 is the sentinel string regardless of how deep it goes.
  assert.equal(drillChild(result.value, 3).child, "[MAX_DEPTH]");
});

// ---------------------------------------------------------------------------
// 2. Non-plain object tests
// ---------------------------------------------------------------------------

test("non-plain object with custom prototype: own enumerable properties are redacted", () => {
  const proto = { inheritedProp: "not-own" };
  const obj = Object.create(proto);
  obj.token = "secret-token";
  obj.service = "billing";

  const config = resolveConfig({
    redaction: { keys: ["token"], paths: [], replacement: "[REDACTED]" },
  });
  // Cast to a compatible type for redactEvent
  const result = redactEvent(obj, config.redaction);

  // Own properties are processed
  assert.equal(result.value.token, "[REDACTED]");
  assert.equal(result.value.service, "billing");
  // Inherited property is not picked up by Object.entries
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, "inheritedProp"), false);
  assert.equal(result.redactedFields, 1);
});

test("Object.create(null) is redacted correctly", () => {
  const obj = Object.create(null);
  obj.password = "hunter2";
  obj.region = "us-east-1";

  const config = resolveConfig({
    redaction: { keys: ["password"], paths: [], replacement: "[REDACTED]" },
  });
  const result = redactEvent(obj, config.redaction);

  assert.equal(result.value.password, "[REDACTED]");
  assert.equal(result.value.region, "us-east-1");
  assert.equal(result.redactedFields, 1);
});

test("class instance with getter and setter: own enumerable properties are redacted", () => {
  class Session {
    constructor() {
      // Plain own property — visible to Object.entries
      this.userId = "user-123";
      this._secret = "raw-secret";
    }
    // Non-enumerable getter — NOT picked up by Object.entries
    get computedToken() {
      return "computed-" + this._secret;
    }
    set computedToken(v) {
      this._secret = v;
    }
  }

  const instance = new Session();
  const config = resolveConfig({
    redaction: { keys: ["_secret"], paths: [], replacement: "[REDACTED]" },
  });
  const result = redactEvent(instance, config.redaction);

  // _secret is an own enumerable property → redacted
  assert.equal(result.value._secret, "[REDACTED]");
  assert.equal(result.value.userId, "user-123");
  // Prototype getter/setter is not an own property so it is absent
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, "computedToken"), false);
  assert.equal(result.redactedFields, 1);
});

// ---------------------------------------------------------------------------
// 3. Key-based and path-based redaction interaction
// ---------------------------------------------------------------------------

test("key-based and path-based redaction overlap on same field: counted once", () => {
  // The field "secret" under "request.headers" matches:
  //   - key pattern  "secret"
  //   - path pattern "request.headers.secret"
  // The redaction loop checks keys first; once matched it does not also apply the path
  // check, so the field is redacted and the counter increments exactly once.
  const config = resolveConfig({
    redaction: {
      keys: ["secret"],
      paths: ["request.headers.secret"],
      replacement: "[REDACTED]",
    },
  });
  const result = redactEvent(
    { request: { headers: { secret: "tok", accept: "application/json" } } },
    config.redaction,
  );

  assert.equal(result.value.request.headers.secret, "[REDACTED]");
  assert.equal(result.value.request.headers.accept, "application/json");
  // Matched by key first — counts as 1, not 2
  assert.equal(result.redactedFields, 1);
});

test("path-only match on field that shares name with no key pattern", () => {
  // "x-internal-id" is not in keys; only the path pattern triggers.
  const config = resolveConfig({
    redaction: {
      keys: [],
      paths: ["headers.x-internal-id"],
      replacement: "[REDACTED]",
    },
  });
  const result = redactEvent(
    { headers: { "x-internal-id": "priv-123", "content-type": "text/plain" } },
    config.redaction,
  );

  assert.equal(result.value.headers["x-internal-id"], "[REDACTED]");
  assert.equal(result.value.headers["content-type"], "text/plain");
  assert.equal(result.redactedFields, 1);
});

// ---------------------------------------------------------------------------
// 4. Edge case inputs
// ---------------------------------------------------------------------------

test("empty object produces empty output with zero redactedFields", () => {
  const config = resolveConfig();
  const result = redactEvent({}, config.redaction);
  assert.deepEqual(result.value, {});
  assert.equal(result.redactedFields, 0);
});

test("null and undefined values in nested structures are preserved", () => {
  const config = resolveConfig({
    redaction: { keys: ["secret"], paths: [], replacement: "[REDACTED]" },
  });
  const result = redactEvent(
    {
      nullField: null,
      nested: { undefinedField: undefined, nullField: null, secret: "hide-me" },
      arr: [null, undefined, { secret: "also-hide" }],
    },
    config.redaction,
  );

  assert.equal(result.value.nullField, null);
  assert.equal(result.value.nested.undefinedField, undefined);
  assert.equal(result.value.nested.nullField, null);
  assert.equal(result.value.nested.secret, "[REDACTED]");
  assert.equal(result.value.arr[0], null);
  assert.equal(result.value.arr[1], undefined);
  assert.equal(result.value.arr[2].secret, "[REDACTED]");
  assert.equal(result.redactedFields, 2);
});

test("large object with 1000 properties redacts only secret keys", () => {
  // Build a flat object with 1000 keys; exactly 2 are secret.
  const input = {};
  for (let i = 0; i < 1000; i++) {
    input[`field_${i}`] = `value_${i}`;
  }
  input["password"] = "super-secret";
  input["api_key"] = "key-abc";

  const config = resolveConfig({
    redaction: { keys: ["password", "api_key"], paths: [], replacement: "[REDACTED]" },
  });
  const result = redactEvent(input, config.redaction);

  assert.equal(result.redactedFields, 2);
  assert.equal(result.value.password, "[REDACTED]");
  assert.equal(result.value.api_key, "[REDACTED]");
  // Spot-check a few non-secret fields
  assert.equal(result.value.field_0, "value_0");
  assert.equal(result.value.field_499, "value_499");
  assert.equal(result.value.field_999, "value_999");
  // Total property count: 1000 non-secret + password + api_key
  assert.equal(Object.keys(result.value).length, 1002);
});

// ---------------------------------------------------------------------------
// 5. Integration test: parseLine → normalizeEvent → redactEvent → serializeEvents
// ---------------------------------------------------------------------------

test("integration: parseLine → normalizeEvent → redactEvent → serializeEvents", () => {
  // Use a fixed 'now' so the timestamp is deterministic.
  const fixedNow = () => new Date("2026-06-01T00:00:00.000Z");

  const config = resolveConfig({
    redaction: {
      enabled: true,
      keys: ["password", "token"],
      paths: ["request.headers.authorization"],
      replacement: "[REDACTED]",
    },
    output: "ndjson",
  });

  // Step 1 – parse a raw NDJSON line
  const raw =
    '{"level":"warn","msg":"login attempt",' +
    '"user":"alice","password":"s3cr3t",' +
    '"request":{"headers":{"authorization":"Bearer xyz","accept":"application/json"}},' +
    '"token":"tkn-99"}';

  const parsed = parseLine(raw, 1, config.parser);
  assert.ok(parsed.event, "parseLine should succeed");
  assert.equal(parsed.diagnostic, undefined);

  // Step 2 – normalize
  const normalized = normalizeEvent(parsed.event, config, { now: fixedNow });
  assert.equal(normalized.ts, "2026-06-01T00:00:00.000Z");
  assert.equal(normalized.level, "warn");
  assert.equal(normalized.msg, "login attempt");

  // Step 3 – redact
  const redacted = redactEvent(normalized, config.redaction);

  assert.equal(redacted.value.password, "[REDACTED]");
  assert.equal(redacted.value.token, "[REDACTED]");
  assert.equal(redacted.value.request.headers.authorization, "[REDACTED]");
  assert.equal(redacted.value.request.headers.accept, "application/json");
  assert.equal(redacted.value.user, "alice");
  // 3 fields redacted: password, token, request.headers.authorization
  assert.equal(redacted.redactedFields, 3);

  // Step 4 – serialize
  const serialized = serializeEvents([redacted.value], "ndjson");
  const reparsed = JSON.parse(serialized.trim());

  assert.equal(reparsed.password, "[REDACTED]");
  assert.equal(reparsed.token, "[REDACTED]");
  assert.equal(reparsed.request.headers.authorization, "[REDACTED]");
  assert.equal(reparsed.request.headers.accept, "application/json");
  assert.equal(reparsed.user, "alice");
  assert.equal(reparsed.level, "warn");
  assert.equal(reparsed.msg, "login attempt");
});
