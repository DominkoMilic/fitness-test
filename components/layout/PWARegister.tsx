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

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Silent fail: app should still work online without SW.
    });
  }, []);

  return null;
}
