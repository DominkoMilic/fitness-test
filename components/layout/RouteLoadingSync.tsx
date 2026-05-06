"use client";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useUIStore } from "@/store/useUIStore";

export function RouteLoadingSync() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const setLoading = useUIStore((s) => s.setLoading);

  useEffect(() => {
    const done = setTimeout(() => setLoading(false), 140);
    return () => clearTimeout(done);
  }, [pathname, searchParams, setLoading]);

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
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [setLoading]);

  return null;
}
