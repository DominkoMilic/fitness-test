import { Fragment, type ReactNode } from "react";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Wraps occurrences of `query` (case-insensitive) inside `text` in <mark>
 * elements. Returns the original text untouched when `query` is empty.
 */
export function highlightMatch(text: string, query: string): ReactNode {
  const q = query.trim();
  if (!q) return text;

  const rx = new RegExp(`(${escapeRegExp(q)})`, "ig");
  const parts = text.split(rx);

  return parts.map((part, idx) =>
    part.toLowerCase() === q.toLowerCase() ? (
      <mark
        key={`${part}-${idx}`}
        className="px-0.5 rounded bg-orange/20"
        style={{ color: "var(--color-navy)" }}
      >
        {part}
      </mark>
    ) : (
      <Fragment key={`${part}-${idx}`}>{part}</Fragment>
    ),
  );
}
