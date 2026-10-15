// Service worker: deixa o app (e os desafios) disponíveis offline.
// Estratégia igual à do TEMa Estudo: pré-cacheia o app na instalação e responde
// cache-first com atualização em segundo plano (stale-while-revalidate).
// O GitHub Actions troca __VERSAO__ pelo commit a cada deploy, o que cria um
// cache novo e descarta o antigo.

const VERSAO = '__VERSAO__';
const CACHE = `logica-${VERSAO}`;
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './js/jogo.js',
  './js/motor.js',
  './js/estado.js',
  './js/ui.js',
  './js/versao.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './desafios/index.json',
];
const FONTES = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })));
      // Desafios listados no índice (assim um desafio novo não exige mexer aqui)
      try {
        const r = await fetch('./desafios/index.json', { cache: 'reload' });
        const { desafios } = await r.json();
        await cache.addAll(desafios.map((f) => new Request(`./desafios/${f}`, { cache: 'reload' })));
      } catch (e) {
        /* offline durante a instalação: os desafios entram no cache ao serem abertos */
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('logica-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Fontes do Google: cache-first (para o visual continuar igual offline)
  if (FONTES.includes(url.hostname)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copia = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copia));
            return res;
          }),
      ),
    );
    return;
  }
  if (url.origin !== location.origin) return;

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      const daRede = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copia = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copia));
          }
          return res;
        })
        .catch(() => cached || (req.mode === 'navigate' ? caches.match('./index.html') : undefined));
      return cached || daRede;
    }),
  );
});
