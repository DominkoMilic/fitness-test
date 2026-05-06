"use client";
import { useEffect } from "react";

export function PWARegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    if (isLocalhost) return;

    let refreshed = false;

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        registration.update();

        setInterval(
          () => {
            registration.update();
          },
          60 * 60 * 1000,
        );

        const activateIfWaiting = () => {
          if (registration.waiting) {
            registration.waiting.postMessage({ type: "SKIP_WAITING" });
          }
        };

        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed") activateIfWaiting();
          });
        });

        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (refreshed) return;
          refreshed = true;
          window.location.reload();
        });
      })
      .catch(() => {
        // Silent fail: app should still work online without SW.
      });
  }, []);

  return null;
}
