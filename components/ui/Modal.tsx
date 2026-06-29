"use client";
import {
  FocusEvent,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useScrollLock } from "@/hooks/useScrollLock";

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
};

export function Modal({ open, onClose, children, className = "" }: Props) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const openedWithHistoryRef = useRef(false);
  const closingFromPopRef = useRef(false);
  const [kbdInset, setKbdInset] = useState(0);

  // Block page scroll behind the modal; restored when the last modal closes.
  useScrollLock(open);

  // iOS Safari quirk: when the on-screen keyboard opens, fixed-position
  // elements stay anchored to the layout viewport, but the visual viewport
  // shrinks. Result: the bottom of a bottom-sheet modal sits *behind* the
  // keyboard. We read keyboard height via `visualViewport` and push the
  // sheet up by that amount. Android Chrome already resizes the layout
  // viewport so the value is 0 there — no harm.
  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKbdInset(inset);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      setKbdInset(0);
    };
  }, [open]);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;

    const hasModalMarker = Boolean(window.history.state?.__kfModal);
    if (!hasModalMarker) {
      window.history.pushState(
        { ...(window.history.state ?? {}), __kfModal: true },
        "",
      );
      openedWithHistoryRef.current = true;
    } else {
      openedWithHistoryRef.current = false;
    }

    const onPopState = () => {
      closingFromPopRef.current = true;
      onClose();
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [open, onClose]);

  useEffect(() => {
    if (open || typeof window === "undefined") return;

    // If modal was closed by UI/action (not by browser back), consume the
    // synthetic history entry so browser back stays predictable.
    if (
      openedWithHistoryRef.current &&
      !closingFromPopRef.current &&
      window.history.state?.__kfModal
    ) {
      window.history.back();
    }

    openedWithHistoryRef.current = false;
    closingFromPopRef.current = false;
  }, [open]);

  const onKeyDownCapture = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter") return;
    const target = e.target as EventTarget | null;
    if (target instanceof HTMLInputElement) {
      target.blur();
    }
  };

  const onFocusCapture = (e: FocusEvent<HTMLDivElement>) => {
    const target = e.target as EventTarget | null;
    if (
      !(target instanceof HTMLInputElement) &&
      !(target instanceof HTMLTextAreaElement) &&
      !(target instanceof HTMLSelectElement)
    ) {
      return;
    }

    // Wait a bit for mobile keyboard animation, then center focused field.
    setTimeout(() => {
      const container = bodyRef.current;
      if (!container || !target.isConnected) return;
      target.scrollIntoView({ block: "center", inline: "nearest" });
    }, 120);
  };

  const requestClose = () => {
    // Close immediately for UI actions (outside click, back arrow).
    // History entry cleanup is handled in the `open` effect below.
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="modal-backdrop"
          className="fixed inset-0 z-100 flex items-end justify-center"
          style={{
            background: "rgba(0,0,0,0.55)",
            // Push the bottom-anchored sheet up by the iOS keyboard height.
            paddingBottom: kbdInset ? `${kbdInset}px` : undefined,
          }}
          onClick={requestClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          <motion.div
            ref={bodyRef}
            className={`bg-white rounded-t-3xl w-full max-w-107.5 px-5 pt-6 relative overflow-y-auto overscroll-contain ${className}`}
            style={{
              // When keyboard is open we cap to the visible viewport directly;
              // otherwise fall back to the dvh-based limit that already
              // accounts for the URL bar.
              maxHeight: kbdInset
                ? `calc(100dvh - ${kbdInset}px - 1rem)`
                : "92dvh",
              paddingBottom: "calc(2rem + env(safe-area-inset-bottom))",
              scrollPaddingBottom: "10rem",
            }}
            onClick={(e: MouseEvent) => e.stopPropagation()}
            onKeyDownCapture={onKeyDownCapture}
            onFocusCapture={onFocusCapture}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
          >
            <button
              onClick={requestClose}
              aria-label="Natrag"
              className="absolute top-1 left-1 w-11 h-11 flex items-center justify-center"
              style={{ color: "var(--color-navy)" }}
            >
              <svg
                width="11"
                height="18"
                viewBox="0 0 11 18"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 16L2 9L9 2" />
              </svg>
            </button>
            <div className="w-9 h-1 rounded-sm bg-gray-300 mx-auto mb-5" />
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
