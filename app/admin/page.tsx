"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CodeForm } from "@/components/admin/CodeForm";
import { CodeList } from "@/components/admin/CodeList";
import { SyncSection } from "@/components/admin/SyncSection";
import { SyncPreviewModal } from "@/components/modals/SyncPreviewModal";
import { ConfirmPopup } from "@/components/ui/ConfirmPopup";
import {
  clearAdminAuthenticated,
  isAdminAuthenticated,
} from "@/lib/utils/adminAuth";
import { PrivacyFooter } from "@/components/legal/PrivacyFooter";

export default function AdminPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await isAdminAuthenticated();
      if (cancelled) return;
      if (ok) setAuthed(true);
      else router.replace("/admin/login");
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!authed) return null;

  const onLogout = async () => {
    setConfirmOpen(false);
    await clearAdminAuthenticated();
    router.replace("/admin/login");
  };

  return (
    <>
      <div className="px-5 py-5">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.replace("/login")}
              className="text-2xl"
              style={{ color: "var(--color-navy)" }}
            >
              ←
            </button>
            <div
              className="text-lg font-extrabold"
              style={{ color: "var(--color-navy)" }}
            >
              Admin panel
            </div>
          </div>
          <button
            onClick={() => setConfirmOpen(true)}
            className="px-3 py-1.5 rounded-lg border text-xs font-bold"
            style={{
              borderColor: "var(--color-border)",
              color: "var(--color-muted)",
            }}
          >
            Odjava
          </button>
        </div>
        <CodeForm onCreated={() => setRefreshKey((k) => k + 1)} />
        <SyncSection />
        <CodeList refreshKey={refreshKey} />
        <SyncPreviewModal />
        <PrivacyFooter />
      </div>
      <ConfirmPopup
        open={confirmOpen}
        question="Jeste li sigurni da se želite odjaviti iz admin panela?"
        onClose={() => setConfirmOpen(false)}
        button1={{
          text: "Ne",
          variant: "cancel",
          onClick: () => setConfirmOpen(false),
        }}
        button2={{
          text: "Da",
          variant: "orange",
          onClick: onLogout,
        }}
      />
    </>
  );
}
