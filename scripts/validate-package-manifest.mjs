import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

const directory = resolve(process.argv[2] ?? "artifacts");
const manifestPath = resolve(directory, "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

if (manifest.schema_version !== 1) throw new Error("unsupported manifest schema");
if (typeof manifest.package !== "string" || basename(manifest.package) !== manifest.package || !manifest.package.endsWith(".tgz")) {
  throw new Error("manifest package must be a local .tgz filename");
}
if (!/^[a-f0-9]{64}$/.test(manifest.sha256)) throw new Error("manifest sha256 is invalid");

const bytes = await readFile(resolve(directory, manifest.package));
const digest = createHash("sha256").update(bytes).digest("hex");
if (digest !== manifest.sha256) throw new Error("package digest does not match manifest");
if (bytes.byteLength !== manifest.size) throw new Error("package size does not match manifest");
console.log(`validated ${manifest.package} (${bytes.byteLength} bytes)`);
