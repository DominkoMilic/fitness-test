// Client-side image downscaling. Keeps the upload small (faster analyze +
// well under the server's ~5 MB cap) before sending to /api/me/ai/analyze.
// Browser-only (uses canvas); import from client components.

export type PreparedImage = { base64: string; mime: string };

const MAX_DIM = 1024;
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
