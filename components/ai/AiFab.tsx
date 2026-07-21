"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useUIStore } from "@/store/useUIStore";

// Floating, draggable AI button. Sits above the BottomNav by default; the user
// can press-and-drag to reposition it, and the position is remembered.

const BTN = 56; // w-14/h-14
const MARGIN = 12;
const NAV_RESERVE = 84; // keep the button above the bottom nav
const DRAG_THRESHOLD = 6; // px moved before a press counts as a drag
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
  // Live drag bookkeeping (offset of pointer within the button + moved flag).
  const drag = useRef<{ offX: number; offY: number; moved: boolean } | null>(
    null,
  );

  // Re-clamp on viewport resize/orientation change.
  useEffect(() => {
    const onResize = () => setPos((p) => (p ? clampPos(p) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const el = btnRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    drag.current = {
      offX: e.clientX - rect.left,
      offY: e.clientY - rect.top,
      moved: false,
    };
    el.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const nx = e.clientX - d.offX;
    const ny = e.clientY - d.offY;
    // Mark as a drag once past the movement threshold.
    const next = clampPos({ x: nx, y: ny });
    setPos((prev) => {
      if (prev && !d.moved) {
        if (Math.abs(next.x - prev.x) + Math.abs(next.y - prev.y) > DRAG_THRESHOLD) {
          d.moved = true;
          setDragging(true);
        }
      }
      return next;
    });
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const d = drag.current;
      drag.current = null;
      const el = btnRef.current;
      if (el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      if (!d) return;
      if (d.moved) {
        setDragging(false);
        setPos((p) => {
          if (p) {
            try {
              localStorage.setItem(POS_KEY, JSON.stringify(p));
            } catch {}
          }
          return p;
        });
      } else {
        // A tap without meaningful movement → open the modal.
        openModal("aiMeal");
      }
    },
    [openModal],
  );

  // Hide while a modal is open so it doesn't float over sheets/backdrops.
  if (modal !== null || !pos) return null;

  return (
    <button
      ref={btnRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      aria-label="AI prepoznavanje obroka (drži i povuci za pomicanje)"
      className={`fixed z-20 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg select-none ${
        dragging ? "scale-105 cursor-grabbing" : "cursor-grab active:scale-95"
      } transition-transform`}
      style={{
        left: pos.x,
        top: pos.y,
        touchAction: "none",
        background: "linear-gradient(160deg,#1b3255 0%,#0f1f38 100%)",
      }}
    >
      <svg
        width={24}
        height={24}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
        <circle cx={12} cy={13} r={3} />
      </svg>
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
