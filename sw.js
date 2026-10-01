const CACHE_NAME = "conecta-caicara-v1";

const ARQUIVOS = [
  "./",
  "./index.html",
  "./css/style.css",
  "./assets/logo.jpeg"
];

// Instala o Service Worker
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ARQUIVOS))
  );

  self.skipWaiting();
});

// Remove caches antigos
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

// Intercepta as requisições
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(resposta => {
        // Guarda uma cópia atualizada dos arquivos
        const copia = resposta.clone();

        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, copia);
        });

        return resposta;
      })
      .catch(() => {
        // Se estiver sem internet, tenta usar o cache
        return caches.match(event.request);
      })
  );
});
