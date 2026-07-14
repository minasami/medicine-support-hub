const CACHE_VERSION = "msh-pwa-v2-20260714";
const APP_SHELL = [
  "/",
  "/offline.html",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/pwa-icon.svg",
  "/pwa-maskable.svg",
  "/medicines",
  "/companies",
  "/clinics",
  "/pharmacies",
  "/labs",
  "/radiology",
  "/marketplace",
  "/learn",
  "/journey",
  "/network",
  "/search",
  "/request"
];

const PRIVATE_PATH_PREFIXES = [
  "/admin",
  "/workspace",
  "/platform-admin",
  "/admin-users",
  "/dashboard",
  "/employee",
  "/reviewer",
  "/physician",
  "/pharmacist",
  "/pharmacy",
  "/delivery",
  "/branch-manager",
  "/cosmetician",
  "/data-entry",
  "/account",
  "/portal",
  "/login",
  "/track",
  "/ngo",
  "/clinics/emr",
  "/pharmacies/pms",
  "/labs/lms",
  "/radiology/rms",
  "/profiles"
];

function isPrivatePath(pathname) {
  return PRIVATE_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((key) => key !== CACHE_VERSION)
              .map((key) => caches.delete(key)),
          ),
        ),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === "/sw.js" || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const privateNavigation = isPrivatePath(url.pathname);
        try {
          const response = await fetch(request);
          if (response.ok && !privateNavigation) {
            const cache = await caches.open(CACHE_VERSION);
            await cache.put(request, response.clone());
          }
          return response;
        } catch {
          if (!privateNavigation) {
            const cachedRoute = await caches.match(request, { ignoreSearch: true });
            if (cachedRoute) return cachedRoute;
            const appShell = await caches.match("/medicines");
            if (appShell) return appShell;
          }
          return caches.match("/offline.html");
        }
      })(),
    );
    return;
  }

  const destination = request.destination;
  const cacheable =
    ["script", "style", "image", "font", "manifest"].includes(destination) ||
    url.pathname.startsWith("/assets/");
  if (!cacheable) return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      const network = fetch(request)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(CACHE_VERSION);
            await cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })(),
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data?.json() || {};
  } catch {
    payload = { body: event.data?.text() || "" };
  }
  const title = payload.title || "Medicine Support Hub";
  const options = {
    body: payload.body || "There is a new platform update.",
    icon: payload.icon || "/pwa-icon.svg",
    badge: payload.badge || "/pwa-icon.svg",
    image: payload.image || undefined,
    data: {
      url: payload.url || "/medicines",
      campaignId: payload.campaignId || null,
      topic: payload.topic || "platform_updates",
    },
    tag: payload.campaignId
      ? `campaign-${payload.campaignId}`
      : `msh-${payload.topic || "update"}`,
    renotify: false,
    requireInteraction: payload.topic === "medicine_updates",
    timestamp: payload.timestamp || Date.now(),
    actions: [
      { action: "open", title: "Open update" },
      { action: "dismiss", title: "Dismiss" },
    ],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;
  const target = new URL(
    event.notification.data?.url || "/medicines",
    self.location.origin,
  ).href;
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clientList) {
        if ("focus" in client) {
          await client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })(),
  );
});
