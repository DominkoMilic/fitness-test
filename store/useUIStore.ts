"use client";
import { create } from "zustand";

export type ModalKind =
  | null
  | "addFood"
  | "editFood"
  | "goal"
  | "saveFav"
  | "addFav"
  | "syncPreview";

type UIState = {
  loading: boolean;
  toast: string | null;
  modal: ModalKind;
  modalPayload: unknown;
  setLoading: (v: boolean) => void;
  showToast: (text: string) => void;
  openModal: (kind: Exclude<ModalKind, null>, payload?: unknown) => void;
  closeModal: () => void;
};

export const useUIStore = create<UIState>((set) => ({
  loading: false,
  toast: null,
  modal: null,
  modalPayload: null,
  setLoading: (v) => set({ loading: v }),
  showToast: (text) => {
    set({ toast: text });
    setTimeout(() => set((s) => (s.toast === text ? { toast: null } : s)), 2200);
  },
  openModal: (kind, payload) => set({ modal: kind, modalPayload: payload ?? null }),
  closeModal: () => set({ modal: null, modalPayload: null }),
}));
