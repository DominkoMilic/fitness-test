"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const MAX_PANEL_HEIGHT_PX = 288; // matches Tailwind max-h-72

export type DropdownOption<T extends string> = {
  value: T;
  label: string;
};

type Variant = "pill" | "input";

type Props<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: readonly DropdownOption<T>[];
  ariaLabel?: string;
  className?: string;
  wrapperClassName?: string;
  /** Panel alignment relative to trigger. */
  align?: "left" | "right";
  /** Visual style. */
  variant?: Variant;
  fullWidth?: boolean;
};

const TRIGGER_STYLES: Record<Variant, string> = {
  pill:
    "text-[11px] font-bold uppercase tracking-wider rounded-full bg-linear-to-br from-white to-bg pl-3 pr-2.5 py-1.5 border-[1.5px] border-border hover:border-orange/60 focus-visible:border-orange shadow-sm",
  input:
    "text-[15px] font-semibold rounded-xl bg-white px-3.5 py-3 border-[1.5px] border-border hover:border-orange/60 focus-visible:border-orange",
};

/**
 * App-styled custom dropdown. Replaces native <select> entirely so the panel
 * matches the rest of the UI. Two variants: `pill` (compact filter) and
 * `input` (full form field).
 */
export function Dropdown<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className = "",
  wrapperClassName = "",
  align = "right",
  variant = "pill",
  fullWidth = false,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const current = options.find((o) => o.value === value);

  // Decide whether the panel should open above the trigger based on
  // available viewport space below. Runs synchronously before paint to
  // avoid a flicker on first open.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    setOpenUp(spaceBelow < MAX_PANEL_HEIGHT_PX && spaceAbove > spaceBelow);
  }, [open]);

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
      className={`relative ${fullWidth ? "block w-full" : "inline-block"} ${wrapperClassName}`}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
        className={`cursor-pointer outline-none transition-colors flex items-center justify-between gap-1.5 ${
          fullWidth ? "w-full" : ""
        } ${TRIGGER_STYLES[variant]} ${className}`}
        style={{ color: "var(--color-navy)" }}
      >
        <span className="truncate">{current?.label ?? value}</span>
        <svg
          width={variant === "pill" ? 10 : 14}
          height={variant === "pill" ? 10 : 14}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
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
            initial={{ opacity: 0, y: openUp ? 4 : -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: openUp ? 4 : -4, scale: 0.98 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            className={`absolute z-50 min-w-45 max-h-72 overflow-y-auto rounded-2xl border border-border bg-white shadow-xl py-1 ${
              openUp ? "bottom-full mb-1.5" : "top-full mt-1.5"
            } ${
              fullWidth ? "left-0 right-0" : align === "right" ? "right-0" : "left-0"
            }`}
          >
            {options.map((opt) => {
              const active = opt.value === value;
              return (
                <li key={opt.value} role="option" aria-selected={active}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-[13px] font-semibold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                      active
                        ? "bg-orange/10 hover:bg-orange/20 active:bg-orange/25"
                        : "hover:bg-orange/10 hover:text-orange active:bg-orange/15"
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
