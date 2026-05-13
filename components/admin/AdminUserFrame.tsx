"use client";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import type { AccessCodeRow } from "@/types/database";
import { Modal } from "@/components/ui/Modal";
import { ConfirmPopup } from "@/components/ui/ConfirmPopup";
import { InlineLoading } from "@/components/ui/Loading";
import { updateCodeExpiry } from "@/lib/api/codes";
import { todayISO } from "@/lib/utils/date";
import { useUIStore } from "@/store/useUIStore";
import { PrivacyFooter } from "@/components/legal/PrivacyFooter";

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

function dayBefore(isoDate: string) {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split("T")[0] ?? isoDate;
}

export function AdminUserFrame({
  code,
  user,
  loading,
  activeTab,
  children,
}: Props) {
  const showToast = useUIStore((s) => s.showToast);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [displayExp, setDisplayExp] = useState(user?.exp ?? "");
  const [expDraft, setExpDraft] = useState(user?.exp ?? "");

  useEffect(() => {
    setDisplayExp(user?.exp ?? "");
    setExpDraft(user?.exp ?? "");
  }, [user?.id, user?.exp]);

  const onOpenEdit = () => {
    setExpDraft(displayExp || user?.exp || "");
    setEditOpen(true);
  };

  const onSaveExp = async () => {
    if (!user || !expDraft) return;
    setSaving(true);
    try {
      await updateCodeExpiry(user.code, expDraft);
      setDisplayExp(expDraft);
      setEditOpen(false);
      showToast("Datum isteka je ažuriran");
    } catch {
      showToast("Greška pri spremanju datuma isteka");
    } finally {
      setSaving(false);
    }
  };

  const activeExp = displayExp || user?.exp || "";

  const onOpenCancel = () => {
    if (activeExp < todayISO()) {
      showToast("Ovaj kod je već istekao");
      return;
    }
    setCancelOpen(true);
  };

  const onConfirmCancel = async () => {
    if (!user) return;

    const today = todayISO();
    if (activeExp < today) {
      setCancelOpen(false);
      showToast("Ovaj kod je već istekao");
      return;
    }

    const cancelExp = dayBefore(today);
    setCancelling(true);
    try {
      await updateCodeExpiry(user.code, cancelExp);
      setDisplayExp(cancelExp);
      setExpDraft(cancelExp);
      setCancelOpen(false);
      showToast("Račun je privremeno ukinut");
    } catch {
      showToast("Greška pri ukidanju računa");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="px-5 py-5">
        <div className="kf-card bg-white rounded-2xl border border-border p-2">
          <InlineLoading text="Pričekajte..." className="py-10" />
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
            {formatExpireDateHR(activeExp)}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={onOpenEdit}
              className="inline-flex px-3 py-1.5 rounded-full text-[11px] font-bold border border-orange/30 bg-orange/10"
              style={{ color: "var(--color-orange)" }}
            >
              Produži / skrati datum isteka
            </button>
            <button
              onClick={onOpenCancel}
              className="inline-flex px-3 py-1.5 rounded-full text-[11px] font-bold border border-red-300 bg-red-50"
              style={{ color: "#b42318" }}
            >
              Ukini račun
            </button>
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

      <PrivacyFooter />

      <Modal open={editOpen} onClose={() => setEditOpen(false)}>
        <div
          className="text-base font-extrabold mb-1"
          style={{ color: "var(--color-navy)" }}
        >
          Uredi datum isteka koda
        </div>
        <div
          className="text-[13px] mb-4"
          style={{ color: "var(--color-muted)" }}
        >
          Korisnik: {user.name} ({user.code})
        </div>
        <div
          className="text-[11px] font-bold uppercase tracking-wider mb-1.5"
          style={{ color: "var(--color-muted)" }}
        >
          Novi datum isteka
        </div>
        <input
          type="date"
          value={expDraft}
          onChange={(e) => setExpDraft(e.target.value)}
          className="w-full py-3 px-3.5 rounded-xl text-base font-semibold outline-none border-[1.5px] border-border focus:border-orange text-navy mb-4"
        />
        <div
          className="text-[12px] mb-4"
          style={{ color: "var(--color-muted)" }}
        >
          Trenutno: {formatExpireDateHR(activeExp)}
        </div>
        <div className="flex gap-2.5">
          <button
            onClick={() => setEditOpen(false)}
            className="flex-1 py-3.5 rounded-xl border-[1.5px] border-border bg-bg text-[15px] font-semibold"
            style={{ color: "var(--color-muted)" }}
          >
            Odustani
          </button>
          <button
            onClick={onSaveExp}
            disabled={saving || !expDraft}
            className="flex-2 py-3.5 rounded-xl bg-linear-to-br from-orange to-orange-dark text-white text-[15px] font-bold"
          >
            {saving ? "Spremam..." : "Spremi datum"}
          </button>
        </div>
      </Modal>

      <ConfirmPopup
        open={cancelOpen}
        question="Jesi li siguran da želiš privremeno ukinuti ovaj račun?"
        onClose={() => {
          if (!cancelling) setCancelOpen(false);
        }}
        button1={{
          text: "Ne",
          variant: "cancel",
          onClick: () => {
            if (!cancelling) setCancelOpen(false);
          },
        }}
        button2={{
          text: cancelling ? "Ukidam..." : "Da",
          variant: "orange",
          onClick: onConfirmCancel,
        }}
      />
    </div>
  );
}
