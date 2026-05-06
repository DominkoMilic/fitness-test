"use client";

type Props = { eaten: number; goal: number };

export function CalorieRing({ eaten, goal }: Props) {
  const circ = 2 * Math.PI * 60;
  const offset = circ - circ * Math.min(eaten / goal, 1);
  return (
    <div className="relative w-[148px] h-[148px] mx-auto mb-5">
      <svg viewBox="0 0 148 148" width={148} height={148} style={{ transform: "rotate(-90deg)", filter: "drop-shadow(0 4px 12px rgba(200,90,16,0.3))" }}>
        <circle cx={74} cy={74} r={60} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={13} />
        <circle
          cx={74}
          cy={74}
          r={60}
          fill="none"
          stroke="#c85a10"
          strokeWidth={13}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
        <div className="text-white text-[28px] font-extrabold leading-none">{Math.round(eaten)}</div>
        <div className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>kcal uneseno</div>
        <div className="text-[12px]" style={{ color: "rgba(255,255,255,0.6)" }}>cilj: {goal}</div>
      </div>
    </div>
  );
}
