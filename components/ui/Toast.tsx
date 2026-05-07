"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useUIStore } from "@/store/useUIStore";

export function Toast() {
  const toast = useUIStore((s) => s.toast);
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast}
          className="fixed left-1/2 z-200 px-5 py-3 rounded-3xl text-[13px] font-semibold shadow-lg whitespace-nowrap text-white pointer-events-none"
          style={{
            background: "var(--color-navy)",
            bottom: "calc(90px + env(safe-area-inset-bottom))",
          }}
          initial={{ opacity: 0, y: 20, x: "-50%" }}
          animate={{ opacity: 1, y: 0, x: "-50%" }}
          exit={{ opacity: 0, y: 20, x: "-50%" }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          {toast}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
