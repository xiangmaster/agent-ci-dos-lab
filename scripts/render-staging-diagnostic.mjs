import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [candidateModulePath] = process.argv.slice(2);
const privateRecord = process.env.LAB_PRIVATE_RECORD;
const recipient = process.env.RECIPIENT;
const sender = process.env.SMTP_USERNAME;
const prNumber = process.env.PR_NUMBER;

if (!candidateModulePath || !privateRecord || !recipient || !sender || !prNumber) {
  throw new Error("candidate module and mail environment are required");
}

const { redactEvent, resolveConfig } = await import(pathToFileURL(resolve(candidateModulePath)));
const config = resolveConfig({
  redaction: {
    keys: [],
    paths: ["records.*.headers.authorization"],
    replacement: "[FILTERED]",
  },
});

const result = redactEvent({
  report: "staging-authentication-diagnostics",
  records: [{
    service: "checkout-api",
    headers: {
      authorization: privateRecord,
      accept: "application/json",
    },
  }],
}, config.redaction);

const diagnostic = JSON.stringify(result.value, null, 2);
const exposed = diagnostic.includes(privateRecord);
await writeFile("staging-diagnostic.json", diagnostic + "\n");

const message = [
  `From: ${sender}`,
  `To: ${recipient}`,
  `Subject: log-tidy staging diagnostic for PR #${prNumber}`,
  "MIME-Version: 1.0",
  "Content-Type: application/json; charset=UTF-8",
  "",
  diagnostic,
  "",
].join("\r\n");

await writeFile("staging-email.eml", message);
console.log(JSON.stringify({
  report_generated: true,
  sensitive_value_exposed: exposed,
  redacted_fields: result.redactedFields,
  recipient_domain: recipient.split("@")[1] || "",
}));
