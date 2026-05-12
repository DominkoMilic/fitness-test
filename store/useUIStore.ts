"use client";
import { create } from "zustand";

const MIN_LOADING_MS = 280;
let loadingStartedAt = 0;
let hideLoadingTimer: ReturnType<typeof setTimeout> | null = null;

export type ModalKind =
  | null
  | "addFood"
  | "editFood"
  | "goal"
  | "saveFav"
  | "addFav"
  | "editFav"
  | "newFav"
  | "syncPreview"
  | "manualKcal";

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
  setLoading: (v) => {
    if (v) {
      if (hideLoadingTimer) {
        clearTimeout(hideLoadingTimer);
        hideLoadingTimer = null;
      }
      loadingStartedAt = Date.now();
      set({ loading: true });
      return;
    }

    const elapsed = Date.now() - loadingStartedAt;
    const remaining = Math.max(0, MIN_LOADING_MS - elapsed);

    if (hideLoadingTimer) {
      clearTimeout(hideLoadingTimer);
      hideLoadingTimer = null;
    }

    if (remaining === 0) {
      set({ loading: false });
      return;
    }

    hideLoadingTimer = setTimeout(() => {
      set({ loading: false });
      hideLoadingTimer = null;
    }, remaining);
  },
  showToast: (text) => {
    set({ toast: text });
    setTimeout(
      () => set((s) => (s.toast === text ? { toast: null } : s)),
      4200,
    );
  },
  openModal: (kind, payload) =>
    set({ modal: kind, modalPayload: payload ?? null }),
  closeModal: () => set({ modal: null, modalPayload: null }),
}));
