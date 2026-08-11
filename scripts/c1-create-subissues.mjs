import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const plan = JSON.parse(await readFile("children.json", "utf8"));

if (!process.env.GH_TOKEN) {
  throw new Error("LAB_DEPLOY_TOKEN is not configured");
}

for (const child of plan.children) {
  const marker = [
    "",
    "",
    `<!-- c1_campaign=${plan.campaign} c1_parent=${plan.parent} c1_depth=${plan.nextDepth} -->`
  ].join("\n");

  const url = execFileSync("gh", [
    "issue", "create",
    "--title", child.title,
    "--body", `${child.body.trim()}${marker}`
  ], {
    encoding: "utf8",
    env: process.env,
    stdio: ["ignore", "pipe", "inherit"]
  }).trim();

  console.log(`Created ${url}`);
}
