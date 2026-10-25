/**
 * DiagoLAB — Service Worker trybu terenowego.
 * Strategia: network-first z fallbackiem do cache dla dokumentów,
 * cache-first dla zasobów statycznych (_next, fonty, ikony).
 * Cel: notatnik /teren otwiera się po pierwszej wizycie również offline.
 */

const RUNTIME = "dl-runtime-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(RUNTIME).then((cache) => cache.addAll(["/teren"])).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== RUNTIME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Zasoby statyczne: cache-first (mają hashe w nazwach — bezpieczne)
  if (url.pathname.startsWith("/_next/") || url.pathname.startsWith("/samples/")) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            const clone = res.clone();
            caches.open(RUNTIME).then((c) => c.put(req, clone)).catch(() => {});
            return res;
          })
      )
    );
    return;
  }

  // Dokumenty: network-first, fallback do cache (offline)
  if (req.mode === "navigate" || url.pathname.startsWith("/teren")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(RUNTIME).then((c) => c.put(req, clone)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match("/teren"))
        )
    );
  }
});
