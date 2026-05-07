"use client";
import { ReactNode } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
};

export function Modal({ open, onClose, children, className = "" }: Props) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-100 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-t-3xl w-full max-w-107.5 px-5 pt-6 relative ${className}`}
        style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
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
      </div>
    </div>
  );
}
