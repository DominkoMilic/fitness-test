"use client";
import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/Button";

type PopupAction = {
  text: string;
  onClick: () => void;
  variant?: "primary" | "navy" | "cancel" | "orange";
};

type Props = {
  open: boolean;
  question: string;
  button1: PopupAction;
  button2: PopupAction;
  onClose: () => void;
};

export function ConfirmPopup({
  open,
  question,
  button1,
  button2,
  onClose,
}: Props) {
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="confirm-backdrop"
          className="fixed inset-0 z-200 flex items-center justify-center px-4"
          style={{ background: "rgba(10,16,28,0.68)" }}
          onClick={onClose}
          aria-hidden={false}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-sm rounded-3xl bg-white shadow-2xl px-5 pt-5 pb-4"
            onClick={(event) => event.stopPropagation()}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 24, stiffness: 320 }}
          >
        <button
          type="button"
          onClick={onClose}
          aria-label="Zatvori"
          className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center border border-border bg-bg text-muted"
        >
          <svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <div
          className="pr-10 text-lg font-extrabold leading-snug"
          style={{ color: "var(--color-navy)" }}
        >
          {question}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2.5">
          <Button
            type="button"
            variant={button1.variant ?? "cancel"}
            full
            onClick={button1.onClick}
          >
            {button1.text}
          </Button>
          <Button
            type="button"
            variant={button2.variant ?? "orange"}
            full
            onClick={button2.onClick}
          >
            {button2.text}
          </Button>
        </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
