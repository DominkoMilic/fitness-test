"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AdminUserFrame } from "@/components/admin/AdminUserFrame";
import { CalorieRing } from "@/components/dashboard/CalorieRing";
import { DayNav } from "@/components/dashboard/DayNav";
import { MacroPills } from "@/components/dashboard/MacroPills";
import { MealsList } from "@/components/dashboard/MealsList";
import { isAdminAuthenticated } from "@/lib/utils/adminAuth";
import { getCodeByValue } from "@/lib/api/codes";
import { useAdminUserFoodLogs } from "@/hooks/useAdminUserData";
import { dateForOffset } from "@/lib/utils/date";
import { sumLogs } from "@/lib/utils/macros";
import type { AccessCodeRow } from "@/types/database";

export default function AdminUserDashboardPage() {
  const router = useRouter();
  const params = useParams<{ code: string }>();
  const code = decodeURIComponent(String(params.code || ""));
  const [user, setUser] = useState<AccessCodeRow | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const authed = await isAdminAuthenticated();
      if (!alive) return;
      if (!authed) {
        router.replace("/admin/login");
        return;
      }
      const row = await getCodeByValue(code);
      if (!alive) return;
      setUser(row);
      setLoadingUser(false);
    })();
    return () => {
      alive = false;
    };
  }, [code, router]);

  const date = useMemo(() => dateForOffset(offset), [offset]);
  const { logs } = useAdminUserFoodLogs(code, date);
  const totals = sumLogs(logs);
  const goal = user?.goal ?? 1500;

  return (
    <AdminUserFrame
      code={code}
      user={user}
      loading={loadingUser}
      activeTab="dashboard"
    >
      <div
        className="rounded-[28px] px-5 pb-6 flex flex-col items-center overflow-hidden"
        style={{
          background: "linear-gradient(160deg,#1b3255 0%,#0f1f38 100%)",
        }}
      >
        <div className="h-5" />
        <DayNav
          offset={offset}
          onChangeDay={(dir) => setOffset((prev) => prev + dir)}
        />
        <CalorieRing eaten={totals.kcal} goal={goal} />
        <MacroPills totals={totals} />
        <div className="h-5" />
      </div>
      <MealsList logs={logs} readOnly />
      <div className="h-5" />
    </AdminUserFrame>
  );
}
