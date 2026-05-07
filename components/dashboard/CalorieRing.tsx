"use client";

type Props = { eaten: number; goal: number };

// Badge zone thresholds
// < 25%  → yellow  "Unesi još kalorija do dnevnog cilja"
// 75–105% → green  "Dobar posao, unutar dnevne doze si"
// > 105%  → orange "Unijeli ste previše kalorija danas"
// 25–75%  → neutral (no badge colour accent, generic note)

const ZONE = {
  low: {
    ring: "#d0ad2f",
    shadow: "rgba(208,173,47,0.35)",
    badge: "#ffe070",
    badgeBg: "rgba(208,173,47,0.18)",
    text: "Unesi još kalorija do dnevnog cilja",
  },
  ok: {
    ring: "#2f9a5b",
    shadow: "rgba(47,154,91,0.35)",
    badge: "#6ce49a",
    badgeBg: "rgba(47,154,91,0.18)",
    text: "Dobar posao, unutar dnevne doze si",
  },
  over: {
    ring: "#c85a10",
    shadow: "rgba(200,90,16,0.35)",
    badge: "#ffb07a",
    badgeBg: "rgba(200,90,16,0.18)",
    text: "Unijeli ste previše kalorija danas",
  },
  normal: {
    ring: "#4a90d9",
    shadow: "rgba(74,144,217,0.30)",
    badge: "#d9e8ff",
    badgeBg: "rgba(255,255,255,0.10)",
    text: null,
  },
};

export function CalorieRing({ eaten, goal }: Props) {
  const safeGoal = Math.max(goal, 1);
  const ratio = eaten / safeGoal;
  const clampedRatio = Math.min(ratio, 1);
  const circ = 2 * Math.PI * 60;
  const offset = circ - circ * clampedRatio;
  const noIntakeYet = Math.round(eaten) === 0;

  const zone =
    ratio > 1.05
      ? ZONE.over
      : ratio >= 0.75
        ? ZONE.ok
        : ratio < 0.25 && !noIntakeYet
          ? ZONE.low
          : ZONE.normal;

  const remaining = Math.max(0, Math.round(goal - eaten));
  const over = Math.max(0, Math.round(eaten - goal));

  const subNote = noIntakeYet
    ? "Unesite današnje obroke kako biste pratili napredak."
    : ratio > 1.05
      ? `Prešli ste cilj za otprilike ${over} kcal.`
      : ratio >= 0.75
        ? null
        : `Preostalo: otprilike ${remaining} kcal do dnevnog cilja.`;

  return (
    <div className="mx-auto mb-5 flex flex-col items-center">
      {/* Ring */}
      <div className="relative w-37 h-37">
        <svg
          viewBox="0 0 148 148"
          width={148}
          height={148}
          style={{
            transform: "rotate(-90deg)",
            filter: `drop-shadow(0 4px 12px ${zone.shadow})`,
          }}
        >
          <circle
            cx={74}
            cy={74}
            r={60}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={13}
          />
          <circle
            cx={74}
            cy={74}
            r={60}
            fill="none"
            stroke={zone.ring}
            strokeWidth={13}
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <div className="text-white text-[28px] font-extrabold leading-none">
            {Math.round(eaten)}
          </div>
          <div
            className="text-[11px] mt-1"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            kcal uneseno
          </div>
          <div
            className="text-[12px]"
            style={{ color: "rgba(255,255,255,0.6)" }}
          >
            cilj: {goal}
          </div>
        </div>
      </div>

      {/* Zone badge — only shown when a named zone is active */}
      {zone.text && (
        <div
          className="mt-2 px-3.5 py-1.5 rounded-full text-[12px] font-bold tracking-wide"
          style={{
            color: zone.badge,
            background: zone.badgeBg,
            border: `1px solid ${zone.badge}40`,
          }}
        >
          {zone.text}
        </div>
      )}

      {/* Secondary sub-note (remaining / over kcal) */}
      {subNote && (
        <div
          className="mt-1.5 text-center text-[11px] font-semibold px-3 py-1 rounded-full border border-white/10 bg-white/10"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          {subNote}
        </div>
      )}
    </div>
  );
}
