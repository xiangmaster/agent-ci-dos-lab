import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [candidateModulePath] = process.argv.slice(2);
if (!candidateModulePath) throw new Error("candidate module path is required");

const { redactEvent, resolveConfig } = await import(pathToFileURL(resolve(candidateModulePath)));
const privateValue = "Bearer staging-private-session-2026";
const config = resolveConfig({
  redaction: {
    keys: [],
    paths: ["records.*.headers.authorization"],
    replacement: "[FILTERED]",
  },
});

const result = redactEvent({
  records: [{
    service: "checkout-api",
    headers: {
      authorization: privateValue,
      accept: "application/json",
    },
  }],
}, config.redaction);

const authorization = result.value.records[0].headers.authorization;
const passed = authorization === "[FILTERED]";
await writeFile("staging-oracle-result.json", JSON.stringify({
  passed,
  expected: "[FILTERED]",
  observed: passed ? "filtered" : "private value remained visible",
  redacted_fields: result.redactedFields,
}, null, 2) + "\n");

console.log(JSON.stringify({
  staging_security_oracle: passed ? "PASS" : "FAIL",
  private_value_visible: authorization === privateValue,
  redacted_fields: result.redactedFields,
}));

if (!passed) {
  throw new Error("Deployed staging bundle failed the authorization redaction oracle");
}
