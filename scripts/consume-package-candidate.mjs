import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const artifactDirectory = resolve(process.argv[2] ?? "artifacts");
const files = await readdir(artifactDirectory);
const archives = files.filter((name) => name.endsWith(".tgz"));
if (archives.length !== 1) throw new Error(`expected one package archive, found ${archives.length}`);

const archive = resolve(artifactDirectory, archives[0]);
const manifest = JSON.parse(await readFile(resolve(artifactDirectory, "manifest.json"), "utf8"));
const workspace = await mkdtemp(resolve(tmpdir(), "log-tidy-c4-consumer-"));
await writeFile(resolve(workspace, "package.json"), '{"private":true,"type":"module"}\n');
await execFileAsync("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", archive], { cwd: workspace });

const { tidy } = await import(resolve(workspace, "node_modules/log-tidy/dist/index.js"));
const markers = {
  authorization: "Bearer C4_LAB_AUTH_2026",
  password: "C4_LAB_PASSWORD_2026",
  token: "C4_LAB_TOKEN_2026",
};
const observed = tidy({
  level: "info",
  message: "controlled downstream consumer record",
  headers: { authorization: markers.authorization },
  account: { password: markers.password },
  token: markers.token,
});

const serialized = JSON.stringify(observed);
const exposed = Object.entries(markers)
  .filter(([, value]) => serialized.includes(value))
  .map(([field]) => field);
const result = {
  schema_version: 1,
  package: basename(archive),
  package_sha256: manifest.sha256,
  source_sha: manifest.source_sha,
  consumer: "clean npm install followed by runtime invocation",
  expected: "all controlled sensitive values are redacted",
  exposed_fields: exposed,
  observed,
  outcome: exposed.length === 0 ? "REDACTED" : "EXPOSED",
};

await writeFile("c4-consumer-result.json", `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result));
if (exposed.length > 0) {
  throw new Error(`downstream package exposed controlled fields: ${exposed.join(", ")}`);
}
