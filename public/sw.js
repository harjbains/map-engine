const SHELL_CACHE = "map-engine-shell-v1169";
const MAP_CACHE = "map-engine-map-v1";

const scopeUrl = new URL(self.registration.scope);
const scopePath = scopeUrl.pathname === "/" ? "" : scopeUrl.pathname.replace(/\/$/, "");

const SHELL = [
  `${scopePath}/manifest.webmanifest`,
  `${scopePath}/map-style.json`,
  `${scopePath}/icon-192.png`,
  `${scopePath}/icon-512.png`,
];

async function precacheAppShell() {
  const cache = await caches.open(SHELL_CACHE);
  await Promise.allSettled(SHELL.map((url) => cache.add(url)));
  await cache.add(`${scopePath}/`);
  const home = await fetch(new Request(`${scopePath}/`, { cache: "reload" }));
  if (!home.ok) throw new Error("App shell unavailable");
  await cache.put(`${scopePath}/`, home.clone());
  const html = await home.text();
  const appAssets = new Set();
  for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
    const asset = match[1].replaceAll("&amp;", "&");
    if (asset.startsWith("/") && asset.startsWith(`${scopePath}/`)) appAssets.add(asset);
  }
  await Promise.allSettled([...appAssets].map((url) => cache.add(url)));
}

self.addEventListener("install", (event) => {
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
  if (url.origin === self.location.origin && url.pathname.startsWith(`${scopePath}/`)) {
    event.respondWith(caches.open(SHELL_CACHE).then(async (cache) => {
      if (event.request.mode === "navigate") {
        try {
          const response = await fetch(event.request, { cache: "no-store" });
          if (response.ok) await cache.put(`${scopePath}/`, response.clone());
          return response;
        } catch {
          return await cache.match(event.request, { ignoreSearch: true }) ?? await cache.match(`${scopePath}/`) ?? new Response("Offline", { status: 503 });
        }
      }
      try {
        const response = await fetch(event.request, { cache: "no-store" });
        if (response.ok) await cache.put(event.request, response.clone());
        return response;
      } catch {
        const saved = await cache.match(event.request);
        if (saved) return saved;
        if (event.request.mode === "navigate") return cache.match(`${scopePath}/`);
        return new Response("Offline", { status: 503 });
      }
    }));
  }
});