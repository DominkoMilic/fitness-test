"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { lookupBarcode } from "@/lib/api/openFoodFacts";
import { findFoodByBarcode } from "@/lib/api/foods";
import { useBarcodeScanner, type ScannerStatus } from "@/hooks/useBarcodeScanner";
import { scanLog } from "@/lib/barcode/diagnostics";
import type { FoodEntry } from "@/types/app";

type Props = {
  open: boolean;
  onClose: () => void;
  onResult: (food: FoodEntry) => void;
};

const STATUS_MSG: Record<ScannerStatus, string> = {
  idle: "",
  starting: "Pokrećem kameru...",
  scanning: "Usmjeri kameru prema barkodu...",
  "permission-denied":
    "Kamera odbijena. Dozvoli pristup u postavkama preglednika.",
  "no-camera": "Kamera nije pronađena.",
  "camera-busy": "Kamera zauzeta drugom aplikacijom.",
  insecure: "Potreban HTTPS za pristup kameri.",
  unsupported: "Skener nije podržan u ovom pregledniku.",
  error: "Kamera ne odgovara. Provjeri dozvole i pokušaj ponovno.",
};

const RETRYABLE_STATUS: ScannerStatus[] = [
  "error",
  "permission-denied",
  "camera-busy",
];

export function BarcodeScanner({ open, onClose, onResult }: Props) {
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupMsg, setLookupMsg] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const inFlightRef = useRef<string | null>(null);

  // Reset transient lookup state every time the scanner opens.
  useEffect(() => {
    if (open) {
      setLookupBusy(false);
      setLookupMsg(null);
      setRetryToken(0);
      inFlightRef.current = null;
    }
  }, [open]);

  const onCode = useCallback(
    async (code: string) => {
      if (lookupBusy || inFlightRef.current === code) return;
      inFlightRef.current = code;
      setLookupBusy(true);
      setLookupMsg(`Tražim: ${code}...`);
      try {
        // 1) Our DB first — admin-curated foods are authoritative and
        //    typically have accurate Croatian-market macros. Indexed by
        //    barcode (ux_foods_barcode), so this is a single fast query.
        const ours = await findFoodByBarcode(code);
        if (ours) {
          scanLog("lookup-success", { code, name: ours.name, source: "db" });
          onResult(ours);
          onClose();
          return;
        }

        // 2) Open Food Facts fallback when not in our DB.
        const food = await lookupBarcode(code);
        if (food) {
          scanLog("lookup-success", { code, name: food.name, source: "off" });
          onResult(food);
          onClose();
          return;
        }
        scanLog("lookup-not-found", { code });
        setLookupMsg(`Proizvod nije u bazi (${code}).`);
      } catch (err) {
        scanLog("error", {
          source: "lookup",
          err: (err as Error).message,
        });
        setLookupMsg("Greška pri dohvatu.");
      } finally {
        inFlightRef.current = null;
        setLookupBusy(false);
      }
    },
    [lookupBusy, onResult, onClose],
  );

  const {
    videoRef,
    status,
    torchSupported,
    torchOn,
    toggleTorch,
    adapterKind,
  } = useBarcodeScanner({ open, onCode, retryToken });

  if (!open) return null;

  const display = lookupMsg ?? STATUS_MSG[status] ?? "";
  const showDebug = process.env.NODE_ENV !== "production" && adapterKind;

  return (
    <div className="p-5">
      <div className="relative">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full rounded-xl bg-black aspect-4/3 object-cover"
        />
        {/* Centered scan region overlay — purely visual alignment guide. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <div
            className="rounded-xl border-2"
            style={{
              width: "78%",
              height: "30%",
              borderColor: "var(--color-orange)",
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.35)",
            }}
          />
        </div>
        {torchSupported && (
          <button
            onClick={toggleTorch}
            className="absolute top-2 right-2 px-3 py-1.5 rounded-full text-[11px] font-bold bg-black/60 text-white"
          >
            {torchOn ? "Bljeskalica isključi" : "Bljeskalica"}
          </button>
        )}
      </div>
      <div
        className="mt-4 p-4 rounded-xl text-center text-sm bg-bg"
        style={{ color: "var(--color-muted)" }}
      >
        {display}
        {RETRYABLE_STATUS.includes(status) && !lookupBusy && (
          <button
            onClick={() => {
              setLookupMsg(null);
              setRetryToken((n) => n + 1);
            }}
            className="mt-3 inline-flex px-4 py-2 rounded-xl bg-navy text-white text-[13px] font-bold"
          >
            Pokušaj ponovno
          </button>
        )}
      </div>
      {showDebug && (
        <div
          className="mt-2 text-center text-[11px]"
          style={{ color: "var(--color-muted)" }}
        >
          Adapter: {adapterKind} · status: {status}
        </div>
      )}
    </div>
  );
}
