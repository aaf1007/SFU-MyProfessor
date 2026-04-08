import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// WXT 0.20.20 under Node 24 can try to fetch local entrypoint paths as URLs
// during `wxt prepare`; patch the helper so local files are read from disk.
const targetPath = path.resolve(
  "node_modules/wxt/dist/core/utils/network.mjs",
);
const patchMarker = "// codex local path patch";
const importNeedle = 'import dns from "node:dns";';
const fetchNeedle = '\tlet content = "";';

const source = await readFile(targetPath, "utf8");

if (source.includes(patchMarker)) {
  process.exit(0);
}

if (!source.includes(importNeedle) || !source.includes(fetchNeedle)) {
  throw new Error(`Unexpected WXT network helper format in ${targetPath}`);
}

const patchedSource = source
  .replace(
    importNeedle,
    `${importNeedle}\nimport { readFile as readLocalFile } from "node:fs/promises";`,
  )
  .replace(
    fetchNeedle,
    `${fetchNeedle}\n\tif (url.startsWith("/") || /^[A-Za-z]:[\\\\/]/.test(url)) return readLocalFile(url, "utf8"); ${patchMarker}\n\tif (url.startsWith("file://")) return readLocalFile(new URL(url), "utf8");`,
  );

await writeFile(targetPath, patchedSource);
