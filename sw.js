// BCCO Service Worker — cache shell + stratégie réseau en fallback
const CACHE_NAME = 'bcco-v38';
const SHELL = [
  './index.html',
  './equipes.html',
  './reservations.html',
  './classement.html',
  './galerie.html',
  './styles.css'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Reconstruit une Response "non-redirected" pour Safari/WebKit.
// Safari refuse de servir une réponse marquée `redirected: true` depuis un
// service worker (« Response served by service worker has redirections »),
// ce qui pose problème avec les hébergeurs qui font des redirections de
// /equipes vers /equipes.html (URLs propres Cloudflare Pages, par exemple).
async function cleanRedirected(res) {
  if (!res.redirected) return res;
  const blob = await res.blob();
  return new Response(blob, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  });
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Ne pas intercepter les requêtes cross-origin (Google Sheets, fonts…)
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  // Pour les navigations (changement de page), on laisse le navigateur
  // gérer lui-même les redirections — il sait, pas le service worker.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(cleanRedirected)
        .catch(() => caches.match(e.request).then(cached =>
          cached || caches.match('./index.html')
        ))
    );
    return;
  }

  // Pour les assets (CSS, JS, images, fonts), stratégie cache-first.
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(async res => {
        const clean = await cleanRedirected(res);
        if (clean && clean.status === 200) {
          const cloneForCache = clean.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, cloneForCache));
        }
        return clean;
      });
    })
  );
});
