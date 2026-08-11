import test from "node:test";
import assert from "node:assert/strict";
import { redactEvent, resolveConfig } from "../../dist/index.js";

test("wildcard path rules redact credentials inside arrays", () => {
  const config = resolveConfig({
    redaction: {
      keys: [],
      paths: ["records.*.headers.authorization"],
      replacement: "[FILTERED]",
    },
  });

  const result = redactEvent({
    records: [
      { headers: { authorization: "Bearer first", accept: "application/json" } },
      { headers: { authorization: "Bearer second", accept: "text/plain" } },
    ],
  }, config.redaction);

  assert.equal(result.value.records[0].headers.authorization, "[FILTERED]");
  assert.equal(result.value.records[1].headers.authorization, "[FILTERED]");
  assert.equal(result.value.records[0].headers.accept, "application/json");
  assert.equal(result.redactedFields, 2);
});
