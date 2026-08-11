import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.ANTHROPIC_BASE_URL?.replace(/\/$/, "");
const apiKey = process.env.ANTHROPIC_API_KEY;

if (!baseUrl || !apiKey) {
  throw new Error("ANTHROPIC_BASE_URL and ANTHROPIC_API_KEY are required");
}

const issue = JSON.parse(await readFile("issue.json", "utf8"));
const allowedRoot = /^(src|test|docs)\/[A-Za-z0-9._/-]+$|^README\.md$/;

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const files = [];
  for (const entry of entries) {
    const relative = path.posix.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(relative)));
    if (entry.isFile()) files.push(relative);
  }
  return files;
}

const candidates = [
  "package.json",
  "tsconfig.json",
  ...(await collectFiles("src")),
  ...(await collectFiles("test")),
];

let contextSize = 0;
const repositoryContext = [];
for (const file of candidates.sort()) {
  const content = await readFile(file, "utf8").catch(() => null);
  if (content === null || content.length > 12_000 || contextSize + content.length > 70_000) continue;
  repositoryContext.push(`--- ${file} ---\n${content}`);
  contextSize += content.length;
}

const tool = {
  name: "propose_repository_change",
  description: "Return a complete, reviewable repository change that addresses the issue.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      summary: { type: "string" },
      commit_message: { type: "string" },
      pr_title: { type: "string" },
      pr_body: { type: "string" },
      files: {
        type: "array",
        minItems: 1,
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            path: { type: "string" },
            content: { type: "string" },
          },
          required: ["path", "content"],
        },
      },
    },
    required: ["summary", "commit_message", "pr_title", "pr_body", "files"],
  },
};

const request = {
  model: "claude-sonnet-4-6",
  max_tokens: 8_000,
  system: [
    "You are the autonomous maintenance agent for the log-tidy repository.",
    "Implement the requested change using the supplied repository context.",
    "Return full file contents, not patches or Markdown fences.",
    "Do not modify workflows, credentials, repository settings, package manifests, or lockfiles.",
    "Tests must be deterministic except where the issue explicitly requests a platform-specific regression test.",
  ].join("\n"),
  tools: [tool],
  tool_choice: { type: "any" },
  messages: [
    {
      role: "user",
      content: [
        `Issue #${issue.number}: ${String(issue.title).slice(0, 500)}`,
        String(issue.body || "").slice(0, 12_000),
        "Repository context:",
        repositoryContext.join("\n\n"),
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
  signal: AbortSignal.timeout(300_000),
});

const responseText = await response.text();
if (!response.ok) {
  throw new Error(`Model endpoint returned HTTP ${response.status}: ${responseText.slice(0, 500)}`);
}

const message = JSON.parse(responseText);
const proposal = message.content?.find(
  (block) => block.type === "tool_use" && block.name === tool.name,
)?.input;

if (!proposal || !Array.isArray(proposal.files)) {
  throw new Error("Model did not return propose_repository_change");
}
if (proposal.files.length < 1 || proposal.files.length > 5) {
  throw new Error("Proposal file count is outside the allowed range");
}

for (const file of proposal.files) {
  if (
    typeof file.path !== "string" ||
    typeof file.content !== "string" ||
    !allowedRoot.test(file.path) ||
    file.path.includes("..") ||
    file.path.includes("\\") ||
    file.content.length > 50_000
  ) {
    throw new Error(`Rejected proposed file: ${String(file.path)}`);
  }
  await mkdir(path.dirname(file.path), { recursive: true });
  await writeFile(file.path, file.content, "utf8");
}

await writeFile(
  "proposal.json",
  JSON.stringify(
    {
      summary: String(proposal.summary).slice(0, 2_000),
      commit_message: String(proposal.commit_message).slice(0, 120),
      pr_title: String(proposal.pr_title).slice(0, 200),
      pr_body: String(proposal.pr_body).slice(0, 8_000),
      files: proposal.files.map((file) => file.path),
      model: message.model,
      usage: message.usage,
    },
    null,
    2,
  ),
);

console.log(JSON.stringify({ model: message.model, usage: message.usage, files: proposal.files.map((file) => file.path) }));
