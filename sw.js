const CACHE_NAME = "conecta-caicara-v1";

const ARQUIVOS = [
  "./",
  "./index.html",
  "./dashboard.html",
  "./perfil.html",
  "./mapa.html",
  "./contas.html",
  "./chamada.html",
  "./historico.html",
  "./importacao.html",
  "./participantes.html",
  "./css/style.css"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ARQUIVOS);
    })
  );

  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(chaves => {
      return Promise.all(
        chaves
          .filter(chave => chave !== CACHE_NAME)
          .map(chave => caches.delete(chave))
      );
    })
  );

  self.clients.claim();
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(resposta => {
      return resposta || fetch(event.request);
    })
  );
});
