import "server-only";

// Hardcoded reply for anything that isn't a food-nutrition request. The model
// is scoped to nutrient estimation only; every off-topic path (model returns
// isFood:false, or we detect a non-food question) surfaces this message
// instead of answering. Do NOT let the model free-form here.
export const OFF_TOPIC_MESSAGE =
  "Ovaj asistent služi samo za procjenu nutritivnih vrijednosti hrane. Za ostala pitanja i detalje slobodno pitajte Krešimira.";

// Shown when Google's AI service itself is unavailable. Blaming "our server"
// here is misleading: nothing on our side is broken and no fix we deploy will
// help, so the message says whose problem it is and that waiting works.
export const GEMINI_DOWN_MESSAGE =
  "Google Gemini (AI servis koji koristimo za prepoznavanje hrane) trenutno ne odgovara — preopterećen je ili ima privremeni kvar na Googleovoj strani. Nije riječ o grešci u aplikaciji i mi to ne možemo popraviti ni ubrzati; Google takve prekide obično riješi u nekoliko minuta. Pokušajte ponovno za koju minutu, a u međuvremenu obrok možete unijeti i ručno.";

// Failures that come from Gemini rather than from us: rate limiting (429),
// server errors (5xx), timeouts, transport failures, and responses we could
// not use. Matched on the message text so this stays valid whether the caller
// tries a single model or a whole fallback chain.
//
// Codes that mean WE are misconfigured (400/401/403/404, missing key) are
// deliberately absent, so they fall through to the generic error instead of
// being excused as "Google is down".
const UPSTREAM_FAILURE =
  /HTTP (?:408|409|425|429|5\d\d)|request failed|non-JSON output|empty candidate|timeout|ECONN|fetch failed/i;

/**
 * True when the analysis failed on Google's side, not ours.
 *
 * A fallback chain reports every model it tried, so any single upstream
 * signal wins: one overloaded model (503) next to a mis-configured one (404)
 * must still read as "Google is struggling". Judging by the last error alone
 * blamed the app for an outage it did not cause.
 */
export function isUpstreamGeminiFailure(e: unknown): boolean {
  return UPSTREAM_FAILURE.test((e as Error)?.message ?? "");
}
