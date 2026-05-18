"use client";
import Link from "next/link";
import { useRecipes } from "@/hooks/useRecipes";
import { useAuthStore } from "@/store/useAuthStore";
import { useUIStore } from "@/store/useUIStore";
import { MEAL_NAMES } from "@/lib/constants/meals";

export function RecipesWidget() {
  const user = useAuthStore((s) => s.user);
  const { recipes, loading } = useRecipes(user?.id);
  const openModal = useUIStore((s) => s.openModal);

  if (!user) return null;

  const top = recipes.slice(0, 3);

  return (
    <div className="kf-card mx-3 mb-3 bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-border">
        <span
          className="text-sm font-bold"
          style={{ color: "var(--color-navy)" }}
        >
          Recepti
        </span>
        <Link
          href="/recepti"
          className="text-xs font-semibold"
          style={{ color: "var(--color-orange)" }}
        >
          Sve →
        </Link>
      </div>

      {loading ? (
        <div
          className="px-3.5 py-3 text-[12px]"
          style={{ color: "var(--color-muted)" }}
        >
          Učitavam recepte...
        </div>
      ) : top.length === 0 ? (
        <div className="px-3.5 py-3">
          <div
            className="text-[12px] mb-2"
            style={{ color: "var(--color-muted)" }}
          >
            Nema recepata. Dodaj prvi recept i podijeli ga na više osoba.
          </div>
          <button
            onClick={() => openModal("newRecipe")}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold bg-linear-to-br from-orange to-orange-dark text-white"
          >
            + Novi recept
          </button>
        </div>
      ) : (
        top.map((r) => {
          const people = Math.max(1, Number(r.people) || 1);
          const totalKcal = Number(r.total_kcal) || 0;
          const perKcal = totalKcal / people;
          return (
            <div
              key={r.id}
              className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-border last:border-b-0"
            >
              <div className="min-w-0">
                <div
                  className="text-xs font-bold truncate"
                  style={{ color: "var(--color-navy)" }}
                >
                  {r.name}
                </div>
                <div
                  className="text-[10.5px] mt-0.5"
                  style={{ color: "var(--color-muted)" }}
                >
                  {MEAL_NAMES[r.meal]} · {people} os. · po osobi{" "}
                  <span style={{ color: "var(--color-orange)", fontWeight: 700 }}>
                    {Math.round(perKcal)} kcal
                  </span>
                </div>
              </div>
              <button
                onClick={() => openModal("addRecipe", { recipe: r })}
                className="shrink-0 bg-orange text-white rounded-lg px-3 py-1.5 text-[11px] font-bold"
              >
                + Dodaj
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}
