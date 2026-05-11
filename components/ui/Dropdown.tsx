"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export type DropdownOption<T extends string> = {
  value: T;
  label: string;
};

type Props<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: readonly DropdownOption<T>[];
  ariaLabel?: string;
  className?: string;
  wrapperClassName?: string;
  align?: "left" | "right";
};

/**
 * App-styled custom dropdown. Replaces the native <select> entirely so the
 * options panel can match the rest of the UI (no OS-defaults).
 */
export function Dropdown<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className = "",
  wrapperClassName = "",
  align = "right",
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={wrapperRef}
      className={`relative inline-block ${wrapperClassName}`}
    >
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 cursor-pointer text-[11px] font-bold uppercase tracking-wider rounded-full bg-linear-to-br from-white to-bg pl-3 pr-2.5 py-1.5 outline-none border-[1.5px] border-border hover:border-orange/60 focus-visible:border-orange transition-colors shadow-sm ${className}`}
        style={{ color: "var(--color-navy)" }}
      >
        <span>{current?.label ?? value}</span>
        <svg
          width={10}
          height={10}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
          style={{ color: "var(--color-orange)" }}
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            className={`absolute z-50 mt-1.5 min-w-45 max-h-72 overflow-y-auto rounded-2xl border border-border bg-white shadow-xl py-1 ${
              align === "right" ? "right-0" : "left-0"
            }`}
          >
            {options.map((opt) => {
              const active = opt.value === value;
              return (
                <li key={opt.value} role="option" aria-selected={active}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-[12px] font-semibold flex items-center justify-between gap-2 transition-colors ${
                      active
                        ? "bg-orange/10"
                        : "hover:bg-bg active:bg-black/5"
                    }`}
                    style={{
                      color: active
                        ? "var(--color-orange)"
                        : "var(--color-navy)",
                    }}
                  >
                    <span>{opt.label}</span>
                    {active && (
                      <svg
                        width={12}
                        height={12}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M5 12l5 5L20 7" />
                      </svg>
                    )}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
