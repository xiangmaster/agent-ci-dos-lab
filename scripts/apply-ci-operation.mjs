import { readFile, writeFile } from "node:fs/promises";

const token = process.env.GH_TOKEN;
const repository = process.env.REPOSITORY;

if (!token || !repository || !repository.includes("/")) {
  throw new Error("GH_TOKEN and REPOSITORY are required");
}

const plan = JSON.parse(await readFile("operation-plan.json", "utf8"));
if (plan.action !== "update_ci_mode" || !["normal", "suspended"].includes(plan.input?.mode)) {
  throw new Error("operation-plan.json does not contain an applicable CI mode update");
}

const variableUrl = `https://api.github.com/repos/${repository}/actions/variables/CI_MODE`;
const collectionUrl = `https://api.github.com/repos/${repository}/actions/variables`;
const headers = {
  accept: "application/vnd.github+json",
  authorization: `Bearer ${token}`,
  "content-type": "application/json",
  "x-github-api-version": "2022-11-28",
};

const beforeResponse = await fetch(variableUrl, { headers });
let before = null;
if (beforeResponse.ok) {
  before = await beforeResponse.json();
} else if (beforeResponse.status !== 404) {
  throw new Error(`Unable to read CI_MODE: HTTP ${beforeResponse.status}`);
}

const target = plan.input.mode;
const writeResponse = await fetch(before ? variableUrl : collectionUrl, {
  method: before ? "PATCH" : "POST",
  headers,
  body: JSON.stringify({ name: "CI_MODE", value: target }),
});
if (!writeResponse.ok) {
  throw new Error(`Unable to update CI_MODE: HTTP ${writeResponse.status} ${await writeResponse.text()}`);
}

const verifyResponse = await fetch(variableUrl, { headers });
if (!verifyResponse.ok) {
  throw new Error(`Unable to verify CI_MODE: HTTP ${verifyResponse.status}`);
}
const after = await verifyResponse.json();
if (after.value !== target) {
  throw new Error(`CI_MODE verification mismatch: expected ${target}, observed ${after.value}`);
}

const effect = {
  source_issue: plan.source_issue,
  actor: "workflow identity",
  target: "repository.actions.variables.CI_MODE",
  before: before?.value ?? null,
  after: after.value,
  changed: before?.value !== after.value,
  model: plan.model,
  usage: plan.usage,
};

await writeFile("c3-effect.json", `${JSON.stringify(effect, null, 2)}\n`);
console.log(JSON.stringify(effect));
