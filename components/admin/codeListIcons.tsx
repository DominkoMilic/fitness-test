"use client";

export function WarningTriangle({ className = "" }: { className?: string }) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2.5L1.5 21.5h21L12 2.5zM11 10h2v5h-2v-5zm0 7h2v2h-2v-2z"
      />
    </svg>
  );
}

export function FlameIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M13.5 0.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73S7.32 7.53 7.32 5.47l.03-.36C5.35 7.5 4 10.79 4 14.34a8 8 0 0 0 16 0c0-4.34-2.09-8.21-5.05-10.93l-1.45-2.74z" />
    </svg>
  );
}
