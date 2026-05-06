"use client";
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
import { getLog } from "@/lib/api/foodLogs";

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const offset = useDayStore((s) => s.offset);
  const date = dateForOffset(offset);
  const openModal = useUIStore((s) => s.openModal);
  const setLoading = useUIStore((s) => s.setLoading);
  const showToast = useUIStore((s) => s.showToast);

  const { logs, refresh, remove } = useFoodLogs(user?.code, date);
  const totals = sumLogs(logs);
  const goal = user?.goal ?? 1500;

  const onEdit = async (id: string) => {
    setLoading(true);
    const log = await getLog(id);
    setLoading(false);
    if (!log) {
      showToast("Stavka nije pronađena");
      return;
    }
    openModal("editFood", { log });
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
      <MealsList logs={logs} onEdit={onEdit} onDelete={remove} />
      <div className="h-5" />
      <EditFoodModal onSaved={refresh} />
      <SaveFavModal onSaved={refresh} />
    </>
  );
}
