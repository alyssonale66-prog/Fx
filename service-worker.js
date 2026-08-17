const CACHE = "fx-cache-v4";

const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", event => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE)
          .map(key => caches.delete(key))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;

  // Ignora chamadas que não sejam GET
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  /*
    Arquivos principais do aplicativo (incluindo a raiz '/'):
    sempre tenta buscar a versão nova primeiro (Network-First).
  */
  const isCoreAsset =
    url.pathname.endsWith("/") ||
    url.pathname.endsWith("/index.html") ||
    url.pathname.endsWith("/app.js") ||
    url.pathname.endsWith("/style.css");

  if (isCoreAsset) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE).then(cache => {
              cache.put(request, copy);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request, { ignoreSearch: true });
        })
    );
    return;
  }

  /*
    Outros arquivos (ícones, manifest, etc):
    cache primeiro (Cache-First).
  */
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(response => {
      return response || fetch(request);
    })
  );
});
