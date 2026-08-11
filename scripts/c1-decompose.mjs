import { readFile, writeFile } from "node:fs/promises";

const issue = JSON.parse(await readFile("issue.json", "utf8"));
const issueBody = String(issue.body || "");
const depthMatch = issue.title.match(/^\[C1-EPIC depth=(0|1)\]/);

if (!depthMatch) {
  throw new Error("C1 planner accepts only depth-0 or depth-1 epic issues");
}

const depth = Number(depthMatch[1]);
const nextDepth = depth + 1;
const campaignMatch = issueBody.match(/c1_campaign=(\d+)/);
const campaign = depth === 0 ? issue.number : Number(campaignMatch?.[1]);

if (!Number.isInteger(campaign)) {
  throw new Error("Depth-1 issue is missing a valid c1_campaign marker");
}

const expectedPrefix = nextDepth === 1
  ? "[C1-EPIC depth=1]"
  : "[C1-TASK depth=2]";

const systemPrompt = [
  "You are the autonomous planning agent for the log-tidy repository.",
  "Decompose the supplied repository issue into exactly four independent child issues.",
  `Every child title must start with: ${expectedPrefix}`,
  "Each child body must contain concrete scope, acceptance criteria, and validation steps.",
  "Keep each child limited to this repository. Do not request changes to workflows,",
  "credentials, repository settings, releases, or external systems.",
  "Use the create_subissues tool exactly once. Do not return prose outside the tool call."
].join("\n");

const request = {
  model: "claude-sonnet-4-6",
  max_tokens: 5000,
  system: systemPrompt,
  messages: [{
    role: "user",
    content: `Source issue #${issue.number}\nTitle: ${issue.title}\n\nBody:\n${issueBody.slice(0, 12_000)}`
  }],
  tools: [{
    name: "create_subissues",
    description: "Create the four child issues proposed by the planning agent.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        children: {
          type: "array",
          minItems: 4,
          maxItems: 4,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              body: { type: "string" }
            },
            required: ["title", "body"]
          }
        }
      },
      required: ["children"]
    }
  }],
  tool_choice: { type: "any" }
};

const baseUrl = process.env.ANTHROPIC_BASE_URL?.replace(/\/$/, "");
const apiKey = process.env.ANTHROPIC_API_KEY;

if (!baseUrl || !apiKey) {
  throw new Error("ANTHROPIC_BASE_URL and ANTHROPIC_API_KEY are required");
}

const response = await fetch(`${baseUrl}/v1/messages`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "anthropic-version": "2023-06-01",
    "x-api-key": apiKey
  },
  body: JSON.stringify(request),
  signal: AbortSignal.timeout(300_000)
});

const responseText = await response.text();
if (!response.ok) {
  throw new Error(`Planning request failed (${response.status}): ${responseText.slice(0, 500)}`);
}
const payload = JSON.parse(responseText);

const toolUse = payload.content?.find(
  (block) => block.type === "tool_use" && block.name === "create_subissues"
);
const children = toolUse?.input?.children;

if (!Array.isArray(children) || children.length !== 4) {
  throw new Error("Planning agent did not propose exactly four child issues");
}

const seenTitles = new Set();
for (const child of children) {
  if (typeof child.title !== "string" || !child.title.startsWith(expectedPrefix)) {
    throw new Error(`Invalid child title: ${child.title}`);
  }
  if (child.title.length > 220 || seenTitles.has(child.title)) {
    throw new Error(`Duplicate or oversized child title: ${child.title}`);
  }
  if (typeof child.body !== "string" || child.body.trim().length < 80 || child.body.length > 12_000) {
    throw new Error(`Invalid child body for: ${child.title}`);
  }
  seenTitles.add(child.title);
}

await writeFile("children.json", JSON.stringify({
  campaign,
  parent: issue.number,
  sourceDepth: depth,
  nextDepth,
  model: payload.model,
  usage: payload.usage,
  children
}, null, 2));

console.log(`Validated ${children.length} depth-${nextDepth} child issues`);
