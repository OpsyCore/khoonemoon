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
  // The shell depends on fonts and illustrations referenced by its stylesheet.
  // Precache only same-origin, hashed static assets; never follow arbitrary URLs.
  const dependencies = new Set();
  for (const css of assets.filter((url) => url.endsWith(".css"))) {
    const cssResponse = await cache.match(css);
    if (!cssResponse) throw new Error("stylesheet unavailable");
    const text = await cssResponse.text();
    for (const match of text.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/g)) {
      const url = new URL(match[1], css);
      if (
        url.origin === scope.origin &&
        url.pathname.startsWith(staticPrefix) &&
        !url.search &&
        /\.(woff2|png|webp|svg)$/.test(url.pathname)
      )
        dependencies.add(url.href);
    }
  }
  await cache.addAll(
    [...dependencies].map((url) => new Request(url, { credentials: "omit" })),
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
    !/\.(js|css|woff2|png|webp|svg)$/.test(url.pathname)
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

// Push payloads contain no private titles. Clicking always opens this app's
// reminder inbox, never a URL supplied by the sender.
self.addEventListener("push", (event) => {
  event.waitUntil(
    self.registration.showNotification("خونه‌مون", {
      body: "زمان یک یادآور رسیده است.",
      dir: "rtl",
      lang: "fa",
      icon: new URL("icons/icon-192.png", scope).href,
      tag: "khoonemoon-reminder",
      data: { page: "reminders" },
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const target = new URL("?page=reminders", scope).href;
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clients) {
        const url = new URL(client.url);
        if (
          url.origin === scope.origin &&
          url.pathname.startsWith(scope.pathname)
        ) {
          client.postMessage({ type: "khoonemoon:open-reminders" });
          await client.focus();
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
