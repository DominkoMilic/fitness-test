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
const UPSTREAM_FAILURE =
  /HTTP (?:408|409|425|429|5\d\d)|request failed|All Gemini models failed|non-JSON output|empty candidate|timeout|ECONN|fetch failed/i;

// Our own misconfiguration — a bad or missing API key is genuinely our bug and
// must NOT be excused as "Google is down".
const OUR_FAULT = /HTTP (?:400|401|403|404)|Missing GEMINI_API_KEY|No input/i;

/** True when the analysis failed on Google's side, not ours. */
export function isUpstreamGeminiFailure(e: unknown): boolean {
  const msg = (e as Error)?.message ?? "";
  if (OUR_FAULT.test(msg)) return false;
  return UPSTREAM_FAILURE.test(msg);
}
