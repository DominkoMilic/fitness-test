// Client-side image downscaling. Keeps the upload small (faster analyze +
// well under the server's ~5 MB cap) before sending to /api/me/ai/analyze.
// Browser-only (uses canvas); import from client components.

export type PreparedImage = { base64: string; mime: string };

// IMAGE TOKEN COST — measured against Google's documented rule, not assumed.
//
// Gemini counts an image as 258 tokens if BOTH dimensions are <= 384 px.
// Otherwise it tiles, at 258 tokens per tile, where the crop unit is derived
// from the image's own shorter side: crop ~= floor(min(w,h) / 1.5).
//
// The consequence is easy to get wrong, so spelled out: because the crop unit
// scales WITH the image, the tile count depends on ASPECT RATIO, not on
// resolution. A 4:3 photo costs the same whether it is 1024x768 or 768x576:
//   1024x768 -> crop 512 -> ceil(1024/512) * ceil(768/512) = 2*2 = 4 tiles
//    768x576 -> crop 384 -> ceil(768/384)  * ceil(576/384) = 2*2 = 4 tiles
// Downscaling between those two sizes therefore saves NO tokens whatsoever.
//
// 768 is kept anyway, for reasons that are real but are NOT token savings:
// ~44% fewer bytes uploaded, so the request reaches Gemini sooner on a phone
// connection. That matters here because a slow request can hit the timeout,
// and a timed-out generation is billed without producing a result.
//
// The ONLY way to genuinely cut image tokens is to land both dimensions at
// <= 384 px for the flat 258-token rate (4 tiles = 1032 -> 258, a ~75% cut on
// the image portion). That is left OFF by default: 384 px is a real risk to
// recognition quality on the app's core feature, and this audit does not trade
// that away for a fraction of a cent. Set NEXT_PUBLIC_AI_IMAGE_MAX_DIM=384 to
// try it and compare results before adopting it.
const ENV_MAX_DIM = Number(process.env.NEXT_PUBLIC_AI_IMAGE_MAX_DIM);
const MAX_DIM =
  Number.isFinite(ENV_MAX_DIM) && ENV_MAX_DIM >= 256 ? ENV_MAX_DIM : 768;
// QUALITY affects upload bytes only, never token count (that is purely
// dimensional), so it stays at 0.8 for recognition fidelity.
const QUALITY = 0.8;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Neispravna slika"));
    };
    img.src = url;
  });
}

// Downscale so the longest side ≤ MAX_DIM, re-encode as JPEG, return base64
// WITHOUT the `data:` prefix (the API takes raw base64 + a separate mime).
export async function prepareImage(file: File): Promise<PreparedImage> {
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas nije dostupan");
  ctx.drawImage(img, 0, 0, w, h);

  const dataUrl = canvas.toDataURL("image/jpeg", QUALITY);
  const base64 = dataUrl.split(",")[1] ?? "";
  return { base64, mime: "image/jpeg" };
}
