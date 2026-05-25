"use client";
import { useEffect } from "react";

// Removes the server-rendered #kf-splash element once React mounts on the
// client. Also clears the inline navy bg from <html>/<body> set in
// layout.tsx so globals.css cream bg takes over for the real app.
export function SplashHider() {
  useEffect(() => {
    const el = document.getElementById("kf-splash");
    const html = document.documentElement;
    const body = document.body;

    const clearBg = () => {
      html.style.background = "";
      body.style.background = "";
      html.removeAttribute("data-kf-booting");
    };

    if (!el) {
      clearBg();
      return;
    }

    // Defer one frame so underlying app paints under splash before fade.
    requestAnimationFrame(() => {
      el.classList.add("kf-splash-hide");
      setTimeout(() => {
        el.remove();
        clearBg();
      }, 400);
    });
  }, []);
  return null;
}
