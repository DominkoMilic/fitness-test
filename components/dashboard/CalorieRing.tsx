"use client";

type Props = { eaten: number; goal: number };

export function CalorieRing({ eaten, goal }: Props) {
  const safeGoal = Math.max(goal, 1);
  const ratio = eaten / safeGoal;
  const clampedRatio = Math.min(ratio, 1);
  const circ = 2 * Math.PI * 60;
  const offset = circ - circ * clampedRatio;

  const ringColor =
    ratio > 1 ? "#c85a10" : ratio >= 0.9 ? "#d0ad2f" : "#2f9a5b";
  const shadowColor =
    ratio > 1
      ? "rgba(200,90,16,0.35)"
      : ratio >= 0.9
        ? "rgba(208,173,47,0.35)"
        : "rgba(47,154,91,0.35)";

  const remaining = Math.max(0, Math.round(goal - eaten));
  const over = Math.max(0, Math.round(eaten - goal));
  const noIntakeYet = Math.round(eaten) === 0;

  const note = noIntakeYet
    ? "Unesite današnje obroke kako biste pratili svoj napredak."
    : ratio > 1
      ? `Prešli ste dnevni cilj za ${over} kcal.`
      : ratio >= 0.9
        ? `Pažnja: ostalo je još ${remaining} kcal do cilja.`
        : `Super tempo! Danas vam je preostalo ${remaining} kcal.`;

  const noteTone = noIntakeYet
    ? "#d9e8ff"
    : ratio > 1
      ? "#ffd6bf"
      : ratio >= 0.9
        ? "#ffe8a3"
        : "#c7f0d6";

  return (
    <div className="mx-auto mb-5 flex flex-col items-center">
      <div className="relative w-37 h-37">
        <svg
          viewBox="0 0 148 148"
          width={148}
          height={148}
          style={{
            transform: "rotate(-90deg)",
            filter: `drop-shadow(0 4px 12px ${shadowColor})`,
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
            stroke={ringColor}
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
      <div
        className="mt-2 text-center text-[11px] font-semibold px-3 py-1.5 rounded-full border border-white/10 bg-white/10"
        style={{ color: noteTone }}
      >
        {note}
      </div>
    </div>
  );
}
