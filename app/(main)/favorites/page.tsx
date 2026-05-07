"use client";
import { useState } from "react";
import { FavTabs } from "@/components/favorites/FavTabs";
import { FavCard } from "@/components/favorites/FavCard";
import { AddFavModal } from "@/components/modals/AddFavModal";
import { EditFavModal } from "@/components/modals/EditFavModal";
import { ConfirmPopup } from "@/components/ui/ConfirmPopup";
import { useAuthStore } from "@/store/useAuthStore";
import { useFavorites } from "@/hooks/useFavorites";
import { useUIStore } from "@/store/useUIStore";
import type { MealFilter } from "@/types/app";

export default function FavoritesPage() {
  const user = useAuthStore((s) => s.user);
  const { favs, refresh, remove } = useFavorites(user?.id);
  const openModal = useUIStore((s) => s.openModal);
  const showToast = useUIStore((s) => s.showToast);
  const [filter, setFilter] = useState<MealFilter>("sve");
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const list = filter === "sve" ? favs : favs.filter((f) => f.meal === filter);
  const pendingFavorite = favs.find((f) => f.id === pendingDeleteId) ?? null;

  const onDelete = async () => {
    if (pendingDeleteId === null) return;
    await remove(pendingDeleteId);
    setPendingDeleteId(null);
    showToast("Obrisano");
  };

  return (
    <>
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <div
          className="text-base font-extrabold"
          style={{ color: "var(--color-navy)" }}
        >
          Omiljeni obroci
        </div>
      </div>
      <FavTabs value={filter} onChange={setFilter} />
      <div className="px-3">
        {list.length === 0 ? (
          <div
            className="text-center py-12 px-4 text-sm"
            style={{ color: "var(--color-muted)" }}
          >
            Nema spremljenih obroka.
            <br />
            <br />
            Unesi obrok u dnevnik pa ga spremi kao omiljeni.
          </div>
        ) : (
          list.map((f) => (
            <FavCard
              key={f.id}
              fav={f}
              onEdit={() => openModal("editFav", { fav: f })}
              onAdd={() => openModal("addFav", { fav: f })}
              onDelete={() => setPendingDeleteId(f.id)}
            />
          ))
        )}
      </div>
      <AddFavModal onAdded={refresh} />
      <EditFavModal onSaved={refresh} />
      <ConfirmPopup
        open={pendingDeleteId !== null}
        question={
          pendingFavorite
            ? `Jeste li sigurni da želite obrisati omiljeni obrok \"${pendingFavorite.name}\"?`
            : "Jeste li sigurni da želite obrisati omiljeni obrok?"
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
