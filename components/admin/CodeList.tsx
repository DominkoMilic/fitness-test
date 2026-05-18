"use client";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { deleteCode as apiDelete } from "@/lib/api/codes";
import { listUserActivity } from "@/lib/api/userActivity";
import type { UserActivityRow } from "@/types/database";
import { useUIStore } from "@/store/useUIStore";
import { ConfirmPopup } from "@/components/ui/ConfirmPopup";
import { InlineLoading } from "@/components/ui/Loading";
import { Pagination } from "@/components/ui/Pagination";
import { todayISO } from "@/lib/utils/date";
import { useIsClientMounted } from "@/hooks/useIsClientMounted";
import { CodeRow } from "./CodeRow";
import {
  PAGE_SIZE,
  SCROLL_KEY,
  readPersistedState,
  sortByNewest,
  writePersistedState,
  type UserFilter,
} from "./codeListUtils";

export function CodeList(props: { refreshKey: number }) {
  // Render nothing during SSR so the inner component's useState lazy
  // initializers — which read sessionStorage — run only on the client.
  // Otherwise React reuses the server-rendered state (where sessionStorage
  // is unavailable) and persisted state is lost.
  const mounted = useIsClientMounted();
  if (!mounted) return null;
  return <CodeListInner {...props} />;
}

function CodeListInner({ refreshKey }: { refreshKey: number }) {
  const [codes, setCodes] = useState<UserActivityRow[] | null>(null);
  const [filter, setFilter] = useState<UserFilter>(
    () => readPersistedState().filter ?? "active",
  );
  const [query, setQuery] = useState<string>(
    () => readPersistedState().query ?? "",
  );
  const [page, setPage] = useState<number>(
    () => readPersistedState().page ?? 1,
  );
  const [pendingDeleteCode, setPendingDeleteCode] = useState<string | null>(
    null,
  );
  const skipFirstReset = useRef(true);
  const scrollRestored = useRef(false);
  const showToast = useUIStore((s) => s.showToast);

  const today = todayISO();
  const activeCodes = (codes ?? []).filter((c) => c.exp >= today);
  const deactivatedCodes = (codes ?? []).filter((c) => c.exp < today);
  const filteredCodes = filter === "active" ? activeCodes : deactivatedCodes;
  const q = query.trim().toLowerCase();
  const searched = !q
    ? filteredCodes
    : filteredCodes.filter((c) => c.name.toLowerCase().includes(q));
  const sorted = sortByNewest(searched);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  // Clamp the page if data shrinks. Done during render so we don't need an
  // effect — and the initial render (codes=null) doesn't stomp hydrated page.
  if (codes !== null && page > totalPages) setPage(totalPages);
  const pageStart = (page - 1) * PAGE_SIZE;
  const visibleCodes = sorted.slice(pageStart, pageStart + PAGE_SIZE);

  // Reset to page 1 when the underlying view changes — but skip the first run
  // so the page restored from sessionStorage survives mount.
  useEffect(() => {
    if (skipFirstReset.current) {
      skipFirstReset.current = false;
      return;
    }
    setPage(1);
  }, [filter, query]);

  // Persist current view for round-trips to user pages.
  useEffect(() => {
    writePersistedState({ page, filter, query });
  }, [page, filter, query]);

  // Restore window scroll once codes are present in the DOM.
  useLayoutEffect(() => {
    if (scrollRestored.current || codes === null) return;
    if (typeof window === "undefined") return;
    const raw = sessionStorage.getItem(SCROLL_KEY);
    if (raw) {
      const y = Number(raw);
      if (Number.isFinite(y)) window.scrollTo({ top: y });
      sessionStorage.removeItem(SCROLL_KEY);
    }
    scrollRestored.current = true;
  }, [codes]);

  const refresh = useCallback(async () => {
    setCodes(await listUserActivity());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows = await listUserActivity();
      if (!cancelled) setCodes(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const onDelete = async () => {
    if (!pendingDeleteCode) return;
    await apiDelete(pendingDeleteCode);
    setPendingDeleteCode(null);
    showToast("Kod obrisan");
    refresh();
  };

  return (
    <>
      <div className="kf-card bg-white rounded-2xl border border-border p-5">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div
            className="text-sm font-extrabold"
            style={{ color: "var(--color-navy)" }}
          >
            Korisnici
          </div>
        </div>

        <div className="flex gap-1.5 mb-3 overflow-x-auto">
          <FilterTab
            label={`Aktivni (${activeCodes.length})`}
            active={filter === "active"}
            onClick={() => setFilter("active")}
          />
          <FilterTab
            label={`Istekli kodovi (${deactivatedCodes.length})`}
            active={filter === "deactivated"}
            onClick={() => setFilter("deactivated")}
          />
        </div>

        <div className="mb-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pretraži korisnike po imenu"
            className="w-full py-2.5 px-3 rounded-xl text-sm font-semibold outline-none border-[1.5px] border-border focus:border-orange text-navy"
          />
        </div>

        {codes === null && (
          <InlineLoading text="Pričekajte..." className="py-8" />
        )}
        {codes?.length === 0 && <EmptyText>Nema kodova.</EmptyText>}
        {codes !== null && filteredCodes.length === 0 && (
          <EmptyText>
            {filter === "active"
              ? "Nema aktivnih korisnika."
              : "Nema korisnika s isteklim kodovima."}
          </EmptyText>
        )}
        {codes !== null && filteredCodes.length > 0 && sorted.length === 0 && (
          <EmptyText>Nema rezultata za &quot;{query}&quot;.</EmptyText>
        )}

        {visibleCodes.map((c) => (
          <CodeRow
            key={c.code}
            row={c}
            query={query}
            onDelete={setPendingDeleteCode}
          />
        ))}

        {sorted.length > PAGE_SIZE && (
          <Pagination
            page={page}
            totalPages={totalPages}
            total={sorted.length}
            pageSize={PAGE_SIZE}
            onChange={setPage}
          />
        )}
      </div>

      <ConfirmPopup
        open={pendingDeleteCode !== null}
        question={
          pendingDeleteCode
            ? `Jeste li sigurni da želite obrisati kod ${pendingDeleteCode}?`
            : ""
        }
        onClose={() => setPendingDeleteCode(null)}
        button1={{
          text: "Ne",
          variant: "cancel",
          onClick: () => setPendingDeleteCode(null),
        }}
        button2={{
          text: "Da",
          variant: "orange",
          onClick: onDelete,
        }}
      />
    </>
  );
}

function FilterTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap border-[1.5px] ${
        active ? "border-navy bg-navy text-white" : "border-border bg-white"
      }`}
      style={{ color: active ? "#fff" : "var(--color-muted)" }}
    >
      {label}
    </button>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[13px] py-2" style={{ color: "var(--color-muted)" }}>
      {children}
    </div>
  );
}
