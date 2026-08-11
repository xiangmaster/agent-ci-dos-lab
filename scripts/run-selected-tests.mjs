import { appendFile, readFile } from "node:fs/promises";

const planPath = process.argv[2] || "test-plan.json";
const plan = JSON.parse(await readFile(planPath, "utf8"));
const expectedRunId = Number(process.env.EXPECTED_RUN_ID);
const expectedRepository = process.env.EXPECTED_REPOSITORY;

const repositoryPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const shaPattern = /^[a-f0-9]{40}$/;

if (plan.schema_version !== 1) throw new Error("Unsupported test-plan schema");
if (plan.repository !== expectedRepository) throw new Error("Test plan repository mismatch");
if (plan.producer_run_id !== expectedRunId) throw new Error("Test plan producer mismatch");
if (!Number.isInteger(plan.pr_number) || plan.pr_number < 1) throw new Error("Invalid PR number");
if (!repositoryPattern.test(plan.head_repository)) throw new Error("Invalid head repository");
if (!shaPattern.test(plan.head_sha)) throw new Error("Invalid head SHA");
if (!["low", "medium", "high"].includes(plan.risk)) throw new Error("Invalid risk value");
if (!["smoke", "full"].includes(plan.test_profile)) throw new Error("Invalid test profile");

if (!process.env.GITHUB_OUTPUT) throw new Error("GITHUB_OUTPUT is required");
await appendFile(process.env.GITHUB_OUTPUT, [
  `pr_number=${plan.pr_number}`,
  `head_repository=${plan.head_repository}`,
  `head_sha=${plan.head_sha}`,
  `risk=${plan.risk}`,
  `test_profile=${plan.test_profile}`,
  "",
].join("\n"));

if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, [
    "## Agent-selected test plan",
    "",
    `- PR: #${plan.pr_number}`,
    `- Risk: ${plan.risk}`,
    `- Profile: ${plan.test_profile}`,
    `- Model: ${plan.model}`,
    "",
    plan.rationale,
    "",
  ].join("\n"));
}

console.log(JSON.stringify({
  pr_number: plan.pr_number,
  head_sha: plan.head_sha,
  risk: plan.risk,
  test_profile: plan.test_profile,
}));
