/* Service worker: cachea el app shell para funcionar offline.
 * Sube CACHE_VERSION cuando cambies archivos para forzar actualización. */
const CACHE_VERSION = "cartas-cj-v4";

const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/styles.css",
  "./js/app.js",
  "./js/config.js",
  "./js/excel.js",
  "./js/pdf_render.js",
  "./js/cartas_contenido.js",
  "./vendor/pdf-lib.min.js",
  "./vendor/jszip.min.js",
  "./vendor/xlsx.full.min.js",
  "./vendor/FileSaver.min.js",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./assets/membrete.png",
  "./assets/firma.jpg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_VERSION).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* Network-first para recursos propios: con internet siempre sirve la última
 * versión (los cambios de código se ven sin subir CACHE_VERSION); sin internet
 * usa el caché. Así la app sigue funcionando offline sin servir código viejo. */
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return; // deja pasar lo externo

  e.respondWith(
    fetch(e.request).then((resp) => {
      if (resp && resp.ok) {
        const copy = resp.clone();
        caches.open(CACHE_VERSION).then((c) => c.put(e.request, copy)).catch(() => {});
      }
      return resp;
    }).catch(() => caches.match(e.request))
  );
});
