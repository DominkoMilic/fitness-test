"use client";
import { useState } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useDayStore } from "@/store/useDayStore";
import { dateForOffset } from "@/lib/utils/date";
import { useFoodLogs } from "@/hooks/useFoodLogs";
import { sumLogs } from "@/lib/utils/macros";
import { CalorieRing } from "@/components/dashboard/CalorieRing";
import { DayNav } from "@/components/dashboard/DayNav";
import { MacroPills } from "@/components/dashboard/MacroPills";
import { MealsList } from "@/components/dashboard/MealsList";
import { useUIStore } from "@/store/useUIStore";
import { EditFoodModal } from "@/components/modals/EditFoodModal";
import { SaveFavModal } from "@/components/modals/SaveFavModal";
import { ConfirmPopup } from "@/components/ui/ConfirmPopup";

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const offset = useDayStore((s) => s.offset);
  const date = dateForOffset(offset);
  const openModal = useUIStore((s) => s.openModal);
  const showToast = useUIStore((s) => s.showToast);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const { logs, refresh, remove } = useFoodLogs(user?.id, date);
  const totals = sumLogs(logs);
  const goal = user?.goal ?? 1500;
  const pendingLog = logs.find((log) => log.id === pendingDeleteId) ?? null;

  const onEdit = (id: string) => {
    const log = logs.find((l) => l.id === id);
    if (!log) {
      showToast("Stavka nije pronađena");
      return;
    }
    openModal("editFood", { log });
  };

  const onDelete = async () => {
    if (!pendingDeleteId) return;
    await remove(pendingDeleteId);
    setPendingDeleteId(null);
    showToast("Namirnica obrisana");
  };

  return (
    <>
      <div
        className="px-5 pb-6 flex flex-col items-center"
        style={{
          background: "linear-gradient(160deg,#1b3255 0%,#0f1f38 100%)",
        }}
      >
        <div className="h-5" />
        <DayNav />
        <CalorieRing eaten={totals.kcal} goal={goal} />
        <MacroPills totals={totals} />
        <div className="h-5" />
      </div>
      <MealsList
        logs={logs}
        onEdit={onEdit}
        onDelete={(id) => setPendingDeleteId(id)}
      />
      <div className="h-5" />
      <EditFoodModal onSaved={refresh} />
      <SaveFavModal onSaved={refresh} />
      <ConfirmPopup
        open={pendingDeleteId !== null}
        question={
          pendingLog
            ? `Jeste li sigurni da želite obrisati namirnicu \"${pendingLog.food_name}\" iz obroka?`
            : "Jeste li sigurni da želite obrisati ovu namirnicu?"
        }
        onClose={() => setPendingDeleteId(null)}
        button1={{
          text: "Ne",
          variant: "cancel",
          onClick: () => setPendingDeleteId(null),
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
