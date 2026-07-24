// Client wrapper around /api/me/ai/*. Same jsonFetch pattern as
// lib/api/foodLogs.ts / lib/api/recipes.ts. User identity is derived
// server-side from the httpOnly session cookie.

import type { AiAnalysisItem, AiAnalysisResult } from "@/types/app";
import type { AiMealAnalysisRow, FoodLogRow, MealKey } from "@/types/database";

async function jsonFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(body?.error || `Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export type AnalyzeInput = {
  imageBase64?: string;
  mime?: string;
  text?: string;
};

// Either an off-topic guard message, or a full analysis result.
export type AnalyzeResponse =
  | { offTopic: true; message: string }
  | { offTopic?: false; result: AiAnalysisResult };

export async function analyzeMeal(
  input: AnalyzeInput,
): Promise<AnalyzeResponse> {
  return jsonFetch<AnalyzeResponse>("/api/me/ai/analyze", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export type SaveAnalysisInput = {
  date: string;
  meal: MealKey | null;
  title: string;
  items: AiAnalysisItem[];
  kcalMin: number | null;
  kcalMax: number | null;
  confidence: AiAnalysisResult["confidence"];
  model?: string;
  addToDiary: boolean;
};

export async function saveAnalysis(
  input: SaveAnalysisInput,
): Promise<{ data: AiMealAnalysisRow; logs: FoodLogRow[] }> {
  return jsonFetch<{ data: AiMealAnalysisRow; logs: FoodLogRow[] }>(
    "/api/me/ai/analyses",
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function listAnalyses(): Promise<AiMealAnalysisRow[]> {
  const body = await jsonFetch<{ data: AiMealAnalysisRow[] }>(
    "/api/me/ai/analyses",
  );
  return body.data ?? [];
}
