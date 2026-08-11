"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useUIStore } from "@/store/useUIStore";

// Floating AI button. A single tap opens the modal; press-and-HOLD (~450 ms)
// enters drag mode to reposition it.
//
// Three traps this implementation is built to avoid:
//   • Opening rides the native `click` event, so the browser's jitter-tolerant
//     tap heuristics decide what a tap is — hand-rolled thresholds dropped a
//     large share of real taps.
//   • The button is anchored to the bottom-right CORNER (CSS right/bottom),
//     not absolute top/left. Mobile viewports change height constantly (iOS
//     URL bar ±140px, Android keyboard); with top/left the button gets clamped
//     into mid-screen while the viewport is short, and once a drag ends there
//     that stranded position is what gets saved. Anchoring sidesteps the whole
//     class of bug.
//   • Interaction state is dropped whenever the button stops rendering. The
//     modal hides it mid-press, so pointerup never arrives; leftover
//     `armed` state used to make it follow the pointer while swallowing its
//     own clicks — the "stuck, can't move it" report.

const BTN = 56; // w-14/h-14
const MARGIN = 12;
const NAV_RESERVE = 84; // keep the button clear of the bottom nav
const LONG_PRESS_MS = 450; // hold this long to enter drag mode
const SWIPE_CANCEL = 14; // px moved before the hold fires → treat as a swipe
const POS_KEY = "kf_ai_fab_pos";

/** Gap from the viewport's right/bottom edges to the button's edges. */
type Anchor = { right: number; bottom: number };

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function clampAnchor(a: Anchor): Anchor {
  const w = window.innerWidth;
  const h = window.innerHeight;
  return {
    right: clamp(a.right, MARGIN, Math.max(MARGIN, w - BTN - MARGIN)),
    bottom: clamp(
      a.bottom,
      NAV_RESERVE,
      Math.max(NAV_RESERVE, h - BTN - MARGIN),
    ),
  };
}

function defaultAnchor(): Anchor {
  return { right: MARGIN, bottom: NAV_RESERVE };
}

function readAnchor(): Anchor {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (!raw) return defaultAnchor();
    const p = JSON.parse(raw) as Partial<Anchor & { x: number; y: number }>;
    if (typeof p?.right === "number" && typeof p?.bottom === "number") {
      if (Number.isFinite(p.right) && Number.isFinite(p.bottom)) {
        return clampAnchor({ right: p.right, bottom: p.bottom });
      }
    }
    // Migrate the old absolute {x,y} format to a corner anchor.
    if (typeof p?.x === "number" && typeof p?.y === "number") {
      return clampAnchor({
        right: window.innerWidth - p.x - BTN,
        bottom: window.innerHeight - p.y - BTN,
      });
    }
  } catch {}
  return defaultAnchor();
}

function saveAnchor(a: Anchor) {
  try {
    localStorage.setItem(POS_KEY, JSON.stringify(a));
  } catch {}
}

export function AiFab() {
  const openModal = useUIStore((s) => s.openModal);
  const modal = useUIStore((s) => s.modal);
  // Only on the diary (dashboard) page — not on search, favourites, recipes…
  const pathname = usePathname();
  const onDashboard = pathname?.startsWith("/dashboard") ?? false;

  const [anchor, setAnchor] = useState<Anchor | null>(() =>
    typeof window === "undefined" ? null : readAnchor(),
  );
  const [dragging, setDragging] = useState(false);
  // Viewport changes only need a re-render so the render-time clamp re-runs.
  const [, bumpViewport] = useState(0);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  const press = useRef<{
    offX: number;
    offY: number;
    startX: number;
    startY: number;
    armed: boolean;
    pointerId: number;
  } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Timestamp (not a one-shot flag): after a real drag many mobile browsers
  // never synthesize the trailing click, and a lingering flag would eat the
  // NEXT genuine tap instead.
  const lastDragEnd = useRef(0);

  const clearTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  // Re-clamp on layout AND visual-viewport changes. iOS does not fire
  // window.resize for keyboard/URL-bar changes, only visualViewport events.
  useEffect(() => {
    const onResize = () => bumpViewport((t) => t + 1);
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      vv?.removeEventListener("resize", onResize);
    };
  }, []);

  const rendered = onDashboard && modal === null && anchor !== null;

  // Drop any in-flight press when the button stops rendering (a modal opens,
  // route change). Without this, pointerup never reaches the removed element,
  // and the leftover `armed` state makes the button drag on any later pointer
  // move while suppressing its own clicks — the "stuck, can't move it" bug.
  useEffect(() => {
    if (!rendered) return;
    return () => {
      press.current = null;
      clearTimer();
      setDragging(false);
    };
  }, [rendered, clearTimer]);

  // Block page scroll for touches starting on the FAB. `touch-action: none`
  // alone is flaky on some mobile browsers (a scroll can still begin, which
  // fires pointercancel and kills the long-press). React's synthetic touch
  // handlers are passive, so this needs a manual non-passive listener.
  useEffect(() => {
    const el = btnRef.current;
    if (!el) return;
    const block = (e: TouchEvent) => e.preventDefault();
    el.addEventListener("touchmove", block, { passive: false });
    return () => el.removeEventListener("touchmove", block);
  }, [rendered]);

  useEffect(() => () => clearTimer(), [clearTimer]);

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

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const p = press.current;
      if (!p) return;
      // Only the pointer that started the press may drag, and for a mouse a
      // button must still be held — otherwise a plain hover (laptop) or a
      // second finger could drag the button around.
      if (e.pointerId !== p.pointerId) return;
      if (e.pointerType === "mouse" && e.buttons === 0) {
        press.current = null;
        clearTimer();
        setDragging(false);
        return;
      }
      if (p.armed) {
        const left = e.clientX - p.offX;
        const top = e.clientY - p.offY;
        setAnchor(
          clampAnchor({
            right: window.innerWidth - left - BTN,
            bottom: window.innerHeight - top - BTN,
          }),
        );
        return;
      }
      // A clear swipe before the hold fires is not a drag intent — just cancel
      // the pending long-press and let the browser decide about the tap.
      const dist = Math.hypot(e.clientX - p.startX, e.clientY - p.startY);
      if (dist > SWIPE_CANCEL) clearTimer();
    },
    [clearTimer],
  );

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
        lastDragEnd.current = Date.now();
        setDragging(false);
        setAnchor((cur) => {
          if (cur) saveAnchor(cur);
          return cur;
        });
      }
    },
    [clearTimer],
  );

  const onClick = useCallback(() => {
    // Ignore the click trailing a drag; taps outside that window always open.
    if (Date.now() - lastDragEnd.current < 600) return;
    openModal("aiMeal");
  }, [openModal]);

  if (!rendered || !anchor) return null;

  const shown = clampAnchor(anchor);

  return (
    <button
      ref={btnRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPress}
      onPointerCancel={endPress}
      onLostPointerCapture={endPress}
      onClick={onClick}
      onContextMenu={(e) => e.preventDefault()}
      aria-label="AI prepoznavanje obroka (dodirni za otvaranje, drži i povuci za pomicanje)"
      className={`fixed z-20 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg select-none ${
        dragging ? "scale-110 cursor-grabbing" : "cursor-pointer active:scale-95"
      } transition-transform`}
      style={{
        right: shown.right,
        bottom: shown.bottom,
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
