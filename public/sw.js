/* Khoonemoon service worker — shell caching only. */
const CACHE_VERSION = "v3";
const CACHE_NAME = `khunemun-shell-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline";

/**
 * Only public, non-personal assets are precached.
 *
 * Authenticated pages (e.g. /today) are never stored in Cache Storage: on a
 * shared device that would leak a household's private data to whoever opens
 * the browser next.
 */
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest"
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never touch cross-origin or Supabase/API traffic: no caching of user data.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/auth/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const offline = await caches.match(OFFLINE_URL);
        return (
          offline ??
          new Response("آفلاین هستید.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          })
        );
      }),
    );
    return;
  }

  if (!isStaticAsset(url)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        if (response.ok) {
          const responseClone = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(request, responseClone));
        }
        return response;
      });
    }),
  );
});

/* ------------------------------------------------------------------ *
 * Web Push: reminders sent by the server (/api/reminders/dispatch).
 * The payload contract is built in src/features/reminders/push.ts.
 * ------------------------------------------------------------------ */

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {
    title: "خونه‌مون",
    body: "یک یادآور دارید.",
    url: "/today",
    tag: "reminder",
  };

  try {
    payload = { ...payload, ...event.data.json() };
  } catch {
    // Keep the safe defaults when the payload is not JSON.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      dir: "rtl",
      lang: "fa",
      icon: "/icons/icon-192.svg",
      badge: "/icons/icon-192.svg",
      data: { url: payload.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url ?? "/today";

  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of clientsList) {
        const clientUrl = new URL(client.url);

        if (clientUrl.origin === self.location.origin) {
          await client.focus();
          client.postMessage({ type: "navigate", url: targetUrl });
          return;
        }
      }

      await self.clients.openWindow(targetUrl);
    })(),
  );
});
