"use client";
import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { lookupBarcode } from "@/lib/api/openFoodFacts";
import type { FoodEntry } from "@/types/app";

type Props = {
  open: boolean;
  onClose: () => void;
  onResult: (food: FoodEntry) => void;
};

const FORMATS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.ITF,
];

export function BarcodeScanner({ open, onClose, onResult }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const busyRef = useRef(false);
  const [status, setStatus] = useState("Usmjeri kameru prema barkodu...");

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const video = videoRef.current;
    if (!video) return;

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, FORMATS);
    hints.set(DecodeHintType.TRY_HARDER, true);

    const reader = new BrowserMultiFormatReader(hints, {
      delayBetweenScanAttempts: 150,
      delayBetweenScanSuccess: 800,
    });

    const constraints: MediaStreamConstraints = {
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    };

    (async () => {
      try {
        const controls = await reader.decodeFromConstraints(
          constraints,
          video,
          async (result) => {
            if (!result || busyRef.current || cancelled) return;
            busyRef.current = true;
            const code = result.getText();
            setStatus(`Tražim: ${code}...`);
            try {
              const food = await lookupBarcode(code);
              if (cancelled) return;
              if (food) {
                setStatus(`Pronađeno: ${food.name}`);
                onResult(food);
                onClose();
              } else {
                setStatus("Proizvod nije u bazi.");
                busyRef.current = false;
              }
            } catch {
              setStatus("Greška pri dohvatu.");
              busyRef.current = false;
            }
          }
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;

        // iOS Safari sometimes won't autoplay without explicit play() call.
        try {
          await video.play();
        } catch {}
      } catch (e) {
        const err = e as DOMException;
        if (err?.name === "NotAllowedError") {
          setStatus("Kamera odbijena. Dozvoli pristup u postavkama preglednika.");
        } else if (err?.name === "NotFoundError") {
          setStatus("Kamera nije pronađena.");
        } else if (err?.name === "NotReadableError") {
          setStatus("Kamera zauzeta drugom aplikacijom.");
        } else if (window.isSecureContext === false) {
          setStatus("Potreban HTTPS za pristup kameri.");
        } else {
          setStatus("Kamera nije dostupna.");
        }
      }
    })();

    return () => {
      cancelled = true;
      busyRef.current = false;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open, onClose, onResult]);

  if (!open) return null;
  return (
    <div className="p-5">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full rounded-xl bg-black"
      />
      <div
        className="mt-4 p-4 rounded-xl text-center text-sm bg-[var(--color-bg)]"
        style={{ color: "var(--color-muted)" }}
      >
        {status}
      </div>
    </div>
  );
}
