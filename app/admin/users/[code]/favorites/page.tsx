"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AdminUserFrame } from "@/components/admin/AdminUserFrame";
import { FavCard } from "@/components/favorites/FavCard";
import { FavTabs } from "@/components/favorites/FavTabs";
import { InlineLoading } from "@/components/ui/Loading";
import { isAdminAuthenticated } from "@/lib/utils/adminAuth";
import { getCodeByValue } from "@/lib/api/codes";
import { useAdminUserFavorites } from "@/hooks/useAdminUserData";
import type { MealFilter } from "@/types/app";
import type { AccessCodeRow } from "@/types/database";

export default function AdminUserFavoritesPage() {
  const router = useRouter();
  const params = useParams<{ code: string }>();
  const code = decodeURIComponent(String(params.code || ""));
  const [user, setUser] = useState<AccessCodeRow | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [filter, setFilter] = useState<MealFilter>("sve");

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

  const { favs, loading: loadingFavs } = useAdminUserFavorites(code);
  const list = filter === "sve" ? favs : favs.filter((f) => f.meal === filter);

  return (
    <AdminUserFrame
      code={code}
      user={user}
      loading={loadingUser}
      activeTab="favorites"
    >
      <div className="rounded-[28px] overflow-hidden border border-border bg-white shadow-sm">
        <div className="px-5 pt-4 pb-2">
          <div
            className="text-base font-extrabold"
            style={{ color: "var(--color-navy)" }}
          >
            Omiljeni obroci korisnika
          </div>
        </div>
        <FavTabs value={filter} onChange={setFilter} />
        <div className="px-3 pb-3">
          {loadingFavs ? (
            <InlineLoading text="Pričekajte..." className="py-10" />
          ) : list.length === 0 ? (
            <div
              className="text-center py-12 px-4 text-sm"
              style={{ color: "var(--color-muted)" }}
            >
              Korisnik nema spremljenih omiljenih obroka.
            </div>
          ) : (
            list.map((fav) => <FavCard key={fav.id} fav={fav} />)
          )}
        </div>
      </div>
    </AdminUserFrame>
  );
}
