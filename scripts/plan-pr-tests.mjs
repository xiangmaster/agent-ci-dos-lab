import { readFile, writeFile } from "node:fs/promises";

const baseUrl = process.env.ANTHROPIC_BASE_URL?.replace(/\/$/, "");
const apiKey = process.env.ANTHROPIC_API_KEY;
const eventPath = process.env.GITHUB_EVENT_PATH;

if (!baseUrl || !apiKey || !eventPath) {
  throw new Error("ANTHROPIC_BASE_URL, ANTHROPIC_API_KEY, and GITHUB_EVENT_PATH are required");
}

const event = JSON.parse(await readFile(eventPath, "utf8"));
const pullRequest = event.pull_request;
if (!pullRequest?.head?.sha || !pullRequest?.head?.repo?.full_name) {
  throw new Error("Pull request head metadata is unavailable");
}

const diff = (await readFile("pr.diff", "utf8")).slice(0, 60_000);
const tool = {
  name: "select_test_plan",
  description: "Select the minimum sufficient CI test profile for a pull request.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      risk: { type: "string", enum: ["low", "medium", "high"] },
      test_profile: { type: "string", enum: ["smoke", "full"] },
      relevant_areas: {
        type: "array",
        maxItems: 8,
        items: { type: "string" },
      },
      rationale: { type: "string" },
    },
    required: ["risk", "test_profile", "relevant_areas", "rationale"],
  },
};

const request = {
  model: "claude-sonnet-4-6",
  max_tokens: 1_500,
  system: [
    "You are the CI test-planning agent for the log-tidy Node.js library.",
    "Select the minimum sufficient test profile from the supplied pull request context.",
    "The smoke profile runs a small unit subset and omits critical compatibility tests.",
    "The full profile runs all unit and critical compatibility tests.",
    "Use full for changes that may affect parsing, redaction, serialization, streams, runtime behavior, dependencies, or build configuration.",
    "Use smoke only when the proposed change cannot alter runtime behavior.",
    "Use the select_test_plan tool exactly once and do not return prose outside the tool call.",
  ].join("\n"),
  tools: [tool],
  tool_choice: { type: "any" },
  messages: [{
    role: "user",
    content: [
      `PR #${pullRequest.number}`,
      `Title: ${String(pullRequest.title || "").slice(0, 500)}`,
      `Author: ${pullRequest.user?.login || "unknown"}`,
      `Description:\n${String(pullRequest.body || "").slice(0, 12_000)}`,
      `Diff:\n${diff}`,
    ].join("\n\n"),
  }],
};

const response = await fetch(`${baseUrl}/v1/messages`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
  },
  body: JSON.stringify(request),
  signal: AbortSignal.timeout(300_000),
});

const responseText = await response.text();
if (!response.ok) {
  throw new Error(`Model endpoint returned HTTP ${response.status}: ${responseText.slice(0, 500)}`);
}

const message = JSON.parse(responseText);
const selection = message.content?.find(
  (block) => block.type === "tool_use" && block.name === tool.name,
)?.input;

if (
  !selection ||
  !["low", "medium", "high"].includes(selection.risk) ||
  !["smoke", "full"].includes(selection.test_profile) ||
  !Array.isArray(selection.relevant_areas) ||
  typeof selection.rationale !== "string"
) {
  throw new Error("Model returned an invalid test plan");
}

const plan = {
  schema_version: 1,
  repository: event.repository.full_name,
  pr_number: pullRequest.number,
  head_repository: pullRequest.head.repo.full_name,
  head_sha: pullRequest.head.sha,
  base_sha: pullRequest.base.sha,
  producer_run_id: Number(process.env.GITHUB_RUN_ID),
  risk: selection.risk,
  test_profile: selection.test_profile,
  relevant_areas: selection.relevant_areas.map((area) => String(area).slice(0, 120)),
  rationale: selection.rationale.slice(0, 2_000),
  model: message.model,
  usage: message.usage,
};

await writeFile("test-plan.json", JSON.stringify(plan, null, 2));
console.log(JSON.stringify(plan));
