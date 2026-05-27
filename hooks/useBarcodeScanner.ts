"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createScanner } from "@/lib/barcode/createScanner";
import type {
  BarcodeAdapterKind,
  BarcodeScannerAdapter,
} from "@/lib/barcode/types";
import { normalizeBarcode } from "@/lib/barcode/normalize";
import { scanLog } from "@/lib/barcode/diagnostics";

export type ScannerStatus =
  | "idle"
  | "starting"
  | "scanning"
  | "permission-denied"
  | "no-camera"
  | "camera-busy"
  | "insecure"
  | "unsupported"
  | "error";

type Options = {
  open: boolean;
  onCode: (code: string) => void;
  /** Cooldown to suppress duplicate scans of the same code (ms). */
  cooldownMs?: number;
  /** Change this value to force a re-init of the camera + scanner. */
  retryToken?: number;
};

// `torch`/`focusMode` etc. are not in the standard MediaTrack* types yet.
type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean };

function buildConstraints(): MediaStreamConstraints {
  const advanced = [
    { focusMode: "continuous" },
    { exposureMode: "continuous" },
    { whiteBalanceMode: "continuous" },
  ] as unknown as MediaTrackConstraintSet[];
  return {
    audio: false,
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      advanced,
    },
  };
}

export function useBarcodeScanner({
  open,
  onCode,
  cooldownMs = 1500,
  retryToken = 0,
}: Options) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<BarcodeScannerAdapter | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastCodeRef = useRef<{ code: string; at: number } | null>(null);
  // Keep a stable ref to the consumer callback so cleanup never reads a stale closure.
  const onCodeRef = useRef(onCode);
  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  const [status, setStatus] = useState<ScannerStatus>("idle");
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [adapterKind, setAdapterKind] = useState<BarcodeAdapterKind | null>(
    null,
  );

  const stopAll = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (scanner) {
      try {
        await scanner.stop();
      } catch {
        // ignore
      }
    }
    const stream = streamRef.current;
    streamRef.current = null;
    if (stream) {
      stream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          // ignore
        }
      });
    }
    const v = videoRef.current;
    if (v) {
      try {
        v.pause();
      } catch {
        // ignore
      }
      try {
        v.srcObject = null;
      } catch {
        // ignore
      }
    }
    lastCodeRef.current = null;
    setTorchOn(false);
    setTorchSupported(false);
    setAdapterKind(null);
    setStatus("idle");
    scanLog("stop");
  }, []);

  const handleDetected = useCallback(
    (raw: string) => {
      const code = normalizeBarcode(raw);
      if (!code) return;
      const now = Date.now();
      const last = lastCodeRef.current;
      if (last && last.code === code && now - last.at < cooldownMs) {
        scanLog("duplicate-ignored", { code });
        return;
      }
      lastCodeRef.current = { code, at: now };
      scanLog("decode", { code });
      onCodeRef.current(code);
    },
    [cooldownMs],
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setStatus("starting");

    // Watchdog: if camera doesn't come up within 10 s, surface an error
    // instead of leaving the user staring at "Pokrećem kameru..." forever.
    // Fires for: silent getUserMedia hang (iOS edge cases), service-worker
    // weirdness, or any unexpected await that never resolves.
    const watchdog = setTimeout(() => {
      if (cancelled) return;
      setStatus((s) => {
        if (s === "starting") {
          scanLog("error", { source: "watchdog", reason: "start-timeout" });
          return "error";
        }
        return s;
      });
    }, 10000);

    const start = async () => {
      // Wait briefly for the <video> ref to attach. In React 19 we've
      // occasionally seen the first effect run beat the ref commit on
      // mobile webviews — retry up to ~16 frames (~250 ms) before giving
      // up loudly instead of silently bailing.
      let video = videoRef.current;
      for (let i = 0; !video && i < 16; i++) {
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
        if (cancelled) return;
        video = videoRef.current;
      }
      if (!video) {
        scanLog("error", { source: "videoRef", reason: "never-attached" });
        setStatus("error");
        return;
      }

      if (typeof window !== "undefined" && window.isSecureContext === false) {
        setStatus("insecure");
        return;
      }
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        setStatus("unsupported");
        return;
      }

      // Try with rich constraints first, retry minimal on
      // OverconstrainedError (cheap mobile cameras often reject 1920×1080
      // or the advanced focus mode set).
      const acquireStream = async (): Promise<MediaStream> => {
        try {
          return await navigator.mediaDevices.getUserMedia(buildConstraints());
        } catch (e) {
          const err = e as DOMException;
          if (err?.name !== "OverconstrainedError") throw err;
          scanLog("error", {
            source: "getUserMedia",
            name: err?.name,
            retry: "minimal-constraints",
          });
          return await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: { ideal: "environment" } },
          });
        }
      };

      let stream: MediaStream;
      try {
        stream = await acquireStream();
      } catch (e) {
        const err = e as DOMException;
        if (err?.name === "NotAllowedError") setStatus("permission-denied");
        else if (err?.name === "NotFoundError") setStatus("no-camera");
        else if (err?.name === "NotReadableError") setStatus("camera-busy");
        else setStatus("error");
        scanLog("error", { source: "getUserMedia", name: err?.name });
        return;
      }

      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        // iOS Safari can reject play() if invoked outside a user gesture; retry on visibility.
      }

      const track = stream.getVideoTracks()[0];
      const caps =
        (track?.getCapabilities?.() as TorchCapabilities | undefined) ?? null;
      scanLog("constraints-applied", {
        settings: track?.getSettings?.(),
      });
      if (caps?.torch) {
        setTorchSupported(true);
        scanLog("torch-available");
      }

      const adapter = createScanner();
      scannerRef.current = adapter;
      setAdapterKind(adapter.kind);
      adapter.onDetected(handleDetected);

      try {
        await adapter.start(video);
        if (cancelled) {
          await adapter.stop();
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        setStatus("scanning");
      } catch (err) {
        scanLog("error", {
          source: "adapter.start",
          err: (err as Error).message,
        });
        setStatus("unsupported");
      }
    };

    void start();

    const onVisibility = () => {
      if (typeof document === "undefined") return;
      if (document.visibilityState === "hidden") {
        scanLog("visibility-pause");
        try {
          videoRef.current?.pause();
        } catch {
          // ignore
        }
      } else {
        scanLog("visibility-resume");
        videoRef.current?.play().catch(() => {
          // ignore — autoplay restriction; user can tap to resume.
        });
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      clearTimeout(watchdog);
      document.removeEventListener("visibilitychange", onVisibility);
      void stopAll();
    };
  }, [open, handleDetected, stopAll, retryToken]);

  const toggleTorch = useCallback(async () => {
    const stream = streamRef.current;
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: next }],
      } as unknown as MediaTrackConstraints);
      setTorchOn(next);
      scanLog("torch-toggled", { on: next });
    } catch (err) {
      scanLog("error", { source: "torch", err: (err as Error).message });
    }
  }, [torchOn]);

  return {
    videoRef,
    status,
    torchSupported,
    torchOn,
    toggleTorch,
    adapterKind,
  };
}
