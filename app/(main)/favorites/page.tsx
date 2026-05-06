"use client";
import { useState } from "react";
import { FavTabs } from "@/components/favorites/FavTabs";
import { FavCard } from "@/components/favorites/FavCard";
import { AddFavModal } from "@/components/modals/AddFavModal";
import { useAuthStore } from "@/store/useAuthStore";
import { useFavorites } from "@/hooks/useFavorites";
import { useUIStore } from "@/store/useUIStore";
import type { MealFilter } from "@/types/app";

export default function FavoritesPage() {
  const user = useAuthStore((s) => s.user);
  const { favs, refresh, remove } = useFavorites(user?.code);
  const openModal = useUIStore((s) => s.openModal);
  const showToast = useUIStore((s) => s.showToast);
  const [filter, setFilter] = useState<MealFilter>("sve");

  const list = filter === "sve" ? favs : favs.filter((f) => f.meal === filter);

  const onDelete = async (id: number) => {
    if (!confirm("Obriši omiljeni obrok?")) return;
    await remove(id);
    showToast("Obrisano");
  };

  return (
    <>
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <div className="text-base font-extrabold" style={{ color: "var(--color-navy)" }}>Omiljeni obroci</div>
      </div>
      <FavTabs value={filter} onChange={setFilter} />
      <div className="px-3">
        {list.length === 0 ? (
          <div className="text-center py-12 px-4 text-sm" style={{ color: "var(--color-muted)" }}>
            Nema spremljenih obroka.<br /><br />
            Unesi obrok u dnevnik pa ga spremi kao omiljeni.
          </div>
        ) : (
          list.map((f) => (
            <FavCard
              key={f.id}
              fav={f}
              onAdd={() => openModal("addFav", { fav: f })}
              onDelete={() => onDelete(f.id)}
            />
          ))
        )}
      </div>
      <AddFavModal onAdded={refresh} />
    </>
  );
}
