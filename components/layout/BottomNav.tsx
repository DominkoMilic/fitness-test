"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  {
    href: "/dashboard",
    label: "Danas",
    icon: (
      <svg
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
        width={20}
        height={20}
      >
        <circle cx={12} cy={12} r={10} />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
  },
  {
    href: "/search",
    label: "Dodaj",
    icon: (
      <svg
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
        width={20}
        height={20}
      >
        <circle cx={11} cy={11} r={8} />
        <path d="m21 21-4.35-4.35" />
      </svg>
    ),
  },
  {
    href: "/favorites",
    label: "Omiljeni",
    icon: (
      <svg
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
        width={20}
        height={20}
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
  },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 max-w-107.5 mx-auto z-10 flex bg-white border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {items.map((it) => {
        const active = path?.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`flex-1 flex flex-col items-center gap-0.5 py-3 text-[10px] transition-colors duration-150 hover:bg-black/3 active:bg-black/6 ${
              active ? "font-bold" : "font-medium"
            }`}
            style={{
              color: active ? "var(--color-navy)" : "var(--color-muted)",
            }}
          >
            {it.icon}
            {it.label}
            <div
              className="w-5 h-0.5 rounded-sm mt-0.5"
              style={{
                background: "var(--color-orange)",
                opacity: active ? 1 : 0,
              }}
            />
          </Link>
        );
      })}
    </nav>
  );
}
