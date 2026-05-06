"use client";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onScan: () => void;
};

export function SearchBar({ value, onChange, onScan }: Props) {
  return (
    <div className="flex items-center gap-2.5 px-5 py-3.5 bg-white border-b border-border sticky top-[58px] z-[5]">
      <div className="flex items-center gap-2 flex-1 px-3 py-2 rounded-xl border-2 border-[var(--color-orange)] bg-[var(--color-bg)]">
        <svg
          width={16}
          height={16}
          fill="none"
          stroke="var(--color-orange)"
          strokeWidth={2.5}
          viewBox="0 0 24 24"
        >
          <circle cx={11} cy={11} r={8} />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Pretraži namirnicu..."
          autoCorrect="off"
          autoComplete="off"
          className="flex-1 outline-none bg-transparent text-base"
        />
      </div>
      <button
        onClick={onScan}
        className="bg-[var(--color-navy)] rounded-lg p-2.5 flex items-center"
      >
        <svg
          width={18}
          height={18}
          fill="none"
          stroke="#fff"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path d="M3 9V5a2 2 0 0 1 2-2h4M15 3h4a2 2 0 0 1 2 2v4M21 15v4a2 2 0 0 1-2 2h-4M9 21H5a2 2 0 0 1-2-2v-4" />
          <line x1={7} y1={12} x2={7} y2={12.01} />
          <line x1={12} y1={8} x2={12} y2={16} />
          <line x1={17} y1={12} x2={17} y2={12.01} />
        </svg>
      </button>
    </div>
  );
}
