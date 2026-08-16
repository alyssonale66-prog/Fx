const CACHE = "fx-cache-v3";

const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json"
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

  /*
    Arquivos principais do aplicativo:
    sempre tenta buscar a versão nova primeiro.
  */

  if (
    request.url.includes("/app.js") ||
    request.url.includes("/index.html") ||
    request.url.includes("/style.css")
  ) {

    event.respondWith(

      fetch(request)
        .then(response => {

          const copy = response.clone();

          caches.open(CACHE).then(cache => {
            cache.put(request, copy);
          });

          return response;

        })
        .catch(() => {
          return caches.match(request);
        })

    );

    return;

  }


  /*
    Outros arquivos:
    cache primeiro.
  */

  event.respondWith(

    caches.match(request)
      .then(response => {

        return response || fetch(request);

      })

  );

});
