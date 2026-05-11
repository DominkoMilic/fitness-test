"use client";
import { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
};

export function Modal({ open, onClose, children, className = "" }: Props) {
  const onKeyDownCapture = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter") return;
    const target = e.target as EventTarget | null;
    if (target instanceof HTMLInputElement) {
      target.blur();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="modal-backdrop"
          className="fixed inset-0 z-100 flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          <motion.div
            className={`bg-white rounded-t-3xl w-full max-w-107.5 px-5 pt-6 relative max-h-[92dvh] overflow-y-auto overscroll-contain ${className}`}
            style={{
              paddingBottom: "calc(2rem + env(safe-area-inset-bottom))",
            }}
            onClick={(e: MouseEvent) => e.stopPropagation()}
            onKeyDownCapture={onKeyDownCapture}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
          >
            <button
              onClick={onClose}
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
