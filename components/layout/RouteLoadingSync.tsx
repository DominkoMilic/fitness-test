"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useUIStore } from "@/store/useUIStore";

export function RouteLoadingSync() {
  const pathname = usePathname();
  const setLoading = useUIStore((s) => s.setLoading);
  const closeModal = useUIStore((s) => s.closeModal);

  useEffect(() => {
    closeModal();
    const done = setTimeout(() => setLoading(false), 140);
    return () => clearTimeout(done);
  }, [pathname, closeModal, setLoading]);

  useEffect(() => {
    const onPopState = () => {
      closeModal();
      setLoading(false);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [closeModal, setLoading]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      const anchor = target?.closest("a") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (!href.startsWith("/")) return;

      const nextUrl = new URL(href, window.location.origin);
      const current = window.location.pathname + window.location.search;
      const next = nextUrl.pathname + nextUrl.search;
      if (current === next) return;

      setLoading(true);

      // Failsafe: if route commit signal is delayed (e.g. query-only updates),
      // ensure loader never remains visible indefinitely.
      setTimeout(() => setLoading(false), 1200);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [setLoading]);

  return null;
}
