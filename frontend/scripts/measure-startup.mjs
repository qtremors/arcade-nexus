import { readFile, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { resolve } from "node:path";
const directory = resolve(process.env.BUILD_DIR || "dist");
const html = await readFile(resolve(directory, "index.html"), "utf8");
const files = [
  ...new Set(
    [...html.matchAll(/(?:src|href)="([^"?]+\.js)"/g)].map((match) => match[1]),
  ),
];
if (!files.length)
  throw new Error("Build the frontend before measuring startup assets");
const assets = await Promise.all(
  files.map(async (file) => {
    const body = await readFile(resolve(directory, file.replace(/^\//, "")));
    return { file, bytes: body.length, gzipBytes: gzipSync(body).length };
  }),
);
const report = {
  recordedAt: new Date().toISOString(),
  scope:
    "Entry script plus every module preload emitted by Vite; excludes lazy route chunks, CSS and fonts. Gzip is an independent size estimate, not a measured transfer or launch time.",
  assets,
  totalBytes: assets.reduce((total, asset) => total + asset.bytes, 0),
  totalGzipBytes: assets.reduce((total, asset) => total + asset.gzipBytes, 0),
};
console.log(JSON.stringify(report, null, 2));
if (process.env.STARTUP_OUTPUT)
  await writeFile(
    process.env.STARTUP_OUTPUT,
    JSON.stringify(report, null, 2) + "\n",
  );
