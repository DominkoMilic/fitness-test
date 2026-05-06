"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import type { AccessCodeRow } from "@/types/database";

type Props = {
  code: string;
  user: AccessCodeRow | null;
  loading: boolean;
  activeTab: "dashboard" | "favorites";
  children: ReactNode;
};

function formatExpireDateHR(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${Number(day)}.${Number(month)}.${year}.`;
}

export function AdminUserFrame({
  code,
  user,
  loading,
  activeTab,
  children,
}: Props) {
  if (loading) {
    return (
      <div className="px-5 py-5">
        <div
          className="kf-card bg-white rounded-2xl border border-border p-5 text-sm"
          style={{ color: "var(--color-muted)" }}
        >
          Učitavam korisnika...
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="px-5 py-5">
        <div className="kf-card bg-white rounded-2xl border border-border p-5">
          <div
            className="text-lg font-extrabold mb-2"
            style={{ color: "var(--color-navy)" }}
          >
            Korisnik nije pronađen
          </div>
          <div className="text-sm mb-4" style={{ color: "var(--color-muted)" }}>
            Kod {code} ne postoji ili više nije dostupan.
          </div>
          <Link
            href="/admin"
            className="inline-flex px-4 py-2 rounded-xl bg-linear-to-br from-navy to-[#162844] text-white text-sm font-bold"
          >
            Natrag na admin
          </Link>
        </div>
      </div>
    );
  }

  const tabs = [
    {
      href: `/admin/users/${user.code}/dashboard`,
      label: "Dnevnik",
      key: "dashboard" as const,
    },
    {
      href: `/admin/users/${user.code}/favorites`,
      label: "Omiljeni",
      key: "favorites" as const,
    },
  ];

  return (
    <div className="px-5 py-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-sm font-bold mb-2"
            style={{ color: "var(--color-navy)" }}
          >
            <span>←</span>
            <span>Natrag na admin</span>
          </Link>
          <div
            className="text-xl font-extrabold"
            style={{ color: "var(--color-navy)" }}
          >
            {user.name}
          </div>
          <div className="text-sm mt-1" style={{ color: "var(--color-muted)" }}>
            Kod: {user.code} · cilj: {user.goal} kcal · vrijedi do{" "}
            {formatExpireDateHR(user.exp)}
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto">
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={`px-4 py-2 rounded-full text-sm font-bold border ${active ? "bg-navy border-navy text-white" : "bg-white border-border"}`}
              style={{ color: active ? "#fff" : "var(--color-muted)" }}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <div
        className="mb-4 rounded-2xl border border-border bg-white px-4 py-3 text-[12px] font-semibold"
        style={{ color: "var(--color-muted)" }}
      >
        Admin ovdje može samo pregledavati podatke korisnika. Dodavanje,
        uređivanje i brisanje su onemogućeni.
      </div>

      {children}
    </div>
  );
}
