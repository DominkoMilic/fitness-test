"use client";
import { Modal } from "@/components/ui/Modal";
import { useUIStore } from "@/store/useUIStore";
import {
  applySheetSyncPlan,
  type SheetSyncDiagnostics,
} from "@/lib/api/sheetSync";
import { clearFoodsCache } from "@/lib/api/foods";
import type { SheetSyncPlan } from "@/types/sheetSync";

type Payload = { plan: SheetSyncPlan; diagnostics?: SheetSyncDiagnostics };

export function SyncPreviewModal({ onDone }: { onDone?: () => void }) {
  const modal = useUIStore((s) => s.modal);
  const payload = useUIStore((s) => s.modalPayload as Payload | null);
  const closeModal = useUIStore((s) => s.closeModal);
  const showToast = useUIStore((s) => s.showToast);
  const setLoading = useUIStore((s) => s.setLoading);

  if (modal !== "syncPreview" || !payload?.plan) return null;

  const { toInsert, toUpdate, toDelete, unchangedCount, duplicates } =
    payload.plan;
  const hasChanges = toInsert.length + toUpdate.length + toDelete.length > 0;
  const dupCount = duplicates?.length ?? 0;

  const onConfirm = async () => {
    setLoading(true);
    try {
      const result = await applySheetSyncPlan(payload.plan);
      clearFoodsCache();
      try {
        localStorage.setItem("kf_last_sync", new Date().toISOString());
      } catch {}
      closeModal();

      const failed =
        result.insertFail + result.updateFail + result.deleteFail;
      const summary =
        `Sink — dodano ${result.inserted}, ` +
        `ažurirano ${result.updated}, ` +
        `obrisano ${result.deleted}` +
        (result.renamedLogCount
          ? `, preimenovano ${result.renamedLogCount} logova`
          : "") +
        (result.removedLogCount
          ? `, maknuto ${result.removedLogCount} logova`
          : "") +
        (failed ? `, neuspješno ${failed}` : "");

      showToast(summary);

      if (result.failedNames.length) {
        showToast(`Nije obrađeno: ${result.failedNames.join(", ")}`);
      }
      onDone?.();
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Sync nije uspio. Pokušaj ponovno.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={closeModal} className="max-h-[85vh] flex flex-col">
      <div
        className="text-base font-extrabold mb-1"
        style={{ color: "var(--color-navy)" }}
      >
        Promjene sa Sheeta
      </div>
      <div className="text-[13px] mb-4" style={{ color: "var(--color-muted)" }}>
        {!hasChanges
          ? `Nema promjena za sinkronizaciju. Bez promjene: ${unchangedCount}.`
          : `Dodaj: ${toInsert.length} · Ažuriraj: ${toUpdate.length} · Obriši: ${toDelete.length} · Bez promjene: ${unchangedCount}`}
      </div>

      {payload.diagnostics && (
        <div
          className="mb-4 text-[11px] font-semibold rounded-lg px-3 py-2 bg-bg"
          style={{ color: "var(--color-muted)" }}
        >
          Sheet redaka: {payload.diagnostics.sheetRowsParsed} · DB redaka
          (imported): {payload.diagnostics.dbRowsImported}
        </div>
      )}

      {dupCount > 0 && (
        <div
          className="mb-4 rounded-xl border px-3.5 py-3"
          style={{
            borderColor: "var(--color-orange-dark, #c86a1a)",
            background: "rgba(200,106,26,0.08)",
            color: "var(--color-navy)",
          }}
        >
          <div className="text-[12px] font-extrabold mb-1.5">
            ⚠️ Duplikati u Sheetu ({dupCount})
          </div>
          <div
            className="text-[12px] mb-2 leading-snug"
            style={{ color: "var(--color-muted)" }}
          >
            Sinkronizacija koristi prvi pronađeni redak. Očisti duplikate u
            Sheetu kako bi sigurno znao koji je &quot;pravi&quot;.
          </div>
          <ul className="text-[12px] leading-snug list-disc pl-4 space-y-0.5">
            {duplicates.map((d, i) => (
              <li key={`dup_${i}`}>
                <span className="font-semibold">{d.name}</span>
                {d.sheetRowId ? ` (id: ${d.sheetRowId})` : ""}
                {" — "}
                {d.reason === "name" ? "isti naziv" : "isti sheet_row_id"}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="overflow-y-auto flex-1 mb-4 max-h-[50vh]">
        {toInsert.length > 0 && (
          <Section title="Za dodavanje">
            {toInsert.map((f, idx) => {
              const piece =
                f.piece_name && f.piece_weight_g
                  ? ` · 1 ${f.piece_name} = ${f.piece_weight_g}g`
                  : "";
              return (
                <Row
                  key={`add_${idx}`}
                  primary={f.name}
                  secondary={`${f.kcal_per_100g} kcal · P:${f.protein}g · U:${f.carbs}g · M:${f.fat}g${piece}`}
                />
              );
            })}
          </Section>
        )}

        {toUpdate.length > 0 && (
          <Section title="Za ažuriranje">
            {toUpdate.map((u) => {
              const fields = Object.keys(u.patch);
              const label = u.nameChanged
                ? `${u.oldName} → ${u.newName}`
                : u.newName;
              return (
                <Row
                  key={`upd_${u.id}`}
                  primary={label}
                  secondary={`Polja: ${fields.join(", ")}`}
                  accent="info"
                />
              );
            })}
          </Section>
        )}

        {toDelete.length > 0 && (
          <Section title="Za brisanje iz appa i dnevnika">
            {toDelete.map((d) => (
              <Row
                key={`del_${d.id}`}
                primary={d.name}
                secondary="Briše se"
                accent="warn"
              />
            ))}
          </Section>
        )}
      </div>

      <div className="flex gap-2.5">
        <button
          onClick={closeModal}
          className="flex-1 py-3.5 rounded-xl border-[1.5px] border-border bg-bg text-[15px] font-semibold"
          style={{ color: "var(--color-muted)" }}
        >
          Odustani
        </button>
        {hasChanges && (
          <button
            onClick={onConfirm}
            className="flex-2 py-3.5 rounded-xl bg-linear-to-br from-navy to-[#162844] text-white text-[15px] font-bold"
          >
            Sinkroniziraj sve
          </button>
        )}
      </div>
    </Modal>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <div
        className="px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider border-b border-border"
        style={{ color: "var(--color-muted)" }}
      >
        {title}
      </div>
      {children}
    </>
  );
}

function Row({
  primary,
  secondary,
  accent,
}: {
  primary: string;
  secondary: string;
  accent?: "info" | "warn";
}) {
  const accentColor =
    accent === "warn"
      ? "var(--color-orange-dark, #c86a1a)"
      : accent === "info"
        ? "var(--color-navy)"
        : "var(--color-muted)";
  return (
    <div className="flex items-center justify-between py-1.5 px-3.5 border-b border-border last:border-b-0 gap-3">
      <div className="text-xs font-semibold truncate">{primary}</div>
      <div
        className="text-[11px] font-semibold shrink-0"
        style={{ color: accentColor }}
      >
        {secondary}
      </div>
    </div>
  );
}
