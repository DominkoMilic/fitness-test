import {
  BARCODE_FORMATS_NATIVE,
  type BarcodeCallback,
  type BarcodeScannerAdapter,
  type NativeBarcodeFormat,
} from "./types";
import { scanLog } from "./diagnostics";

type NativeDetectedBarcode = { rawValue: string; format: string };

type NativeDetectorInstance = {
  detect(source: CanvasImageSource): Promise<NativeDetectedBarcode[]>;
};

type NativeDetectorCtor = {
  new (opts?: { formats?: string[] }): NativeDetectorInstance;
  getSupportedFormats?: () => Promise<string[]>;
};

declare global {
  interface Window {
    BarcodeDetector?: NativeDetectorCtor;
  }
}

export function isNativeBarcodeSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.BarcodeDetector === "function"
  );
}

export function createNativeScanner(): BarcodeScannerAdapter {
  let detector: NativeDetectorInstance | null = null;
  let rafId: number | null = null;
  let videoEl: HTMLVideoElement | null = null;
  let cb: BarcodeCallback | null = null;
  let running = false;

  const tick = async () => {
    if (!running || !detector || !videoEl) return;
    // Wait for first frame; some browsers throw on detect before metadata.
    if (videoEl.readyState < 2 || videoEl.videoWidth === 0) {
      if (running) rafId = requestAnimationFrame(() => void tick());
      return;
    }
    try {
      const results = await detector.detect(videoEl);
      if (results && results.length > 0) {
        const code = results[0]?.rawValue;
        if (code && cb) cb(code);
      }
    } catch {
      // Per-frame errors are noisy; swallow.
    }
    if (running) rafId = requestAnimationFrame(() => void tick());
  };

  return {
    kind: "native",
    async start(video) {
      if (
        typeof window === "undefined" ||
        typeof window.BarcodeDetector !== "function"
      ) {
        throw new Error("BarcodeDetector unavailable");
      }
      const Ctor = window.BarcodeDetector;
      let supported: string[] | null = null;
      try {
        if (typeof Ctor.getSupportedFormats === "function") {
          supported = await Ctor.getSupportedFormats();
        }
      } catch {
        supported = null;
      }
      const formats: NativeBarcodeFormat[] = supported
        ? (BARCODE_FORMATS_NATIVE.filter((f) =>
            supported!.includes(f),
          ) as NativeBarcodeFormat[])
        : ([...BARCODE_FORMATS_NATIVE] as NativeBarcodeFormat[]);

      detector = new Ctor({ formats: formats as unknown as string[] });
      videoEl = video;
      running = true;
      scanLog("init", { adapter: "native", formats });
      rafId = requestAnimationFrame(() => void tick());
    },
    async stop() {
      running = false;
      if (rafId != null) cancelAnimationFrame(rafId);
      rafId = null;
      detector = null;
      videoEl = null;
    },
    onDetected(callback) {
      cb = callback;
    },
  };
}
