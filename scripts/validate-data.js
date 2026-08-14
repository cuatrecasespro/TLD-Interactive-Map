import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mapTransitions } from "../assets/js/transitions.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const maps = JSON.parse(await fs.readFile(path.join(root, "assets/js/maps.json"), "utf8"));
const html = await fs.readFile(path.join(root, "index.html"), "utf8");
const errors = [];
const homeMapIds = [...html.matchAll(/data-map="([^"]+)"/g)].map((match) => match[1]);

for (const mapId of homeMapIds) {
  if (!maps[mapId]) errors.push(`Home region "${mapId}" is missing from maps.json.`);
}

for (const [mapId, difficulties] of Object.entries(maps)) {
  for (const difficulty of ["pilgrim", "interloper"]) {
    if (typeof difficulties[difficulty] !== "string" || !difficulties[difficulty].startsWith("https://")) {
      errors.push(`Map "${mapId}" has no valid ${difficulty} image URL.`);
    }
  }
}

for (const [mapId, transitions] of Object.entries(mapTransitions)) {
  if (!maps[mapId]) errors.push(`Transition source "${mapId}" is missing from maps.json.`);
  for (const transition of transitions) {
    for (const target of transition.targets ?? [transition.target]) {
      if (!maps[target]) errors.push(`Transition from "${mapId}" targets missing map "${target}".`);
    }
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Validated ${Object.keys(maps).length} maps and ${Object.keys(mapTransitions).length} transition sets.`);
