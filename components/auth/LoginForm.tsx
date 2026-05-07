"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { useUIStore } from "@/store/useUIStore";
import { PrivacyFooter } from "@/components/legal/PrivacyFooter";

export function LoginForm() {
  const login = useAuthStore((s) => s.login);
  const setLoading = useUIStore((s) => s.setLoading);
  const router = useRouter();
  const [code, setCode] = useState("");
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    setErr(false);
    setBusy(true);
    const ok = await login(code.trim().toUpperCase());
    setBusy(false);
    if (ok) {
      setLoading(true);
      router.push("/dashboard");
    } else {
      setErr(true);
      setLoading(false);
    }
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
          Krešimir Fit
        </div>
      </div>
      <div
        className="text-center text-[13px] mb-8 leading-snug"
        style={{ color: "rgba(255,255,255,0.45)" }}
      >
        Unesi pristupni kod
        <br />
        za pristup trackeru
      </div>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        onKeyDown={(e) => e.key === "Enter" && onSubmit()}
        placeholder="Unesi kod"
        maxLength={12}
        autoComplete="off"
        autoCorrect="off"
        className="w-full max-w-sm py-4 mb-4 rounded-2xl text-white text-xl font-bold text-center outline-none border border-white/15 bg-white/10 tracking-[5px]"
      />
      <button
        onClick={onSubmit}
        disabled={busy}
        className="w-full max-w-sm py-4 rounded-2xl text-white text-base font-bold bg-linear-to-br from-orange to-orange-dark"
      >
        {busy ? "Prijava..." : "Kreni"}
      </button>
      {err && (
        <div className="text-[13px] mt-3 text-red-300">
          Nevažeći ili istekli kod.
        </div>
      )}
      <Link
        href="/admin"
        className="mt-10 text-[11px]"
        style={{ color: "rgba(255,255,255,0.15)" }}
      >
        admin
      </Link>
      <PrivacyFooter className="mt-6 text-white/40" />
    </div>
  );
}
