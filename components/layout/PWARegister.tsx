"use client";
import { useCallback, useEffect, useState } from "react";

export function PWARegister() {
  const [waitingWorker, setWaitingWorker] =
    useState<ServiceWorker | null>(null);

  const onReload = useCallback(() => {
    if (!waitingWorker) return;
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
    // `controllerchange` listener below will reload once activation completes.
  }, [waitingWorker]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    if (isLocalhost) return;

    let refreshed = false;
    let disposed = false;
    let registration: ServiceWorkerRegistration | null = null;
    let updateInterval: ReturnType<typeof setInterval> | null = null;

    const handleWaiting = (worker: ServiceWorker | null) => {
      if (worker) setWaitingWorker(worker);
    };

    const checkForUpdate = () => {
      registration?.update().catch(() => {
        /* offline / transient — next check will retry */
      });
    };

    const onControllerChange = () => {
      if (refreshed) return;
      refreshed = true;
      window.location.reload();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") checkForUpdate();
    };

    navigator.serviceWorker
      // updateViaCache:"none" makes the browser always fetch sw.js from the
      // network. By default it may serve the worker script from the HTTP
      // cache, so a new deploy can go unnoticed and the PWA keeps running the
      // old cached build.
      .register("/sw.js", { updateViaCache: "none" })
      .then((reg) => {
        if (disposed) return;
        registration = reg;
        checkForUpdate();

        updateInterval = setInterval(checkForUpdate, 60 * 60 * 1000);

        // Already a waiting worker on mount.
        if (reg.waiting) handleWaiting(reg.waiting);

        reg.addEventListener("updatefound", () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            // Only treat as "update available" if there's an active worker —
            // otherwise it's the first install.
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              handleWaiting(worker);
            }
          });
        });
      })
      .catch(() => {
        /* App still works online without SW. */
      });

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange,
    );
    // An installed PWA is usually resumed, not reloaded, so a check that only
    // runs on page load can go days without firing. Re-check when the app comes
    // to the foreground or regains connectivity.
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("online", checkForUpdate);

    return () => {
      disposed = true;
      if (updateInterval) clearInterval(updateInterval);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online", checkForUpdate);
    };
  }, []);

  if (!waitingWorker) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-bold"
      style={{
        bottom: "calc(96px + env(safe-area-inset-bottom))",
        background: "linear-gradient(135deg,#1b3255,#162844)",
        color: "white",
        maxWidth: "min(92vw, 22rem)",
      }}
    >
      <span className="flex-1">Nova verzija dostupna</span>
      <button
        onClick={onReload}
        className="px-3 py-1.5 rounded-lg text-[12px] font-extrabold"
        style={{
          background: "var(--color-orange, #f08a24)",
          color: "white",
        }}
      >
        Osvježi
      </button>
    </div>
  );
}
