const CACHE_NAME = "do-do-phone-v11";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./supabase.js",
  "./app.js",
  "./features.js",
  "./assets/dodo-icon.png",
  "./manifest.webmanifest",
  "./icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = { title: "Do-Do", body: "You have a reminder" };
  try { data = event.data?.json() || data; } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "./assets/dodo-icon.png",
      badge: "./assets/dodo-icon.png",
      tag: data.tag || "do-do-reminder",
      data: data.data || {},
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      return clients.openWindow("/");
    })
  );
});

// Background sync - retry queued cards when connection returns
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-cards") {
    event.waitUntil(
      self.clients.matchAll({ type: "window" }).then((clientList) => {
        clientList.forEach((client) => client.postMessage({ type: "flush-sync-queue" }));
      })
    );
  }
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const cachedResponse = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cachedResponse));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("./index.html")))
  );
});
