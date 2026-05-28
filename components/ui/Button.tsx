"use client";
import { ButtonHTMLAttributes } from "react";
import { motion } from "framer-motion";

type Variant = "primary" | "navy" | "cancel" | "orange";

// Tailwind v4 renamed `bg-gradient-to-*` → `bg-linear-to-*`. Using the
// v3 names produced an invisible white-on-white button for the reporter
// because the gradient class silently dropped (e.g. iOS WebKit on a
// fresh JIT-compiled CSS bundle). All gradient utilities in this repo
// must use the v4 form.
const styles: Record<Variant, string> = {
  primary: "bg-linear-to-br from-[#c85a10] to-[#a84a0d] text-white",
  navy: "bg-linear-to-br from-[#1b3255] to-[#162844] text-white",
  cancel: "border border-border text-[var(--color-muted)] bg-[var(--color-bg)]",
  orange: "bg-linear-to-br from-[#c85a10] to-[#a84a0d] text-white",
};

type Props = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  | "onAnimationStart"
  | "onAnimationEnd"
  | "onAnimationIteration"
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
  | "onDragEnter"
  | "onDragLeave"
  | "onDragOver"
  | "onDragExit"
> & {
  variant?: Variant;
  full?: boolean;
};

export function Button({
  variant = "primary",
  full,
  className = "",
  ...rest
}: Props) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={`py-3.5 px-4 rounded-xl text-[15px] font-bold cursor-pointer ${styles[variant]} ${full ? "w-full" : ""} ${className}`}
      {...rest}
    />
  );
}
