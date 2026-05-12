"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmPopup } from "@/components/ui/ConfirmPopup";
import { useAuthStore } from "@/store/useAuthStore";
import { useUIStore } from "@/store/useUIStore";

export default function SettingsPage() {
  const router = useRouter();
  const showToast = useUIStore((s) => s.showToast);
  const setLoading = useUIStore((s) => s.setLoading);
  const user = useAuthStore((s) => s.user);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const onExport = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/me/export", { credentials: "same-origin" });
      if (!res.ok) throw new Error("Export nije uspio");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kresimir-fit-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast("Preuzimanje pokrenuto");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Greška pri preuzimanju");
    } finally {
      setLoading(false);
    }
  };

  const onDeleteAccount = async () => {
    setConfirmDelete(false);
    setLoading(true);
    try {
      const res = await fetch("/api/me", {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error || "Brisanje računa nije uspjelo");
      }
      // Mirror useAuthStore.logout side effects locally.
      try {
        window.localStorage.removeItem("kf_saved_code");
        window.localStorage.removeItem("kf_foods_cache");
        window.localStorage.removeItem("kf_foods_cache_ts");
      } catch {
        /* ignore */
      }
      showToast("Račun obrisan");
      router.replace("/login");
      // Force store reset on next mount.
      window.location.assign("/login");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Greška");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-5 py-5 max-w-2xl mx-auto">
      <div
        className="text-xl font-extrabold mb-1"
        style={{ color: "var(--color-navy)" }}
      >
        Postavke
      </div>
      <div
        className="text-[13px] mb-6"
        style={{ color: "var(--color-muted)" }}
      >
        {user ? `Račun: ${user.name} (${user.code})` : null}
      </div>

      <Section title="Moji podaci (GDPR)">
        <p
          className="text-[13px] mb-3 leading-snug"
          style={{ color: "var(--color-muted)" }}
        >
          Sukladno GDPR-u imaš pravo preuzeti kopiju svojih podataka ili
          zatražiti brisanje računa.
        </p>
        <button
          onClick={onExport}
          className="w-full py-3 rounded-xl border-[1.5px] border-border bg-white text-[14px] font-bold mb-3"
          style={{ color: "var(--color-navy)" }}
        >
          Preuzmi moje podatke (JSON)
        </button>
        <button
          onClick={() => setConfirmDelete(true)}
          className="w-full py-3 rounded-xl border-[1.5px] text-[14px] font-bold"
          style={{
            borderColor: "var(--color-orange-dark, #c86a1a)",
            color: "var(--color-orange-dark, #c86a1a)",
            background: "rgba(200,106,26,0.06)",
          }}
        >
          Obriši moj račun trajno
        </button>
      </Section>

      <ConfirmPopup
        open={confirmDelete}
        question="Brisanje računa je trajno. Svi tvoji dnevnici, omiljeni obroci i povijest pretrage biti će obrisani. Nastaviti?"
        onClose={() => setConfirmDelete(false)}
        button1={{
          text: "Ne",
          variant: "cancel",
          onClick: () => setConfirmDelete(false),
        }}
        button2={{
          text: "Da, obriši",
          variant: "orange",
          onClick: onDeleteAccount,
        }}
      />
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="kf-card bg-white rounded-2xl border border-border p-5 mb-4">
      <div
        className="text-sm font-extrabold mb-3"
        style={{ color: "var(--color-navy)" }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}
