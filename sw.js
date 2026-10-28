/* MINDBYTE Order System service worker: makes the installed app open offline.
   App files: network first (so updates arrive at once), cached copy when offline.
   The cloud database (GitHub API) and other sites are never cached here. */
/* BUILD is replaced by tools/publish.sh on every publish, so each release is a new worker the app can offer as an update */
const CACHE = "mindbyte-app-20261029023317";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./css/app.css",
  "./js/prices-seed.js", "./js/core.js", "./js/ui.js", "./js/select.js", "./js/wa.js", "./js/docs.js", "./js/pages-sales.js", "./js/pages-people.js",
  "./js/pages-finance.js", "./js/pages-erp.js", "./js/cloud.js", "./js/ai.js", "./js/pages-settings.js", "./js/xfilter.js",
  "./aset/ikon-nota.jpg", "./aset/qris-nota.png", "./aset/app/icon-192.png", "./aset/app/icon-512.png"];
/* a new version waits until the person taps "Update now" in the app (message "skip"); the very first install starts at once */
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); });
self.addEventListener("message", e => { if (e.data === "skip") self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  const cdn = /cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com/.test(u.host);
  if (u.origin !== location.origin && !cdn) return;            /* GitHub API etc.: straight to the network */
  /* app files always ask the server whether they changed (GitHub Pages lets browsers keep a copy for 10 minutes otherwise) */
  const req = cdn ? e.request : new Request(e.request.url, { cache: "no-cache", credentials: "same-origin" });
  e.respondWith(fetch(req).then(r => { if (r.ok && (r.type === "basic" || cdn)) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match("./index.html"))));
});

/* phone notifications sent by the sign-in worker (worker/src/push.js); a tap opens the order they are about */
self.addEventListener("push", e => {
  let m = {}; try { m = e.data ? e.data.json() : {}; } catch (x) { m = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(m.title || "MINDBYTE", { body: m.body || "", tag: m.tag, renotify: !!m.tag, icon: "./aset/app/icon-192.png", badge: "./aset/app/icon-192.png", data: { url: m.url || "#/dashboard" } }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL("./" + ((e.notification.data && e.notification.data.url) || ""), self.registration.scope).href;
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(L => {
    const c = L.find(x => x.url.startsWith(self.registration.scope));
    if (c) return c.navigate(url).then(w => (w || c).focus());
    return clients.openWindow(url);
  }));
});
