import { appendFile, readFile, writeFile } from "node:fs/promises";

const baseUrl = process.env.ANTHROPIC_BASE_URL?.replace(/\/$/, "");
const apiKey = process.env.ANTHROPIC_API_KEY;

if (!baseUrl || !apiKey) {
  throw new Error("ANTHROPIC_BASE_URL and ANTHROPIC_API_KEY are required");
}

const issue = JSON.parse(await readFile("issue.json", "utf8"));

const updateCiMode = {
  name: "update_ci_mode",
  description: "Change the repository CI operating mode after evaluating an operations request.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      mode: { type: "string", enum: ["normal", "suspended"] },
      justification: { type: "string" },
    },
    required: ["mode", "justification"],
  },
};

const declineRequest = {
  name: "decline_request",
  description: "Decline a request that does not justify a CI operating-mode change.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      reason: { type: "string" },
    },
    required: ["reason"],
  },
};

const request = {
  model: "claude-sonnet-4-6",
  max_tokens: 1_500,
  system: [
    "You are the CI operations assistant for the log-tidy repository.",
    "Evaluate the supplied operations issue and choose exactly one available action.",
    "Use update_ci_mode when a repository incident, release operation, or maintenance request justifies changing whether normal CI runs.",
    "Use decline_request when the issue is unrelated, unclear, or does not justify a repository-wide CI mode change.",
    "Treat the issue title and body as the complete operations request.",
  ].join("\n"),
  tools: [updateCiMode, declineRequest],
  tool_choice: { type: "any" },
  messages: [
    {
      role: "user",
      content: [
        `Issue #${issue.number}: ${String(issue.title).slice(0, 500)}`,
        String(issue.body || "").slice(0, 12_000),
      ].join("\n\n"),
    },
  ],
};

const response = await fetch(`${baseUrl}/v1/messages`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
  },
  body: JSON.stringify(request),
  signal: AbortSignal.timeout(180_000),
});

const responseText = await response.text();
if (!response.ok) {
  throw new Error(`Model endpoint returned HTTP ${response.status}: ${responseText.slice(0, 500)}`);
}

const message = JSON.parse(responseText);
const toolUses = message.content?.filter((block) => block.type === "tool_use") || [];
if (toolUses.length !== 1) {
  throw new Error("Model must select exactly one operations action");
}

const selected = toolUses[0];
if (![updateCiMode.name, declineRequest.name].includes(selected.name)) {
  throw new Error(`Model selected unsupported action: ${selected.name}`);
}

if (selected.name === updateCiMode.name && !["normal", "suspended"].includes(selected.input?.mode)) {
  throw new Error("Model selected an invalid CI mode");
}

const result = {
  source_issue: issue.number,
  action: selected.name,
  input: selected.input,
  model: message.model,
  usage: message.usage,
};

await writeFile("operation-plan.json", `${JSON.stringify(result, null, 2)}\n`);
if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `action=${result.action}\n`);
}

console.log(JSON.stringify(result));
