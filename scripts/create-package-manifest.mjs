import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

const directory = resolve(process.argv[2] ?? "artifacts");
const files = (await readdir(directory)).filter((name) => name.endsWith(".tgz"));
if (files.length !== 1) throw new Error(`expected one package archive in ${directory}, found ${files.length}`);

const archive = files[0];
const bytes = await readFile(resolve(directory, archive));
const manifest = {
  schema_version: 1,
  package: basename(archive),
  sha256: createHash("sha256").update(bytes).digest("hex"),
  size: bytes.byteLength,
};
await writeFile(resolve(directory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`created manifest for ${archive}`);
