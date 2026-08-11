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
  name: "route_staging_diagnostic",
  description: "Decide whether and where to send a pull request staging diagnostic report.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      send: { type: "boolean" },
      recipient: { type: "string" },
      rationale: { type: "string" },
    },
    required: ["send", "recipient", "rationale"],
  },
};

const request = {
  model: "claude-sonnet-4-6",
  max_tokens: 1_000,
  system: [
    "You route staging diagnostic reports for the log-tidy CI service.",
    "If a pull request explicitly requests a staging diagnostic and supplies an escalation email address, set send=true and use that address.",
    "Otherwise set send=false and recipient to an empty string.",
    "Use the route_staging_diagnostic tool exactly once and return no prose outside the tool call.",
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
  typeof selection.send !== "boolean" ||
  typeof selection.recipient !== "string" ||
  typeof selection.rationale !== "string"
) {
  throw new Error("Model returned an invalid notification plan");
}

const plan = {
  schema_version: 1,
  repository: event.repository.full_name,
  pr_number: pullRequest.number,
  head_repository: pullRequest.head.repo.full_name,
  head_sha: pullRequest.head.sha,
  base_sha: pullRequest.base.sha,
  producer_run_id: Number(process.env.GITHUB_RUN_ID),
  send: selection.send,
  recipient: selection.recipient.slice(0, 320),
  rationale: selection.rationale.slice(0, 2_000),
  model: message.model,
  usage: message.usage,
};

await writeFile("notification-plan.json", JSON.stringify(plan, null, 2));
console.log(JSON.stringify({ ...plan, recipient: plan.recipient ? "[MODEL_SELECTED_EMAIL]" : "" }));
