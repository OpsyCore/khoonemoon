/* Static shell only: never cache Supabase, authenticated data, or API responses. */
const CACHE = "khoonemoon-mobile-shell-v1";
const scope = new URL(self.registration.scope);
const shell = new URL("index.html", scope).href;
const staticPrefix = new URL("assets/", scope).pathname;

// Cache only a credential-free, static shell. Populate its hashed assets first
// so a failed update never replaces a previously usable offline shell.
async function refreshShell() {
  const response = await fetch(shell, {
    cache: "no-store",
    credentials: "omit",
  });
  if (
    !response.ok ||
    !response.headers.get("content-type")?.includes("text/html")
  )
    throw new Error("shell unavailable");
  const html = await response.clone().text();
  const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => new URL(match[1], scope))
    .filter(
      (url) =>
        url.origin === scope.origin &&
        url.pathname.startsWith(staticPrefix) &&
        !url.search &&
        /\.(js|css)$/.test(url.pathname),
    )
    .map((url) => url.href);
  if (!assets.some((url) => url.endsWith(".js")))
    throw new Error("invalid shell");
  const cache = await caches.open(CACHE);
  await cache.addAll(
    assets.map((url) => new Request(url, { credentials: "omit" })),
  );
  await cache.put(shell, response);
}
self.addEventListener("install", (event) => {
  event.waitUntil(refreshShell());
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
    event.waitUntil(refreshShell().catch(() => {}));
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
      const response = await fetch(request.url, { credentials: "omit" });
      if (response.ok && response.type === "basic")
        await cache.put(request, response.clone());
      return response;
    })(),
  );
});
