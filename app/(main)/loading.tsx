export default function MainLoading() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-5"
      style={{ background: "linear-gradient(160deg,#1b3255 0%,#0e1e36 100%)" }}
    >
      <div className="relative w-16 h-16 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full border-4 border-white/15" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-white spin" />
        <div
          className="w-4 h-4 rounded-full"
          style={{ background: "var(--color-orange)" }}
        />
      </div>
      <div className="flex flex-col items-center gap-1">
        <div className="text-white text-sm font-extrabold tracking-wide">
          Krešimir Fit
        </div>
        <div className="text-white/75 text-[12px] font-semibold">
          Učitavam stranicu...
        </div>
      </div>
    </div>
  );
}
