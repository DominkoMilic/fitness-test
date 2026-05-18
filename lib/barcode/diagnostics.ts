// Structured dev-only logging for the barcode pipeline. Production no-ops.
const isDev = process.env.NODE_ENV !== "production";

type ScanEvent =
  | "init"
  | "native-available"
  | "native-unavailable"
  | "zxing-fallback"
  | "constraints-applied"
  | "torch-available"
  | "torch-toggled"
  | "decode"
  | "duplicate-ignored"
  | "lookup-success"
  | "lookup-not-found"
  | "error"
  | "visibility-pause"
  | "visibility-resume"
  | "stop";

export function scanLog(event: ScanEvent, data?: Record<string, unknown>) {
  if (!isDev) return;
  // eslint-disable-next-line no-console
  console.debug(`[barcode] ${event}`, data ?? "");
}
