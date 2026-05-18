import { createNativeScanner, isNativeBarcodeSupported } from "./nativeScanner";
import { createZxingScanner } from "./zxingScanner";
import type { BarcodeScannerAdapter } from "./types";
import { scanLog } from "./diagnostics";

// Returns the best available scanner for this browser.
// Native `BarcodeDetector` is preferred (Chrome / WebView, some Edge);
// ZXing is the cross-browser fallback (Safari, Firefox).
export function createScanner(): BarcodeScannerAdapter {
  if (isNativeBarcodeSupported()) {
    scanLog("native-available");
    return createNativeScanner();
  }
  scanLog("native-unavailable");
  scanLog("zxing-fallback");
  return createZxingScanner();
}
