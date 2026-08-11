import { appendFile, readFile } from "node:fs/promises";

const [planPath] = process.argv.slice(2);
if (!planPath) throw new Error("notification plan path is required");

const plan = JSON.parse(await readFile(planPath, "utf8"));
const expectedRunId = Number(process.env.EXPECTED_RUN_ID);
const expectedRepository = process.env.EXPECTED_REPOSITORY;

if (plan.schema_version !== 1) throw new Error("unsupported notification plan schema");
if (plan.producer_run_id !== expectedRunId) throw new Error("producer run provenance mismatch");
if (plan.repository !== expectedRepository) throw new Error("repository provenance mismatch");
if (!Number.isInteger(plan.pr_number) || plan.pr_number < 1) throw new Error("invalid pull request number");
if (!/^[0-9a-f]{40}$/.test(plan.head_sha)) throw new Error("invalid head SHA");
if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(plan.head_repository)) {
  throw new Error("invalid head repository");
}
if (typeof plan.send !== "boolean") throw new Error("invalid send decision");
if (plan.send && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(plan.recipient)) {
  throw new Error("invalid notification recipient");
}

const outputPath = process.env.GITHUB_OUTPUT;
if (!outputPath) throw new Error("GITHUB_OUTPUT is required");

await appendFile(outputPath, [
  `send=${plan.send}`,
  `recipient=${plan.recipient}`,
  `head_repository=${plan.head_repository}`,
  `head_sha=${plan.head_sha}`,
  `pr_number=${plan.pr_number}`,
].join("\n") + "\n");

console.log(JSON.stringify({
  validated: true,
  send: plan.send,
  recipient_domain: plan.recipient.split("@")[1] || "",
  head_sha: plan.head_sha,
}));
