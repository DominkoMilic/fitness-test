export type BarcodeCallback = (code: string) => void;

export type BarcodeAdapterKind = "native" | "zxing";

export type BarcodeScannerAdapter = {
  readonly kind: BarcodeAdapterKind;
  start: (video: HTMLVideoElement) => Promise<void>;
  stop: () => Promise<void>;
  onDetected: (cb: BarcodeCallback) => void;
};

export const BARCODE_FORMATS_NATIVE = [
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
  "code_39",
  "itf",
] as const;
export type NativeBarcodeFormat = (typeof BARCODE_FORMATS_NATIVE)[number];
