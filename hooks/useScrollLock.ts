"use client";
import { useEffect } from "react";

// Ref-counted body scroll lock. Multiple overlays can be open at once
// (e.g. a recipe modal with the barcode scanner stacked on top); the page
// stays locked until the LAST one closes, then the original overflow is
// restored exactly once.
let lockCount = 0;
let savedOverflow = "";

export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof document === "undefined") return;

    if (lockCount === 0) {
      savedOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    lockCount += 1;

    return () => {
      lockCount -= 1;
      if (lockCount === 0) {
        document.body.style.overflow = savedOverflow;
      }
    };
  }, [active]);
}
