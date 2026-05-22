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
  {
    href: "/recepti",
    label: "Recepti",
    icon: (
      <svg
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        viewBox="0 0 24 24"
        width={20}
        height={20}
      >
        {/* Fork */}
        <path d="M7 3v7" />
        <path d="M5 3v4a2 2 0 0 0 4 0V3" />
        <path d="M7 10v11" />
        {/* Knife */}
        <path d="M17 3c-2 1.5-3 4-3 6.5 0 1.5 1 2.5 3 2.5" />
        <path d="M17 3v18" />
      </svg>
    ),
  },
  {
    href: "/kalendar",
    label: "Kalendar",
    icon: (
      <svg
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
        width={20}
        height={20}
      >
        <rect x={3} y={5} width={18} height={16} rx={2} />
        <path d="M3 9h18M8 3v4M16 3v4" />
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
