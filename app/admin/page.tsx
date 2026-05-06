"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CodeForm } from "@/components/admin/CodeForm";
import { CodeList } from "@/components/admin/CodeList";
import { SyncSection } from "@/components/admin/SyncSection";
import { SyncPreviewModal } from "@/components/modals/SyncPreviewModal";

export default function AdminPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const pw = prompt("Admin lozinka:");
    if (pw === process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
      setAuthed(true);
    } else {
      if (pw !== null) alert("Pogrešna lozinka.");
      router.replace("/login");
    }
  }, [router]);

  if (!authed) return null;

  return (
    <div className="px-5 py-5">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.replace("/login")} className="text-2xl" style={{ color: "var(--color-navy)" }}>←</button>
        <div className="text-lg font-extrabold" style={{ color: "var(--color-navy)" }}>Admin panel</div>
      </div>
      <CodeForm onCreated={() => setRefreshKey((k) => k + 1)} />
      <SyncSection />
      <CodeList refreshKey={refreshKey} />
      <SyncPreviewModal />
    </div>
  );
}
