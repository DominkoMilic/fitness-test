"use client";
import { useEffect } from "react";

// Removes the server-rendered #kf-splash element once React mounts on the
// client. useEffect fires post-hydration, so by this point the real UI is
// painted underneath — fade out, then remove from DOM.
export function SplashHider() {
  useEffect(() => {
    const el = document.getElementById("kf-splash");
    if (!el) return;
    // Defer one frame so the underlying app paints first → no flash of
    // empty body during fade.
    requestAnimationFrame(() => {
      el.classList.add("kf-splash-hide");
      setTimeout(() => el.remove(), 400);
    });
  }, []);
  return null;
}
