"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useUIStore } from "@/store/useUIStore";

// Floating AI button. A single tap opens the modal instantly; to reposition it
// the user press-and-HOLDS (~450 ms) to enter drag mode, then drags. The hold
// gate means normal taps are never swallowed by drag detection.

const BTN = 56; // w-14/h-14
const MARGIN = 12;
const NAV_RESERVE = 84; // keep the button above the bottom nav
const LONG_PRESS_MS = 450; // hold this long to enter drag mode
const MOVE_CANCEL = 10; // px moved before the hold fires → it's a scroll, not a drag
const POS_KEY = "kf_ai_fab_pos";

type Pos = { x: number; y: number };

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function bounds() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  return {
    minX: MARGIN,
    maxX: Math.max(MARGIN, w - BTN - MARGIN),
    minY: MARGIN,
    maxY: Math.max(MARGIN, h - BTN - NAV_RESERVE),
  };
}

function clampPos(p: Pos): Pos {
  const b = bounds();
  return { x: clamp(p.x, b.minX, b.maxX), y: clamp(p.y, b.minY, b.maxY) };
}

function defaultPos(): Pos {
  const b = bounds();
  // Bottom-right, just above the nav.
  return { x: b.maxX, y: b.maxY };
}

function savePos(p: Pos | null) {
  if (!p) return;
  try {
    localStorage.setItem(POS_KEY, JSON.stringify(p));
  } catch {}
}

export function AiFab() {
  const openModal = useUIStore((s) => s.openModal);
  const modal = useUIStore((s) => s.modal);

  // Initial position from storage or default. Computed lazily on the client;
  // the parent (MainLayout) only renders after hydration, so `window` is
  // available here and there's no SSR markup to mismatch.
  const [pos, setPos] = useState<Pos | null>(() => {
    if (typeof window === "undefined") return null;
    let start: Pos | null = null;
    try {
      const raw = localStorage.getItem(POS_KEY);
      if (raw) {
        const p = JSON.parse(raw) as Pos;
        if (typeof p?.x === "number" && typeof p?.y === "number") start = p;
      }
    } catch {}
    return clampPos(start ?? defaultPos());
  });
  const [dragging, setDragging] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  // Live press bookkeeping. `armed` flips true only after the long-press timer
  // fires; `canceled` blocks the tap when the finger moved (scroll/swipe).
  const press = useRef<{
    offX: number;
    offY: number;
    startX: number;
    startY: number;
    armed: boolean;
    canceled: boolean;
    pointerId: number;
  } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  // Re-clamp on viewport resize/orientation change.
  useEffect(() => {
    const onResize = () => setPos((p) => (p ? clampPos(p) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Clean up a pending timer if unmounted mid-press.
  useEffect(() => () => clearTimer(), [clearTimer]);

  // Long-press elapsed → enter drag mode (capture pointer, haptic nudge).
  const arm = useCallback(() => {
    const p = press.current;
    const el = btnRef.current;
    if (!p || !el || p.canceled) return;
    p.armed = true;
    setDragging(true);
    try {
      el.setPointerCapture(p.pointerId);
    } catch {}
    navigator.vibrate?.(12);
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const el = btnRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      press.current = {
        offX: e.clientX - rect.left,
        offY: e.clientY - rect.top,
        startX: e.clientX,
        startY: e.clientY,
        armed: false,
        canceled: false,
        pointerId: e.pointerId,
      };
      clearTimer();
      timer.current = setTimeout(arm, LONG_PRESS_MS);
    },
    [arm, clearTimer],
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const p = press.current;
    if (!p) return;
    if (p.armed) {
      setPos(clampPos({ x: e.clientX - p.offX, y: e.clientY - p.offY }));
      return;
    }
    // Not armed yet: movement before the hold means the user is scrolling /
    // swiping, not intending to drag → cancel both the pending drag and the tap.
    const dist =
      Math.abs(e.clientX - p.startX) + Math.abs(e.clientY - p.startY);
    if (dist > MOVE_CANCEL) {
      p.canceled = true;
      clearTimer();
    }
  }, [clearTimer]);

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const p = press.current;
      press.current = null;
      clearTimer();
      const el = btnRef.current;
      if (el?.hasPointerCapture?.(e.pointerId)) {
        try {
          el.releasePointerCapture(e.pointerId);
        } catch {}
      }
      if (!p) return;
      if (p.armed) {
        setDragging(false);
        setPos((cur) => {
          savePos(cur);
          return cur;
        });
      } else if (!p.canceled) {
        // Quick tap (released before the hold) → open the modal.
        openModal("aiMeal");
      }
    },
    [openModal, clearTimer],
  );

  const onPointerCancel = useCallback(
    (e: React.PointerEvent) => {
      const p = press.current;
      press.current = null;
      clearTimer();
      const el = btnRef.current;
      if (el?.hasPointerCapture?.(e.pointerId)) {
        try {
          el.releasePointerCapture(e.pointerId);
        } catch {}
      }
      if (p?.armed) {
        setDragging(false);
        setPos((cur) => {
          savePos(cur);
          return cur;
        });
      }
    },
    [clearTimer],
  );

  // Hide while a modal is open so it doesn't float over sheets/backdrops.
  if (modal !== null || !pos) return null;

  return (
    <button
      ref={btnRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      aria-label="AI prepoznavanje obroka (dodirni za otvaranje, drži i povuci za pomicanje)"
      className={`fixed z-20 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg select-none ${
        dragging ? "scale-110 cursor-grabbing" : "cursor-pointer active:scale-95"
      } transition-transform`}
      style={{
        left: pos.x,
        top: pos.y,
        touchAction: "none",
        background: "linear-gradient(160deg,#1b3255 0%,#0f1f38 100%)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/ai_assistant_image.png"
        alt=""
        aria-hidden="true"
        draggable={false}
        className="w-full h-full rounded-full object-cover pointer-events-none"
      />
      <span
        className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-extrabold"
        style={{ background: "var(--color-orange)", color: "#fff" }}
        aria-hidden="true"
      >
        AI
      </span>
    </button>
  );
}
