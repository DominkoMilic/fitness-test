"use client";
import { useEffect, useRef, useState } from "react";
import { lookupBarcode } from "@/lib/api/openFoodFacts";
import type { FoodEntry } from "@/types/app";

type Props = {
  open: boolean;
  onClose: () => void;
  onResult: (food: FoodEntry) => void;
};

// Native BarcodeDetector — Chrome on Android only.
type BarcodeDetectorCtor = new (opts: { formats: string[] }) => {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
};

export function BarcodeScanner({ open, onClose, onResult }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState("Usmjeri kameru prema barkodu...");

  useEffect(() => {
    if (!open) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const v = videoRef.current!;
        v.srcObject = stream;
        const Ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
        if (!Ctor) {
          setStatus("Barcode nije podržan. Koristi Chrome na Androidu.");
          return;
        }
        const detector = new Ctor({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });
        const tick = async () => {
          if (cancelled || !streamRef.current) return;
          try {
            const codes = await detector.detect(v);
            if (codes.length) {
              setStatus(`Tražim: ${codes[0].rawValue}...`);
              const food = await lookupBarcode(codes[0].rawValue);
              if (food) {
                setStatus(`Pronađeno: ${food.name}`);
                onResult(food);
                onClose();
              } else setStatus("Proizvod nije u bazi.");
              return;
            }
          } catch {}
          requestAnimationFrame(tick);
        };
        v.addEventListener("loadeddata", tick);
      } catch {
        setStatus("Kamera nije dostupna.");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open, onClose, onResult]);

  if (!open) return null;
  return (
    <div className="p-5">
      <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-xl" />
      <div className="mt-4 p-4 rounded-xl text-center text-sm bg-[var(--color-bg)]" style={{ color: "var(--color-muted)" }}>
        {status}
      </div>
    </div>
  );
}
