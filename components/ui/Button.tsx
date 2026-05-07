"use client";
import { ButtonHTMLAttributes } from "react";
import { motion } from "framer-motion";

type Variant = "primary" | "navy" | "cancel" | "orange";

const styles: Record<Variant, string> = {
  primary: "bg-gradient-to-br from-[#c85a10] to-[#a84a0d] text-white",
  navy: "bg-gradient-to-br from-[#1b3255] to-[#162844] text-white",
  cancel: "border border-border text-[var(--color-muted)] bg-[var(--color-bg)]",
  orange: "bg-gradient-to-br from-[#c85a10] to-[#a84a0d] text-white",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
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
