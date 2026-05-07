"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  isAdminAuthenticated,
  setAdminAuthenticated,
} from "@/lib/utils/adminAuth";
import { PrivacyFooter } from "@/components/legal/PrivacyFooter";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (isAdminAuthenticated()) router.replace("/admin");
  }, [router]);

  const onSubmit = async () => {
    setErr(false);
    setBusy(true);
    const ok = setAdminAuthenticated(password.trim());
    setBusy(false);

    if (ok) router.replace("/admin");
    else setErr(true);
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-8"
      style={{ background: "linear-gradient(160deg,#1b3255 0%,#0e1e36 100%)" }}
    >
      <div className="flex flex-col items-center gap-4 mb-8">
        <div className="w-20 h-20 rounded-2xl bg-white flex items-center justify-center shadow-2xl overflow-hidden">
          <Image
            src="/icon-192.png"
            alt="Krešimir Fit"
            width={70}
            height={70}
            className="object-contain"
          />
        </div>
        <div className="text-white text-2xl font-extrabold tracking-tight">
          Admin prijava
        </div>
      </div>

      <div
        className="text-center text-[13px] mb-8 leading-snug"
        style={{ color: "rgba(255,255,255,0.45)" }}
      >
        Unesi administratorsku lozinku
        <br />
        za pristup panelu
      </div>

      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSubmit()}
        placeholder="Admin lozinka"
        autoComplete="current-password"
        className="w-full max-w-sm py-4 mb-4 rounded-2xl text-white text-lg font-semibold text-center outline-none border border-white/15 bg-white/10"
      />

      <button
        onClick={onSubmit}
        disabled={busy || !password.trim()}
        className="w-full max-w-sm py-4 rounded-2xl text-white text-base font-bold bg-linear-to-br from-orange to-orange-dark"
      >
        {busy ? "Provjera..." : "Uđi u admin"}
      </button>

      {err && (
        <div className="text-[13px] mt-3 text-red-300">
          Pogrešna lozinka. Pokušaj ponovno.
        </div>
      )}

      <Link
        href="/login"
        className="mt-10 text-[12px]"
        style={{ color: "rgba(255,255,255,0.5)" }}
      >
        ← Nazad na prijavu korisnika
      </Link>
      <PrivacyFooter className="mt-6 text-white/40" />
    </div>
  );
}
