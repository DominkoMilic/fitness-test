"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useUIStore } from "@/store/useUIStore";

// Floating AI button. A single tap opens the modal instantly; to reposition it
// the user press-and-HOLDS (~450 ms) to enter drag mode, then drags.
//
// Two mobile-specific traps this implementation avoids:
//   • Opening is driven by the native `click` event (browsers apply their own
//     jitter-tolerant tap heuristics), NOT by hand-rolled pointerup logic —
//     home-made movement thresholds dropped a large share of real taps.
//   • The stored position is RAW; clamping to the viewport happens at render
//     time only. The on-screen keyboard shrinking window.innerHeight must
//     never permanently rewrite the saved position (that's what shoved the
//     button up to the modal-top after closing it).

const BTN = 56; // w-14/h-14
const MARGIN = 12;
const NAV_RESERVE = 84; // keep the button above the bottom nav
const LONG_PRESS_MS = 450; // hold this long to enter drag mode
const SWIPE_CANCEL = 14; // px (euclidean) moved before the hold fires → treat as swipe
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
  // Only on the diary (dashboard) page — not on search/add-meal, favorites,
  // recipes, settings etc.
  const pathname = usePathname();
  const onDashboard = pathname?.startsWith("/dashboard") ?? false;

  // RAW position (persisted). Never clamped by resize events — see header note.
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
    return start ?? defaultPos();
  });
  const [dragging, setDragging] = useState(false);
  // Resize/orientation only needs a re-render (render-time clamp picks up the
  // new bounds); it must NOT rewrite `pos`.
  const [, bumpViewport] = useState(0);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  // Press bookkeeping. `armed` = long-press elapsed, drag mode active.
  const press = useRef<{
    offX: number;
    offY: number;
    startX: number;
    startY: number;
    armed: boolean;
    pointerId: number;
  } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Timestamp of the last drag/hold end. The click that MAY follow pointerup
  // is ignored inside a short window. A timestamp (not a one-shot boolean) is
  // self-healing: after a big drag mobile browsers often never synthesize the
  // click, and a lingering boolean would swallow the NEXT real tap instead.
  const lastDragEnd = useRef(0);

  const clearTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => {
    const onResize = () => bumpViewport((t) => t + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Hard-block page scroll for touches that start on the FAB. `touch-action:
  // none` alone is flaky on some mobile browsers (a scroll can still start,
  // which also fires pointercancel and kills the long-press). React's
  // synthetic touch handlers are passive, so this needs a manual non-passive
  // listener. Re-attach whenever the button (re)mounts (modal open/close).
  const rendered = onDashboard && modal === null && pos !== null;
  useEffect(() => {
    const el = btnRef.current;
    if (!el) return;
    const block = (e: TouchEvent) => e.preventDefault();
    el.addEventListener("touchmove", block, { passive: false });
    return () => el.removeEventListener("touchmove", block);
  }, [rendered]);

  // Clean up a pending timer if unmounted mid-press.
  useEffect(() => () => clearTimer(), [clearTimer]);

  // Long-press elapsed → enter drag mode (capture pointer, haptic nudge).
  const arm = useCallback(() => {
    const p = press.current;
    const el = btnRef.current;
    if (!p || !el) return;
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
      // Clamp while dragging — the user is placing it inside the live viewport.
      setPos(clampPos({ x: e.clientX - p.offX, y: e.clientY - p.offY }));
      return;
    }
    // Clear swipe across the button before the hold fires → not a drag intent;
    // just stop the pending long-press. Whether it still counts as a tap is
    // left entirely to the browser's own click heuristics.
    const dist = Math.hypot(e.clientX - p.startX, e.clientY - p.startY);
    if (dist > SWIPE_CANCEL) clearTimer();
  }, [clearTimer]);

  const endPress = useCallback(
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
        // Drag (or bare hold) finished — persist and open a short window in
        // which any trailing synthesized click is ignored.
        lastDragEnd.current = Date.now();
        setDragging(false);
        setPos((cur) => {
          savePos(cur);
          return cur;
        });
      }
    },
    [clearTimer],
  );

  const onClick = useCallback(() => {
    // Ignore the click that trails a drag/hold; taps outside this window
    // always open (no stale one-shot state to eat them).
    if (Date.now() - lastDragEnd.current < 600) return;
    openModal("aiMeal");
  }, [openModal]);

  // Render only on the dashboard, and hide while a modal is open so it
  // doesn't float over sheets/backdrops. (`!pos` is implied by `rendered`
  // but repeated so TypeScript narrows it for clampPos below.)
  if (!rendered || !pos) return null;

  const shown = clampPos(pos);

  return (
    <button
      ref={btnRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPress}
      onPointerCancel={endPress}
      onClick={onClick}
      // Long-press must arm drag mode, not open the mobile context menu.
      onContextMenu={(e) => e.preventDefault()}
      aria-label="AI prepoznavanje obroka (dodirni za otvaranje, drži i povuci za pomicanje)"
      className={`fixed z-20 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg select-none ${
        dragging ? "scale-110 cursor-grabbing" : "cursor-pointer active:scale-95"
      } transition-transform`}
      style={{
        left: shown.x,
        top: shown.y,
        touchAction: "none",
        WebkitUserSelect: "none",
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
