/* Static shell only: never cache Supabase, authenticated data, or API responses. */
const CACHE = "khoonemoon-mobile-shell-v1";
const scope = new URL(self.registration.scope);
const shell = new URL("index.html", scope).href;
const staticPrefix = new URL("assets/", scope).pathname;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const response = await fetch(shell, { cache: "no-store" });
      if (!response.ok) throw new Error("shell unavailable");
      const html = await response.clone().text();
      const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
        .map((match) => new URL(match[1], scope))
        .filter(
          (url) =>
            url.origin === scope.origin &&
            url.pathname.startsWith(staticPrefix) &&
            /\.(js|css)$/.test(url.pathname),
        )
        .map((url) => url.href);
      const cache = await caches.open(CACHE);
      await cache.put(shell, response);
      await cache.addAll(assets);
    })(),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys())
        if (key.startsWith("khoonemoon-mobile-shell-") && key !== CACHE)
          await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== scope.origin) return;
  if (
    request.mode === "navigate" &&
    (url.pathname === scope.pathname ||
      url.pathname === new URL("index.html", scope).pathname)
  ) {
    event.respondWith(
      fetch(request).catch(async () => (await caches.open(CACHE)).match(shell)),
    );
    return;
  }
  if (
    !url.pathname.startsWith(staticPrefix) ||
    url.search ||
    !/\.(js|css|woff2|png|svg)$/.test(url.pathname)
  )
    return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(request);
      if (hit) return hit;
      const response = await fetch(request);
      if (response.ok && response.type === "basic")
        await cache.put(request, response.clone());
      return response;
    })(),
  );
});
