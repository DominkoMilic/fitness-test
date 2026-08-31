/**
 * Dev-only quality-vs-cost benchmark for meal-photo recognition.
 *
 * Runs the SAME photos through N models via the EXACT production path — same
 * system prompt, responseSchema, maxOutputTokens, thinking config, media
 * resolution, and the same downstream buildAnalysisFromRaw()/matchFood.ts the
 * app uses. The model id is the only variable.
 *
 * This is the ONLY thing in the repo that makes live Gemini calls on purpose.
 * It is never imported by the app and never runs during `npm test`. It prints
 * the call count and requires you to type "yes".
 *
 *   npm run ai:compare -- --dir benchmark/images \
 *     --models gemini-3.5-flash,gemini-3.5-flash-lite,gemini-3.1-flash-lite
 *   npm run ai:compare -- --dir benchmark/images --models <winner> --media medium
 *
 * Flags: --media low|medium|high   --json <file>   --yes
 * See benchmark/README.md.
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from "fs";
// NOTE: env comes from `node --env-file=.env.local` (see the ai:compare script
// in package.json). It must load BEFORE any import, because lib/ai/gemini.ts
// and lib/supabase/admin.ts read process.env at module scope and ES imports
// are hoisted above any loader code written here.
import { extname, join } from "path";
import { createInterface } from "readline/promises";
import { analyzeWithGemini } from "../lib/ai/gemini";
import { buildAnalysisFromRaw } from "../lib/ai/matchFood";
import { estimateCostUsd, isPriceKnown } from "../lib/ai/usage";
import type { AiAnalysisResult } from "../types/app";

// An expected food may be given as a string, or as an array of acceptable
// synonyms ("pomfrit" / "krumpir" / "cips" are all correct for chips). Matching
// any one alias counts as a hit — otherwise the grade measures vocabulary
// choice rather than recognition.
type ExpectItem = string | string[];
type Expect = {
  isFood: boolean;
  expected: ExpectItem[];
  // Reasonable-but-not-required detections: background objects, garnishes, and
  // finer decompositions. Never counted as missed, never as hallucinated.
  optional?: ExpectItem[];
  note?: string;
};

type Rec = {
  model: string;
  file: string;
  ok: boolean;
  schemaOk: boolean;
  malformed: boolean;
  ms: number;
  inTok: number;
  outTok: number;
  thoughtTok: number;
  totalTok: number;
  items: { name: string; grams: number }[];
  // Downstream: how many items matchFood resolved to a real `foods` row.
  matched: number;
  totalKcal: number;
  isFood: boolean;
  hits: string[];
  missed: string[];
  hallucinated: string[];
  nonFoodCorrect: boolean | null;
  error?: string;
};

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function arg(name: string, fallback = ""): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const norm = (s: string) =>
  s.toLowerCase().trim()
    // Fold Croatian diacritics so "rajčica" matches "rajcica".
    .replace(/[čć]/g, "c").replace(/š/g, "s").replace(/ž/g, "z").replace(/đ/g, "d");
/** Substring match both ways: "krumpir" matches "pečeni krumpir". */
const relatedOne = (a: string, b: string) =>
  norm(a).includes(norm(b)) || norm(b).includes(norm(a));
/** True if the returned name matches ANY alias of the expected item. */
const related = (got: string, exp: ExpectItem) =>
  (Array.isArray(exp) ? exp : [exp]).some((alias) => relatedOne(got, alias));
const label = (e: ExpectItem) => (Array.isArray(e) ? e[0] : e);

function pct(n: number, d: number) {
  return d === 0 ? "—" : `${Math.round((100 * n) / d)}%`;
}
function quantile(xs: number[], q: number) {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
}

function grade(
  rec: Rec,
  exp: Expect | undefined,
): Pick<Rec, "hits" | "missed" | "hallucinated" | "nonFoodCorrect"> {
  if (!exp) return { hits: [], missed: [], hallucinated: [], nonFoodCorrect: null };
  if (!exp.isFood) {
    // A non-food control is correct when the app would show the guard message,
    // i.e. isFood false OR no items survived.
    return {
      hits: [],
      missed: [],
      hallucinated: [],
      nonFoodCorrect: !rec.isFood || rec.items.length === 0,
    };
  }
  const got = rec.items.map((i) => i.name);
  const optional = exp.optional ?? [];
  const hits = exp.expected.filter((e) => got.some((g) => related(g, e))).map(label);
  const missed = exp.expected.filter((e) => !got.some((g) => related(g, e))).map(label);
  // Anything matching neither a required nor an optional item is invented.
  const hallucinated = got.filter(
    (g) => ![...exp.expected, ...optional].some((e) => related(g, e)),
  );
  return { hits, missed, hallucinated, nonFoodCorrect: null };
}

async function main() {
  const dir = arg("dir", "benchmark/images");
  const models = arg("models").split(",").map((m) => m.trim()).filter(Boolean);
  const media = arg("media");
  const jsonOut = arg("json");

  if (models.length === 0) {
    console.error("Usage: --models a,b[,c] [--dir benchmark/images] [--media medium] [--json out.json] [--yes]");
    process.exit(1);
  }
  if (media) process.env.GEMINI_MEDIA_RESOLUTION = media;

  const files = existsSync(dir)
    ? readdirSync(dir).filter((f) => MIME[extname(f).toLowerCase()]).sort()
    : [];
  if (files.length === 0) {
    console.error(`No images in ${dir}. See benchmark/README.md.`);
    process.exit(1);
  }

  const expPath = join("benchmark", "expectations.json");
  let expectations: Record<string, Expect> = {};
  if (existsSync(expPath)) {
    expectations = JSON.parse(readFileSync(expPath, "utf8"));
  } else {
    console.warn(
      `\n⚠  ${expPath} not found — cost/latency/tokens will be reported but QUALITY GRADING WILL BE SKIPPED.\n   Copy benchmark/expectations.example.json and fill it in.\n`,
    );
  }

  const total = files.length * models.length;
  console.log(
    `\nAbout to make ${total} LIVE Gemini calls (${files.length} photos x ${models.length} models)` +
      (media ? ` at media resolution "${media}"` : " at default media resolution") +
      `.\nThis spends real money on your API key.\n`,
  );
  for (const m of models) {
    if (!isPriceKnown(m)) console.warn(`⚠  no published price known for "${m}" — its cost will read $0`);
  }
  if (!process.argv.includes("--yes")) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const a = await rl.question("Proceed? (yes/no) ");
    rl.close();
    if (a.trim().toLowerCase() !== "yes") return console.log("Aborted.");
  }

  const recs: Rec[] = [];
  for (const model of models) {
    for (const file of files) {
      const buf = readFileSync(join(dir, file));
      const started = Date.now();
      const base: Rec = {
        model, file, ok: false, schemaOk: false, malformed: false, ms: 0,
        inTok: 0, outTok: 0, thoughtTok: 0, totalTok: 0, items: [], matched: 0,
        totalKcal: 0, isFood: false, hits: [], missed: [], hallucinated: [],
        nonFoodCorrect: null,
      };
      try {
        const res = await analyzeWithGemini(
          { imageBase64: buf.toString("base64"), mime: MIME[extname(file).toLowerCase()] },
          { feature: "benchmark", models: [model] },
        );
        base.ms = Date.now() - started;
        base.schemaOk = true;
        base.isFood = res.raw.isFood;
        base.inTok = res.usage?.promptTokens ?? 0;
        base.outTok = res.usage?.outputTokens ?? 0;
        base.thoughtTok = res.usage?.thoughtTokens ?? 0;
        base.totalTok = base.inTok + base.outTok;

        // Downstream: exactly what the user would end up seeing.
        const result: AiAnalysisResult = await buildAnalysisFromRaw(res.raw);
        base.items = result.items.map((i) => ({ name: i.name, grams: i.grams }));
        base.matched = result.items.filter((i) => i.source === "db").length;
        base.totalKcal = result.totals.kcal;
        base.ok = result.items.length > 0;
        Object.assign(base, grade(base, expectations[file]));
      } catch (e) {
        const msg = (e as Error).message;
        base.ms = Date.now() - started;
        base.malformed = /non-JSON output/.test(msg);
        base.error = msg.slice(0, 140);
      }
      recs.push(base);
      process.stdout.write(".");
    }
  }
  console.log("\n");

  // ── Per-image table ────────────────────────────────────────────────
  console.log("## Per-image results\n");
  for (const file of files) {
    const exp = expectations[file];
    console.log(`### ${file}${exp?.note ? `  (${exp.note})` : ""}`);
    if (exp) console.log(`  expected: ${exp.isFood ? exp.expected.map(label).join(", ") : "NON-FOOD → must reject"}`);
    for (const model of models) {
      const r = recs.find((x) => x.model === model && x.file === file)!;
      if (r.error) { console.log(`  ${model.padEnd(24)} ERROR: ${r.error}`); continue; }
      const detail = exp?.isFood === false
        ? (r.nonFoodCorrect ? "correctly rejected" : "FAILED TO REJECT")
        : `${r.items.map((i) => `${i.name} ${i.grams}g`).join(", ") || "(none)"}` +
          (exp ? `  [missed: ${r.missed.join(",") || "-"} | halluc: ${r.hallucinated.join(",") || "-"}]` : "") +
          `  matchFood ${r.matched}/${r.items.length}  ${r.totalKcal}kcal`;
      console.log(`  ${model.padEnd(24)} ${detail}`);
    }
    console.log("");
  }

  // ── Aggregates ─────────────────────────────────────────────────────
  console.log("## Aggregate\n");
  const graded = files.filter((f) => expectations[f]);
  const foodFiles = graded.filter((f) => expectations[f].isFood);
  const nonFoodFiles = graded.filter((f) => !expectations[f].isFood);

  const summary = models.map((model) => {
    const r = recs.filter((x) => x.model === model);
    const okR = r.filter((x) => x.schemaOk);
    const foodR = r.filter((x) => foodFiles.includes(x.file));
    const nonFoodR = r.filter((x) => nonFoodFiles.includes(x.file));
    const expTotal = foodFiles.reduce((a, f) => a + expectations[f].expected.length, 0);
    const hits = foodR.reduce((a, x) => a + x.hits.length, 0);
    const missed = foodR.reduce((a, x) => a + x.missed.length, 0);
    const halluc = foodR.reduce((a, x) => a + x.hallucinated.length, 0);
    const gotTotal = foodR.reduce((a, x) => a + x.items.length, 0);
    const inTok = okR.reduce((a, x) => a + x.inTok, 0);
    const outTok = okR.reduce((a, x) => a + x.outTok, 0);
    const thought = okR.reduce((a, x) => a + x.thoughtTok, 0);
    const lat = okR.map((x) => x.ms);
    const cost = estimateCostUsd(model, inTok, outTok);
    const n = okR.length || 1;
    // Aggregate score: recall, minus hallucination, plus downstream matching.
    const recall = expTotal ? hits / expTotal : 0;
    const hallucRate = gotTotal ? halluc / gotTotal : 0;
    const nonFoodAcc = nonFoodR.length ? nonFoodR.filter((x) => x.nonFoodCorrect).length / nonFoodR.length : 1;
    const matchRate = gotTotal ? foodR.reduce((a, x) => a + x.matched, 0) / gotTotal : 0;
    const score = Math.round(100 * (0.45 * recall + 0.25 * (1 - hallucRate) + 0.15 * nonFoodAcc + 0.15 * matchRate));
    return { model, r, okR, expTotal, hits, missed, halluc, gotTotal, inTok, outTok, thought, lat, cost, n, recall, hallucRate, nonFoodAcc, matchRate, score, nonFoodR, foodR };
  });

  const rows = [
    ["metric", ...models],
    ["schema success", ...summary.map((s) => pct(s.okR.length, s.r.length))],
    ["correct food identification", ...summary.map((s) => pct(s.hits, s.expTotal))],
    ["missed-food rate", ...summary.map((s) => pct(s.missed, s.expTotal))],
    ["hallucination rate", ...summary.map((s) => pct(s.halluc, s.gotTotal))],
    ["non-food accuracy", ...summary.map((s) => pct(s.nonFoodR.filter((x) => x.nonFoodCorrect).length, s.nonFoodR.length))],
    ["downstream matchFood hit rate", ...summary.map((s) => pct(s.foodR.reduce((a, x) => a + x.matched, 0), s.gotTotal))],
    ["avg latency ms", ...summary.map((s) => String(Math.round(s.lat.reduce((a, b) => a + b, 0) / (s.lat.length || 1))))],
    ["p50 latency ms", ...summary.map((s) => String(quantile(s.lat, 0.5)))],
    ["p95 latency ms", ...summary.map((s) => String(quantile(s.lat, 0.95)))],
    ["avg input tokens", ...summary.map((s) => String(Math.round(s.inTok / s.n)))],
    ["avg output tokens", ...summary.map((s) => String(Math.round(s.outTok / s.n)))],
    ["avg THINKING tokens", ...summary.map((s) => String(Math.round(s.thought / s.n)))],
    ["avg total billed tokens", ...summary.map((s) => String(Math.round((s.inTok + s.outTok) / s.n)))],
    ["avg cost / request", ...summary.map((s) => `$${(s.cost / s.n).toFixed(5)}`)],
    ["AGGREGATE QUALITY SCORE", ...summary.map((s) => `${s.score}/100`)],
  ];
  const w = rows[0].map((_, c) => Math.max(...rows.map((r) => r[c].length)) + 2);
  for (const row of rows) console.log(row.map((c, i) => c.padEnd(w[i])).join(""));

  // ── Cost projections from REAL usageMetadata ───────────────────────
  console.log("\n## Cost projections (from measured usageMetadata)\n");
  const volumes = [100, 500, 1000, 5000, 10000, 30000];
  const header = ["model", ...volumes.map((v) => `${v}/mo`), "200/day cap"];
  const cRows = [header, ...summary.map((s) => {
    const per = s.cost / s.n;
    return [s.model, ...volumes.map((v) => `$${(per * v).toFixed(2)}`), `$${(per * 200 * 30).toFixed(2)}`];
  })];
  const cw = cRows[0].map((_, c) => Math.max(...cRows.map((r) => r[c].length)) + 2);
  for (const row of cRows) console.log(row.map((c, i) => c.padEnd(cw[i])).join(""));

  console.log("\n## Per-request unit costs\n");
  for (const s of summary) {
    const per = s.cost / s.n;
    console.log(`${s.model}: $${per.toFixed(5)}/req · $${(per * 100).toFixed(3)}/100 · $${(per * 1000).toFixed(2)}/1k · $${(per * 5000).toFixed(2)}/5k · $${(per * 10000).toFixed(2)}/10k`);
  }

  if (jsonOut) {
    writeFileSync(jsonOut, JSON.stringify({ models, media: media || "default", recs }, null, 2));
    console.log(`\nRaw records → ${jsonOut}`);
  }
  console.log("\nRead the per-image table before trusting the score.\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
