const SHELL_CACHE = "map-engine-shell-v1161";
const MAP_CACHE = "map-engine-map-v1";
const SHELL = ["/", "/manifest.webmanifest", "/map-style.json", "/icon-192.png", "/icon-512.png"];

async function precacheAppShell() {
  const cache = await caches.open(SHELL_CACHE);
  await Promise.allSettled(SHELL.map((url) => cache.add(url)));
  const home = await fetch(new Request("/", { cache: "reload" }));
  if (!home.ok) throw new Error("App shell unavailable");
  await cache.put("/", home.clone());
  const html = await home.text();
  const appAssets = new Set();
  for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
    const asset = match[1].replaceAll("&amp;", "&");
    if (asset.startsWith("/_next/")) appAssets.add(asset);
  }
  await Promise.allSettled([...appAssets].map((url) => cache.add(url)));
}

self.addEventListener("install", (event) => {
  // Keep the current worker active until every open Map Engine tab has closed.
  // Taking over immediately would reload an active journey and stop its GPS watch.
  event.waitUntil(precacheAppShell());
});

async function activateAppShell() {
  const keys = await caches.keys();
  await Promise.all(keys.filter((key) => key.startsWith("map-engine-shell-") && key !== SHELL_CACHE).map((key) => caches.delete(key)));
}

self.addEventListener("activate", (event) => {
  event.waitUntil(activateAppShell());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin === self.location.origin && url.pathname.startsWith("/api/traffic/")) {
    event.respondWith(fetch(event.request, { cache: "no-store" }));
    return;
  }
  if (url.hostname === "tiles.openfreemap.org") {
    event.respondWith(caches.open(MAP_CACHE).then(async (cache) => {
      const saved = await cache.match(event.request);
      if (saved) return saved;
      try {
        const response = await fetch(event.request);
        if (response.ok || response.type === "opaque") await cache.put(event.request, response.clone());
        return response;
      } catch {
        return new Response("Offline map resource not saved", { status: 503 });
      }
    }));
    return;
  }
  if (url.origin === self.location.origin) {
    event.respondWith(caches.open(SHELL_CACHE).then(async (cache) => {
      if (event.request.mode === "navigate") {
        try {
          const response = await fetch(event.request, { cache: "no-store" });
          if (response.ok) await cache.put("/", response.clone());
          return response;
        } catch {
          return await cache.match(event.request, { ignoreSearch: true }) ?? await cache.match("/") ?? new Response("Offline", { status: 503 });
        }
      }
      const saved = await cache.match(event.request);
      if (saved) return saved;
      try {
        const response = await fetch(event.request);
        if (response.ok) await cache.put(event.request, response.clone());
        return response;
      } catch {
        if (event.request.mode === "navigate") return cache.match("/");
        return new Response("Offline", { status: 503 });
      }
    }));
  }
});
