"use client";
import { useState } from "react";
import { RecipeTabs } from "@/components/recipes/RecipeTabs";
import { RecipeCard } from "@/components/recipes/RecipeCard";
import { AddRecipeModal } from "@/components/modals/AddRecipeModal";
import { EditRecipeModal } from "@/components/modals/EditRecipeModal";
import { NewRecipeModal } from "@/components/modals/NewRecipeModal";
import { ConfirmPopup } from "@/components/ui/ConfirmPopup";
import { useAuthStore } from "@/store/useAuthStore";
import { useRecipes } from "@/hooks/useRecipes";
import { useUIStore } from "@/store/useUIStore";
import { InlineLoading } from "@/components/ui/Loading";
import type { MealFilter } from "@/types/app";

export default function ReceptiPage() {
  const user = useAuthStore((s) => s.user);
  const { recipes, loading, refresh, remove } = useRecipes(user?.id);
  const openModal = useUIStore((s) => s.openModal);
  const showToast = useUIStore((s) => s.showToast);
  const [filter, setFilter] = useState<MealFilter>("sve");
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const list =
    filter === "sve" ? recipes : recipes.filter((r) => r.meal === filter);
  const pendingRecipe = recipes.find((r) => r.id === pendingDeleteId) ?? null;

  const onDelete = async () => {
    if (pendingDeleteId === null) return;
    await remove(pendingDeleteId);
    setPendingDeleteId(null);
    showToast("Recept obrisan");
  };

  return (
    <>
      <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-2">
        <div
          className="text-base font-extrabold"
          style={{ color: "var(--color-navy)" }}
        >
          Recepti
        </div>
        <button
          onClick={() => openModal("newRecipe")}
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
          Dodaj novi recept
        </button>
      </div>
      <RecipeTabs value={filter} onChange={setFilter} />
      <div className="px-3">
        {loading ? (
          <InlineLoading text="Pričekajte..." />
        ) : list.length === 0 ? (
          <div
            className="text-center py-12 px-4 text-sm"
            style={{ color: "var(--color-muted)" }}
          >
            Nema spremljenih recepata.
            <br />
            <br />
            Dodaj novi recept klikom na gumb &quot;Dodaj novi recept&quot; iznad.
            Recepti dijele ukupne nutrijente na broj osoba koje jedu obrok.
          </div>
        ) : (
          list.map((r) => (
            <RecipeCard
              key={r.id}
              recipe={r}
              onEdit={() => openModal("editRecipe", { recipe: r })}
              onAdd={() => openModal("addRecipe", { recipe: r })}
              onDelete={() => setPendingDeleteId(r.id)}
            />
          ))
        )}
      </div>
      <AddRecipeModal onAdded={refresh} />
      <EditRecipeModal onSaved={refresh} />
      <NewRecipeModal onCreated={refresh} />
      <ConfirmPopup
        open={pendingDeleteId !== null}
        question={
          pendingRecipe
            ? `Jeste li sigurni da želite obrisati recept \"${pendingRecipe.name}\"?`
            : "Jeste li sigurni da želite obrisati recept?"
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
