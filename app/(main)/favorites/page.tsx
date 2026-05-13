"use client";
import { useState } from "react";
import { FavTabs } from "@/components/favorites/FavTabs";
import { FavCard } from "@/components/favorites/FavCard";
import { AddFavModal } from "@/components/modals/AddFavModal";
import { EditFavModal } from "@/components/modals/EditFavModal";
import { NewFavModal } from "@/components/modals/NewFavModal";
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
      <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-2">
        <div
          className="text-base font-extrabold"
          style={{ color: "var(--color-navy)" }}
        >
          Omiljeni obroci
        </div>
        <button
          onClick={() => openModal("newFav")}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold bg-linear-to-br from-orange to-orange-dark text-white shrink-0"
        >
          <svg
            width={12}
            height={12}
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            viewBox="0 0 24 24"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Dodaj novo omiljeno jelo
        </button>
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
            Dodaj novi obrok klikom na gumb &quot;Dodaj novo omiljeno jelo&quot;
            iznad, ili spremi postojeći obrok kao omiljeni iz dnevnika hrane.
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
      <NewFavModal onCreated={refresh} />
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
