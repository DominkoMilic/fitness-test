"use client";
import Link from "next/link";
import { useEffect } from "react";
import * as CookieConsent from "vanilla-cookieconsent";

type Props = {
  className?: string;
  variant?: "fixed" | "inline";
  style?: React.CSSProperties;
  /** Show the "Postavke" link. Only enable in authenticated user contexts;
   * leave off for admin pages and unauthenticated login screens. */
  showSettings?: boolean;
};

export function PrivacyFooter({
  className = "",
  variant = "inline",
  style,
  showSettings = false,
}: Props) {
  useEffect(() => {
    // No-op; ensures CC module is loaded before showPreferences is called.
  }, []);

  const onCookiePrefs = (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      CookieConsent.showPreferences();
    } catch {
      /* CC not initialised yet */
    }
  };

  const base =
    "text-[11px] text-center px-3 py-2 leading-snug flex items-center justify-center gap-2 flex-wrap";
  const layout = variant === "fixed" ? "" : "mt-6";

  return (
    <div
      className={`${base} ${layout} ${className}`}
      style={{ color: "var(--color-muted)", ...style }}
    >
      <Link href="/pravila-privatnosti" className="underline hover:opacity-80">
        Pravila privatnosti
      </Link>
      <span aria-hidden="true">·</span>
      {showSettings && (
        <>
          <Link href="/postavke" className="underline hover:opacity-80">
            Postavke
          </Link>
          <span aria-hidden="true">·</span>
        </>
      )}
      <button
        type="button"
        onClick={onCookiePrefs}
        className="underline hover:opacity-80"
      >
        Kolačići
      </button>
    </div>
  );
}
