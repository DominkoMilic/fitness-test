"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createFoodSearchIndex,
  type FoodSearchIndex,
  type SearchOptions,
} from "@/lib/search/foodSearch";
import type { FoodEntry } from "@/types/app";

type Options = SearchOptions & {
  // Debounce ms. 0 = synchronous on every keystroke.
  debounceMs?: number;
};

// Reusable hook: builds + memoizes a Fuse index for the given foods array,
// debounces the query, returns ranked results.
//
// The Fuse index rebuilds ONLY when the `foods` array reference changes
// (i.e. after a sync/import refresh) — typing in the search box does not
// rebuild it. This is the main reason useFoods uses a stable reference.
export function useFoodSearch(foods: FoodEntry[], query: string, opts?: Options) {
  const { debounceMs = 120, limit = 25, minLength = 2 } = opts ?? {};

  const index = useMemo<FoodSearchIndex>(
    () => createFoodSearchIndex(foods),
    [foods],
  );

  const [debounced, setDebounced] = useState(query);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceMs <= 0) {
      setDebounced(query);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setDebounced(query), debounceMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, debounceMs]);

  const results = useMemo(
    () => index.search(debounced, { limit, minLength }),
    [index, debounced, limit, minLength],
  );

  return { results, indexSize: index.size, debouncedQuery: debounced };
}
