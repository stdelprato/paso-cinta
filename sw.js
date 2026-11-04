// Al abrir la app: si hay internet baja la última versión (actualización automática);
// si no hay o tarda más de 3 s, abre la copia guardada en el celu.
const CACHE = "paso-v7";
const FILES = ["./", "index.html", "styles.css", "core.js", "ble.js", "ui.js", "app.js", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png", "version.json"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const net = fetch(e.request, { cache: "no-cache" }).then(r => {
    if (r.ok || r.type === "opaque") { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  });
  const slow = new Promise(res => setTimeout(() => caches.match(e.request).then(m => m && res(m)), 3000));
  e.respondWith(Promise.race([net.catch(() => caches.match(e.request)), slow]));
});
