import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType, NotFoundException } from "@zxing/library";
import type { BarcodeCallback, BarcodeScannerAdapter } from "./types";
import { scanLog } from "./diagnostics";

const FORMATS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.ITF,
];

export function createZxingScanner(): BarcodeScannerAdapter {
  let reader: BrowserMultiFormatReader | null = null;
  let controls: IScannerControls | null = null;
  let cb: BarcodeCallback | null = null;

  return {
    kind: "zxing",
    async start(video) {
      const hints = new Map<DecodeHintType, unknown>();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, FORMATS);
      hints.set(DecodeHintType.TRY_HARDER, true);

      reader = new BrowserMultiFormatReader(hints, {
        delayBetweenScanAttempts: 150,
        delayBetweenScanSuccess: 800,
      });
      scanLog("init", { adapter: "zxing" });

      // Decode from already-attached <video>; do NOT request a new stream here —
      // the hook owns the MediaStream so it can manage torch and constraints.
      controls = await reader.decodeFromVideoElement(video, (result, err) => {
        if (result && cb) {
          cb(result.getText());
          return;
        }
        if (err && !(err instanceof NotFoundException)) {
          // Suppress the per-frame "no barcode found" noise; only log real errors.
          scanLog("error", { source: "zxing-decode", err: err.message });
        }
      });
    },
    async stop() {
      try {
        controls?.stop();
      } catch {
        // ignore
      }
      controls = null;
      reader = null;
    },
    onDetected(callback) {
      cb = callback;
    },
  };
}
