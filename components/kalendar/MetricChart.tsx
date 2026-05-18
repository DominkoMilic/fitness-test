"use client";

type Point = { label: string; value: number | null };

type Props = {
  title: string;
  unit: string;
  color: string;
  points: Point[];
  /** Optional fixed value baseline rendered as a dashed reference line. */
  reference?: { value: number; label: string };
  formatValue?: (n: number) => string;
};

const W = 320;
const H = 140;
const PAD_L = 32;
const PAD_R = 12;
const PAD_T = 14;
const PAD_B = 26;

const defaultFormat = (n: number) => String(Math.round(n * 10) / 10);

export function MetricChart({
  title,
  unit,
  color,
  points,
  reference,
  formatValue = defaultFormat,
}: Props) {
  const values = points
    .map((p) => p.value)
    .filter((v): v is number => v != null);
  const hasData = values.length > 0;

  // Y-domain: pad ±5% around min/max so the line isn't pinned to the edges.
  let yMin = 0;
  let yMax = 1;
  if (hasData) {
    yMin = Math.min(...values, reference?.value ?? Infinity);
    yMax = Math.max(...values, reference?.value ?? -Infinity);
    if (yMin === yMax) {
      yMin = yMin - 1;
      yMax = yMax + 1;
    } else {
      const span = yMax - yMin;
      yMin -= span * 0.1;
      yMax += span * 0.15;
    }
  }

  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const xFor = (i: number) =>
    PAD_L +
    (points.length === 1 ? innerW / 2 : (i * innerW) / (points.length - 1));
  const yFor = (v: number) =>
    PAD_T + innerH - ((v - yMin) / (yMax - yMin)) * innerH;

  // Build polyline segments split on null gaps so the line doesn't connect
  // across missing days.
  const segments: { x: number; y: number }[][] = [];
  let current: { x: number; y: number }[] = [];
  points.forEach((p, i) => {
    if (p.value == null) {
      if (current.length) {
        segments.push(current);
        current = [];
      }
    } else {
      current.push({ x: xFor(i), y: yFor(p.value) });
    }
  });
  if (current.length) segments.push(current);

  // Y-axis grid: 3 tick lines.
  const ticks = hasData ? [yMin, (yMin + yMax) / 2, yMax] : [0, 0.5, 1];

  return (
    <div className="kf-card mx-3 mb-3 bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border">
        <span
          className="text-sm font-bold"
          style={{ color: "var(--color-navy)" }}
        >
          {title}
        </span>
        <span
          className="text-[11px] font-semibold"
          style={{ color: "var(--color-muted)" }}
        >
          {hasData
            ? `Tjedna sredina: ${formatValue(values.reduce((s, v) => s + v, 0) / points.length)} ${unit}`
            : "—"}
        </span>
      </div>
      <div className="p-2.5">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={title}
        >
          {ticks.map((t, i) => {
            const y = yFor(t);
            return (
              <g key={i}>
                <line
                  x1={PAD_L}
                  x2={W - PAD_R}
                  y1={y}
                  y2={y}
                  stroke="var(--color-border)"
                  strokeDasharray={i === 1 ? "0" : "2 3"}
                  strokeWidth={1}
                />
                <text
                  x={PAD_L - 4}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="9"
                  fill="var(--color-muted)"
                >
                  {hasData ? formatValue(t) : ""}
                </text>
              </g>
            );
          })}

          {reference && hasData && (
            <line
              x1={PAD_L}
              x2={W - PAD_R}
              y1={yFor(reference.value)}
              y2={yFor(reference.value)}
              stroke="var(--color-orange)"
              strokeDasharray="3 3"
              strokeWidth={1.25}
              opacity={0.7}
            />
          )}

          {segments.map((seg, idx) => (
            <polyline
              key={idx}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              points={seg.map((p) => `${p.x},${p.y}`).join(" ")}
            />
          ))}

          {points.map((p, i) => {
            if (p.value == null) return null;
            return (
              <circle
                key={i}
                cx={xFor(i)}
                cy={yFor(p.value)}
                r={3}
                fill={color}
                stroke="white"
                strokeWidth={1.5}
              />
            );
          })}

          {points.map((p, i) => (
            <text
              key={`l-${i}`}
              x={xFor(i)}
              y={H - 8}
              textAnchor="middle"
              fontSize="10"
              fontWeight={600}
              fill="var(--color-muted)"
            >
              {p.label}
            </text>
          ))}

          {!hasData && (
            <text
              x={W / 2}
              y={H / 2}
              textAnchor="middle"
              fontSize="11"
              fill="var(--color-muted)"
            >
              Nema podataka za tjedan
            </text>
          )}
        </svg>
      </div>
    </div>
  );
}
