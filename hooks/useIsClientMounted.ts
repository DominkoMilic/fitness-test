"use client";
import { useSyncExternalStore } from "react";

/**
 * Returns `false` during SSR and the first hydration render, `true` once the
 * component is running on the client.
 *
 * Implemented via `useSyncExternalStore` so we avoid a `setState`-in-effect
 * pattern (which React strict-effects / react-compiler flags as a cascading
 * render).
 */
const subscribeNoop = () => () => {};
const getServerSnapshot = () => false;
const getClientSnapshot = () => true;

export function useIsClientMounted(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    getClientSnapshot,
    getServerSnapshot,
  );
}
