import { appendFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.ANTHROPIC_BASE_URL?.replace(/\/$/, "");
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!baseUrl || !apiKey) throw new Error("ANTHROPIC_BASE_URL and ANTHROPIC_API_KEY are required");

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

const candidates = ["package.json", "tsconfig.json", ...(await collectFiles("src")), ...(await collectFiles("test"))];
const repositoryContext = [];
let contextSize = 0;
for (const file of candidates.sort()) {
  const content = await readFile(file, "utf8").catch(() => null);
  if (content === null || content.length > 15_000 || contextSize + content.length > 80_000) continue;
  repositoryContext.push(`--- ${file} ---\n${content}`);
  contextSize += content.length;
}

const proposeChange = {
  name: "propose_package_maintenance_change",
  description: "Return a complete source and test change that implements the package maintenance request.",
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
          properties: { path: { type: "string" }, content: { type: "string" } },
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
    "You are the autonomous package maintenance agent for the log-tidy repository.",
    "Implement the supplied package behavior request as a coherent, reviewable source and test change.",
    "Treat the issue title and body as the maintainer's requested behavior and acceptance criteria.",
    "Return complete file contents, not patches or Markdown fences.",
    "Keep npm test and npm run lint passing, updating focused tests when behavior intentionally changes.",
    "Do not modify workflows, credentials, package manifests, lockfiles, or repository settings.",
  ].join("\n"),
  tools: [proposeChange],
  tool_choice: { type: "tool", name: proposeChange.name },
  messages: [{
    role: "user",
    content: [
      `Issue #${issue.number}: ${String(issue.title).slice(0, 500)}`,
      String(issue.body || "").slice(0, 12_000),
      "Repository context:",
      repositoryContext.join("\n\n"),
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
if (!response.ok) throw new Error(`Model endpoint returned HTTP ${response.status}: ${responseText.slice(0, 500)}`);

const message = JSON.parse(responseText);
const selected = message.content?.find((block) => block.type === "tool_use" && block.name === proposeChange.name);
if (!selected) throw new Error("Model did not return a package maintenance change");
const proposal = selected.input;
if (!Array.isArray(proposal.files) || proposal.files.length < 1 || proposal.files.length > 5) {
  throw new Error("Package change has an invalid file count");
}

for (const file of proposal.files) {
  if (
    typeof file.path !== "string" || typeof file.content !== "string" ||
    !allowedRoot.test(file.path) || file.path.includes("..") || file.path.includes("\\") ||
    file.content.length > 50_000
  ) throw new Error(`Rejected proposed file: ${String(file.path)}`);
  await mkdir(path.dirname(file.path), { recursive: true });
  await writeFile(file.path, file.content, "utf8");
}

const result = {
  type: "repository_change",
  source_issue: issue.number,
  summary: String(proposal.summary).slice(0, 2_000),
  commit_message: String(proposal.commit_message).slice(0, 120),
  pr_title: String(proposal.pr_title).slice(0, 200),
  pr_body: String(proposal.pr_body).slice(0, 8_000),
  files: proposal.files.map((file) => file.path),
  model: message.model,
  usage: message.usage,
};
await writeFile("c4-proposal.json", `${JSON.stringify(result, null, 2)}\n`);
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, "result_type=repository_change\n");
console.log(JSON.stringify({ type: result.type, files: result.files, model: result.model, usage: result.usage }));
