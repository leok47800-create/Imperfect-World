// ============================================================
// sw.js — service worker: guarda o jogo no aparelho para abrir
// offline depois da primeira visita (app instalável / PWA).
// Ao mudar arquivos do jogo, aumente a VERSAO para atualizar o cache.
// ============================================================
const VERSAO = 'imperfect-world-v9';
const ARQUIVOS = [
  './', './index.html', './manifest.json', './css/style.css',
  './js/data.js', './js/assets.js', './js/audio.js', './js/battle.js', './js/save.js', './js/ui.js', './js/main.js',
  './assets/hero_guerreiro.png', './assets/hero_mago.png', './assets/hero_arqueiro.png', './assets/npcs.png',
  './assets/enemies_floresta.png', './assets/enemies_pantano.png', './assets/enemies_templo.png',
  './assets/boss_floresta.png', './assets/boss_pantano.png', './assets/boss_templo.png',
  './assets/bg_vila.png', './assets/bg_mapa.png', './assets/bg_floresta.png', './assets/bg_pantano.png', './assets/bg_templo.png',
  './assets/items.png', './assets/ui_icons.png', './assets/logo.png', './assets/title_screen.png', './assets/icon.png',
  './assets/icon-192.png', './assets/icon-512.png',
];

// Instala: baixa tudo. Se alguma arte faltar, instala o resto mesmo assim.
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then(cache =>
    Promise.all(ARQUIVOS.map(url => cache.add(url).catch(() => null)))
  ).then(() => self.skipWaiting()));
});

// Ativa: apaga caches de versões antigas
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(chaves =>
    Promise.all(chaves.filter(k => k !== VERSAO).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

// Busca: primeiro o cache; se não tiver, a rede (e guarda a resposta)
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(cacheado => cacheado || fetch(e.request).then(resp => {
    if (resp.ok && new URL(e.request.url).origin === location.origin) {
      const copia = resp.clone();
      caches.open(VERSAO).then(c => c.put(e.request, copia));
    }
    return resp;
  }).catch(() => cacheado)));
});
