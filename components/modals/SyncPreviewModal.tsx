"use client";
import { Modal } from "@/components/ui/Modal";
import { useUIStore } from "@/store/useUIStore";
import {
  clearFoodsCache,
  deleteMissingImportedFoods,
  type MissingImportedFood,
} from "@/lib/api/foods";
import type { FoodInsert } from "@/types/database";

type Payload = {
  foods: FoodInsert[];
  keepNames: string[];
  keepRowIds: string[];
  removeCount?: number;
  foodsToDelete?: MissingImportedFood[];
};

export function SyncPreviewModal({ onDone }: { onDone?: () => void }) {
  const modal = useUIStore((s) => s.modal);
  const payload = useUIStore((s) => s.modalPayload as Payload | null);
  const closeModal = useUIStore((s) => s.closeModal);
  const showToast = useUIStore((s) => s.showToast);
  const setLoading = useUIStore((s) => s.setLoading);

  if (modal !== "syncPreview" || !payload) return null;
  const foods = payload.foods;
  const keepNames = payload.keepNames ?? [];
  const keepRowIds = payload.keepRowIds ?? [];
  const foodsToDelete = payload.foodsToDelete ?? [];
  const removeCount = payload.removeCount ?? foodsToDelete.length;
  const hasChanges = foods.length > 0 || removeCount > 0;

  const onConfirm = async () => {
    setLoading(true);
    try {
      if (
        !Array.isArray(payload.keepNames) ||
        !Array.isArray(payload.keepRowIds)
      ) {
        showToast("Greška sinka: nedostaje snapshot Sheeta");
        return;
      }
      const {
        inserted,
        insertFail,
        deleted,
        deleteFail,
        deletedNames,
        failedNames,
        removedLogCount,
      } = await deleteMissingImportedFoods(foods, keepNames, keepRowIds);
      clearFoodsCache();
      try {
        localStorage.setItem("kf_last_sync", new Date().toISOString());
      } catch {}
      closeModal();
      if (
        inserted === 0 &&
        insertFail > 0 &&
        deleted === 0 &&
        deleteFail === 0
      ) {
        showToast("Sink nije uspio — provjeri podatke i jedinstvenost unosa");
      } else if (insertFail === 0 && deleteFail === 0) {
        showToast(
          `Sink: dodano ${inserted}, obrisano ${deleted}, maknuto ${removedLogCount} logova`,
        );
      } else {
        showToast(
          `Sink: dodano ${inserted}, obrisano ${deleted}, maknuto ${removedLogCount} logova, neuspješno ${insertFail + deleteFail}`,
        );
      }
      if (deletedNames.length) {
        showToast(`Obrisano iz appa: ${deletedNames.join(", ")}`);
      } else if (failedNames.length) {
        showToast(`Nije obrisano: ${failedNames.join(", ")}`);
      }
      onDone?.();
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Sync nije uspio. Provjeri admin postavke i pokušaj ponovno.",
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
          ? "Nema promjena za sinkronizaciju."
          : `Za dodavanje: ${foods.length} · Za brisanje: ${removeCount}`}
      </div>
      <div className="overflow-y-auto flex-1 mb-4 max-h-[50vh]">
        {foods.length > 0 && (
          <>
            <div
              className="px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider border-b border-border"
              style={{ color: "var(--color-muted)" }}
            >
              Za dodavanje
            </div>
            {foods.map((f, idx) => {
              const piece =
                f.piece_name && f.piece_weight_g
                  ? ` · 1 ${f.piece_name} = ${f.piece_weight_g}g`
                  : "";
              return (
                <div
                  key={`add_${idx}`}
                  className="flex items-center justify-between py-1.5 px-3.5 border-b border-border last:border-b-0"
                >
                  <div className="text-xs font-semibold">{f.name}</div>
                  <div
                    className="text-[11px]"
                    style={{ color: "var(--color-muted)" }}
                  >
                    {f.kcal_per_100g} kcal · P:{f.protein}g · U:{f.carbs}g · M:
                    {f.fat}g{piece}
                  </div>
                </div>
              );
            })}
          </>
        )}
        {foodsToDelete.length > 0 && (
          <>
            <div
              className="px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider border-b border-border"
              style={{ color: "var(--color-muted)" }}
            >
              Za brisanje iz appa i dnevnika
            </div>
            {foodsToDelete.map((food) => (
              <div
                key={`delete_${food.id}`}
                className="flex items-center justify-between py-2 px-3.5 border-b border-border last:border-b-0"
              >
                <div className="text-xs font-semibold">{food.name}</div>
                <div
                  className="text-[11px] font-semibold"
                  style={{ color: "var(--color-orange-dark, #c86a1a)" }}
                >
                  Briše se
                </div>
              </div>
            ))}
          </>
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
