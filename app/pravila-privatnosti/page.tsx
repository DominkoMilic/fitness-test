import Link from "next/link";
import {
  PRIVACY_LAST_UPDATED,
  PRIVACY_OPERATOR,
  PRIVACY_SECTIONS,
} from "@/lib/legal/privacyPolicy";
import { croatianMonthYear } from "@/lib/utils/croatianDate";

export const metadata = {
  title: "Pravila privatnosti — Krešimir Fit Tracker",
  description: "Pravila privatnosti i zaštita osobnih podataka (GDPR).",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="px-5 py-6 max-w-3xl mx-auto">
      <Link
        href="/dashboard"
        className="text-[13px] font-semibold inline-flex items-center gap-1 mb-4"
        style={{ color: "var(--color-muted)" }}
      >
        ← Natrag
      </Link>
      <h1
        className="text-2xl font-extrabold mb-1"
        style={{ color: "var(--color-navy)" }}
      >
        Pravila privatnosti
      </h1>
      <p className="text-[13px] mb-6" style={{ color: "var(--color-muted)" }}>
        Posljednje ažuriranje: {croatianMonthYear(PRIVACY_LAST_UPDATED)}
      </p>

      {PRIVACY_SECTIONS.map((s) => (
        <section key={s.id} className="mb-6">
          <h2
            className="text-lg font-bold mb-2"
            style={{ color: "var(--color-navy)" }}
          >
            {s.title}
          </h2>
          {s.paragraphs.map((p, i) => (
            <p
              key={i}
              className="text-[14px] leading-relaxed mb-2"
              style={{ color: "var(--color-navy)" }}
            >
              {p}
            </p>
          ))}
          {s.bullets && (
            <ul
              className="list-disc pl-5 text-[14px] leading-relaxed space-y-1 mt-1"
              style={{ color: "var(--color-navy)" }}
            >
              {s.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <hr className="my-6 border-border" />
      <p
        className="text-[12px] leading-relaxed"
        style={{ color: "var(--color-muted)" }}
      >
        Voditelj obrade: {PRIVACY_OPERATOR.companyName} · OIB:{" "}
        {PRIVACY_OPERATOR.oib} · {PRIVACY_OPERATOR.address} · Kontakt:{" "}
        {PRIVACY_OPERATOR.contactEmail}
      </p>
    </main>
  );
}
