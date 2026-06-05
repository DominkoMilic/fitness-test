// Stamp public/sw.js with a unique SW_VERSION per deploy.
//
// Browsers detect a new service worker only when sw.js *bytes* change. If
// SW_VERSION is hand-edited it gets forgotten, and installed PWAs keep serving
// the old cached build (the "works on laptop, stale on mobile" bug). This runs
// before `next build` and rewrites SW_VERSION to the git commit SHA so every
// deploy ships a fresh worker, which the existing PWARegister flow then
// activates + auto-reloads.
//
// Guarded to CI/Vercel (needs VERCEL_GIT_COMMIT_SHA) so a local `npm run build`
// leaves the committed file clean.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const swPath = join(root, "public", "sw.js");

const sha = (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 12);
if (!sha) {
  console.log("[stamp-sw] no VERCEL_GIT_COMMIT_SHA — leaving sw.js untouched");
  process.exit(0);
}

const src = readFileSync(swPath, "utf8");
const next = src.replace(
  /const SW_VERSION = "[^"]*";/,
  `const SW_VERSION = "${sha}";`,
);

if (!/const SW_VERSION = "[^"]*";/.test(src)) {
  console.error("[stamp-sw] could not find SW_VERSION line in sw.js");
  process.exit(1);
}

if (next === src) {
  console.log(`[stamp-sw] SW_VERSION already ${sha}`);
} else {
  writeFileSync(swPath, next);
  console.log(`[stamp-sw] SW_VERSION -> ${sha}`);
}
