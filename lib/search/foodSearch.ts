// Fuzzy food search powered by Fuse.js.
//
// Public API:
//   createFoodSearchIndex(foods) → FoodSearchIndex
//   index.search(query, opts?)   → ranked FoodEntry[]
//
// Design:
//   • Index is built ONCE per `foods` array reference (see useFoodSearch
//     for memoization). Building a Fuse index on 10k items is ~30 ms; we
//     want to amortize that across keystrokes.
//   • Query is normalized + tokenized. Each token runs through Fuse with
//     fuzzy matching, results are intersected by item id (AND semantics),
//     and per-token scores are summed → final ranking. This makes word
//     order irrelevant ("pileci file" ≡ "file pileci") while keeping per-
//     token typo tolerance.
//   • Single-token queries skip the intersection and use Fuse directly —
//     fast path for the common case.

import Fuse, { type IFuseOptions } from "fuse.js";
import { normalizeForSearch, tokenize } from "@/lib/utils/normalize";
import type { FoodEntry } from "@/types/app";

export type SearchOptions = {
  // Hard cap on returned results. Default 25 — matches UI page size and
  // keeps rendering snappy.
  limit?: number;
  // Minimum normalized query length to even attempt a search. Below this
  // we return [] (caller usually shows history/empty state).
  minLength?: number;
};

export type FoodSearchIndex = {
  search: (query: string, opts?: SearchOptions) => FoodEntry[];
  size: number;
};

type Indexed = FoodEntry & { _searchKey: string };

const FUSE_OPTIONS: IFuseOptions<Indexed> = {
  // Lower = stricter match. 0.0 = exact; 1.0 = match anything.
  // 0.35 tolerates 1–2 char typos in mid-length Croatian food names
  // ("cevapcic" → "ćevapčići") without flooding with garbage.
  threshold: 0.35,

  // We've already normalized + tokenized, so position within the string is
  // irrelevant — "file pileći" should rank as well as "pileći file".
  ignoreLocation: true,

  // Require ≥2 char tokens to participate. Single letters explode the
  // candidate set with near-zero signal.
  minMatchCharLength: 2,

  // Need scores for cross-token rank aggregation.
  includeScore: true,

  // We feed Fuse pre-normalized text via _searchKey, so the field name
  // is the only key. Weighted at 1.0 (irrelevant — only one key).
  keys: [{ name: "_searchKey", weight: 1 }],

  // Default; explicit for clarity.
  isCaseSensitive: false,
  shouldSort: true,
};

function toIndexed(food: FoodEntry): Indexed {
  // Use the cached normalized name when present (DB-sourced), fall back
  // to computing on the fly for DEFAULT_FOODS / scanner-added entries.
  const key = food.normalizedName ?? normalizeForSearch(food.name);
  return { ...food, _searchKey: key };
}

export function createFoodSearchIndex(foods: FoodEntry[]): FoodSearchIndex {
  const indexed = foods.map(toIndexed);
  const fuse = new Fuse(indexed, FUSE_OPTIONS);

  return {
    size: indexed.length,
    search(rawQuery, opts) {
      const limit = opts?.limit ?? 25;
      const minLength = opts?.minLength ?? 2;
      const normalized = normalizeForSearch(rawQuery);
      if (normalized.length < minLength) return [];

      const tokens = tokenize(normalized);
      if (tokens.length === 0) return [];

      // Fast path: single token → direct Fuse search.
      if (tokens.length === 1) {
        return fuse
          .search(tokens[0], { limit })
          .map((r) => stripIndexed(r.item));
      }

      // Multi-token AND: intersect per-token result sets, aggregate scores.
      // Search wider per token (limit * 4) so the intersection isn't
      // starved when one token has many candidates.
      const perTokenLimit = Math.max(limit * 4, 50);
      type Acc = { item: Indexed; score: number; hits: number };
      const acc = new Map<FoodEntry["id"], Acc>();

      tokens.forEach((token, tokenIdx) => {
        const hits = fuse.search(token, { limit: perTokenLimit });
        const seenThisToken = new Set<FoodEntry["id"]>();

        for (const hit of hits) {
          const id = hit.item.id;
          seenThisToken.add(id);
          // Fuse score: 0 = perfect, 1 = worst. Invert so we sum "goodness".
          const goodness = 1 - (hit.score ?? 1);
          const prev = acc.get(id);
          if (prev) {
            prev.score += goodness;
            prev.hits++;
          } else if (tokenIdx === 0) {
            acc.set(id, { item: hit.item, score: goodness, hits: 1 });
          }
          // For tokens after the first we ONLY update existing entries —
          // a new id appearing here can't satisfy earlier tokens, so it
          // can't be in the AND result. This is the intersection step.
        }

        // Drop accumulator entries the current token did not hit — they
        // failed the AND.
        if (tokenIdx > 0) {
          for (const id of acc.keys()) {
            if (!seenThisToken.has(id)) acc.delete(id);
          }
        }
      });

      return Array.from(acc.values())
        .filter((e) => e.hits === tokens.length)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((e) => stripIndexed(e.item));
    },
  };
}

function stripIndexed(item: Indexed): FoodEntry {
  // Avoid leaking the internal _searchKey to UI / logs.
  const rest = { ...item } as Partial<Indexed>;
  delete rest._searchKey;
  return rest as FoodEntry;
}
