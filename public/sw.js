const SW_VERSION = "v5";
const APP_SHELL_CACHE = `kf-app-shell-${SW_VERSION}`;
const PAGES_CACHE = `kf-pages-${SW_VERSION}`;
const STATIC_CACHE = `kf-static-${SW_VERSION}`;
const MEDIA_CACHE = `kf-media-${SW_VERSION}`;

const OFFLINE_URL = "/offline.html";

const PRECACHE_URLS = [
  "/",
  OFFLINE_URL,
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
];

const SHOULD_SKIP_CACHE = [
  "supabase.co",
  "googleapis.com",
  "/rest/v1/",
  "/auth/v1/",
  "/storage/v1/",
  "/api/",
];

function isCacheableResponse(response) {
  if (!response) return false;
  if (response.status === 0) return true;
  return response.ok;
}

function shouldBypassCaching(url) {
  return SHOULD_SKIP_CACHE.some((part) => url.href.includes(part));
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  await Promise.all(
    keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(APP_SHELL_CACHE);
      // Precache each URL independently. `cache.addAll()` is all-or-nothing:
      // a single failing entry (offline mid-install, a 500, a renamed asset)
      // rejects the whole install, which leaves the OLD worker in control —
      // that's how an installed PWA gets stuck on a stale build forever.
      // `cache: "reload"` bypasses the HTTP cache so we precache fresh copies.
      await Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch(() => {}),
        ),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const expected = [
        APP_SHELL_CACHE,
        PAGES_CACHE,
        STATIC_CACHE,
        MEDIA_CACHE,
      ];
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => !expected.includes(key))
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

async function networkFirstForPages(request) {
  const cache = await caches.open(PAGES_CACHE);
  try {
    const response = await fetch(request);
    if (isCacheableResponse(response)) {
      cache.put(request, response.clone());
      trimCache(PAGES_CACHE, 30);
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return (await caches.match(OFFLINE_URL)) || Response.error();
  }
}

async function staleWhileRevalidate(event, cacheName, maxEntries) {
  const request = event.request;
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (isCacheableResponse(response)) {
        cache.put(request, response.clone());
        trimCache(cacheName, maxEntries);
      }
      return response;
    })
    .catch(() => null);

  // Hold the worker alive until revalidation finishes. Without this the SW can
  // be terminated right after the cached response is returned, so the refresh
  // never lands and the stale copy is served indefinitely.
  event.waitUntil(fetchPromise);

  if (cached) return cached;
  const fresh = await fetchPromise;
  return fresh || Response.error();
}

async function cacheFirst(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (isCacheableResponse(response)) {
      cache.put(request, response.clone());
      trimCache(cacheName, maxEntries);
    }
    return response;
  } catch {
    return Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Only ever handle our own origin. Third-party requests (analytics, fonts,
  // CDNs) go straight to the network and never pollute our caches.
  if (url.origin !== self.location.origin) return;
  if (shouldBypassCaching(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstForPages(request));
    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    request.destination === "script" ||
    request.destination === "style"
  ) {
    // Next.js emits content-hashed filenames, so a large cap is safe and
    // avoids evicting chunks the current build still needs.
    event.respondWith(staleWhileRevalidate(event, STATIC_CACHE, 200));
    return;
  }

  if (request.destination === "image" || request.destination === "font") {
    event.respondWith(cacheFirst(request, MEDIA_CACHE, 80));
    return;
  }

  event.respondWith(staleWhileRevalidate(event, STATIC_CACHE, 200));
});
