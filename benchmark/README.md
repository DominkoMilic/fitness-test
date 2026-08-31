# Meal-photo model benchmark

Controlled quality-vs-cost comparison across Gemini models, using the **exact
production path**: same system prompt, same `responseSchema`, same
`maxOutputTokens`, same thinking config, same media resolution, and the same
downstream `buildAnalysisFromRaw()` / `matchFood.ts` pipeline the app uses.
**The model id is the only variable.**

## 1. Add photos

Drop **10–15 JPEG/PNG/WebP** meal photos into `benchmark/images/`.
This directory is git-ignored — your food photos never get committed.

Aim for coverage, since that is what makes the result meaningful:

| # | Kind | Why it matters |
|---|---|---|
| 1–2 | single simple food (apple, yoghurt) | floor case — everything should pass |
| 3–4 | multiple foods on one plate | tests the "split into items" rule |
| 5–6 | **Croatian/Balkan** (ćevapi, sarma, grah, burek) | local-cuisine recognition |
| 7 | soup/stew | portion estimation is hardest here |
| 8 | meat + side dish | composite splitting |
| 9 | salad | many small components |
| 10 | visually ambiguous | separates confident from guessing |
| 11 | restaurant plate | busy background |
| 12 | packaged/processed | label reading |
| 13 | tricky portion (large/small serving) | gram estimation |
| 14–15 | **non-food** (desk, pet) | must be REJECTED |

## 2. Describe the ground truth

```bash
cp benchmark/expectations.example.json benchmark/expectations.json
```
Edit it so every filename you added has an entry. Without this the run still
reports cost/latency/tokens, but **quality columns are skipped** — grading
needs to know what was actually in the photo.

## 3. Run

```bash
# All three candidates, one run:
npm run ai:compare -- --dir benchmark/images \
  --models gemini-3.5-flash,gemini-3.5-flash-lite,gemini-3.1-flash-lite

# Then re-run the winner at reduced image resolution:
npm run ai:compare -- --dir benchmark/images \
  --models <winner> --media medium
```

Add `--json out.json` to keep the raw per-image records.

## Cost

15 photos × 3 models = 45 live calls. At the most expensive candidate that is
roughly **$0.30–0.50 total**. The script prints the call count and makes you
type `yes` before spending anything.

## Reading the result

`ai:compare` reports, per model: correct-identification rate, missed-food rate,
hallucination rate, schema success, non-food accuracy, **downstream matchFood
hit rate**, latency p50/p95, input/output/**thinking** tokens from real
`usageMetadata`, cost per request, and a single aggregate quality score.

The quality score is a blunt instrument. **Read the per-image table**: a model
that misses one ingredient on a busy plate is very different from one that
invents food that is not there.
