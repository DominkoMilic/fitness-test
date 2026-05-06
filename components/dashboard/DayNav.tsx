"use client";
import { useDayStore } from "@/store/useDayStore";
import { dayLabels } from "@/lib/utils/date";

type Props = {
  offset?: number;
  onChangeDay?: (dir: number) => void;
};

export function DayNav({ offset: controlledOffset, onChangeDay }: Props) {
  const storeOffset = useDayStore((s) => s.offset);
  const storeChangeDay = useDayStore((s) => s.changeDay);
  const offset = controlledOffset ?? storeOffset;
  const changeDay = onChangeDay ?? storeChangeDay;
  const { label, formatted, isToday } = dayLabels(offset);

  return (
    <div className="flex items-center justify-between mb-5 w-full px-1">
      <Btn onClick={() => changeDay(-1)}>‹</Btn>
      <div className="text-center flex-1">
        <div className="text-white text-[15px] font-bold">{label}</div>
        <div
          className="text-[11px] mt-0.5"
          style={{ color: "rgba(255,255,255,0.45)" }}
        >
          {formatted}
        </div>
        {isToday && (
          <div className="inline-block bg-orange text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full mt-1 tracking-wider">
            DANAS
          </div>
        )}
      </div>
      <Btn onClick={() => changeDay(1)}>›</Btn>
    </div>
  );
}

function Btn({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-10 h-10 rounded-full text-white text-xl flex items-center justify-center border border-white/20 bg-white/10 active:bg-white/25"
    >
      {children}
    </button>
  );
}
