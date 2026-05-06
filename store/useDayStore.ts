"use client";
import { create } from "zustand";

type DayState = {
  offset: number;
  setOffset: (n: number) => void;
  changeDay: (dir: number) => void;
  reset: () => void;
};

export const useDayStore = create<DayState>((set) => ({
  offset: 0,
  setOffset: (n) => set({ offset: n }),
  changeDay: (dir) => set((s) => ({ offset: s.offset + dir })),
  reset: () => set({ offset: 0 }),
}));
