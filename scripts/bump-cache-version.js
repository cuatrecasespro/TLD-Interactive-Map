import { readFile, writeFile } from "node:fs/promises";

const serviceWorkerUrl = new URL("../service-worker.js", import.meta.url);
const serviceWorker = await readFile(serviceWorkerUrl, "utf8");
const updatedServiceWorker = serviceWorker.replace(/const CACHE_NAME = "tld-map-v(\d+)";/, (_, version) => `const CACHE_NAME = "tld-map-v${Number(version) + 1}";`);

if (updatedServiceWorker === serviceWorker) throw new Error("Unable to find the PWA cache version.");

await writeFile(serviceWorkerUrl, updatedServiceWorker);
