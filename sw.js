// BCCO Service Worker
// ------------------------------------------------------------------
// Stratégies de cache :
//  - HTML (navigations) + data (.csv, .json) : NETWORK-FIRST
//    → toujours la dernière version dispo, fallback cache si offline
//  - CSS / JS / fonts : STALE-WHILE-REVALIDATE
//    → instantané depuis le cache, mais on rafraîchit en arrière-plan
//      pour la visite suivante (plus besoin de vider le cache navigateur !)
//  - Images (.webp, .png, .jpg, .svg…) : CACHE-FIRST
//    → elles changent rarement, on garde le chargement instantané
// ------------------------------------------------------------------
// IMPORTANT : à chaque modif de ce fichier, bump CACHE_VERSION pour
// invalider les anciens caches et forcer un re-fetch propre.
const CACHE_VERSION = 'v62-2026-05-29';
const CACHE_NAME    = 'bcco-' + CACHE_VERSION;

const SHELL = [
  './index.html',
  './equipes.html',
  './reservations.html',
  './galerie.html',
  './styles.css'
];

// ------------------------------------------------------------------
// Install : précharge le shell minimal
// ------------------------------------------------------------------
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(SHELL).catch(() => {})) // on tolère l'échec partiel
      .then(() => self.skipWaiting())
  );
});

// ------------------------------------------------------------------
// Activate : purge agressive des anciens caches
// ------------------------------------------------------------------
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------
// Safari refuse de servir une réponse marquée `redirected:true` depuis un SW.
async function cleanRedirected(res) {
  if (!res || !res.redirected) return res;
  const blob = await res.blob();
  return new Response(blob, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  });
}

function isHTMLRequest(req, url) {
  if (req.mode === 'navigate') return true;
  if ((req.headers.get('accept') || '').includes('text/html')) return true;
  return /\.html$/i.test(url.pathname);
}
function isDataRequest(url) {
  return /\.(csv|json)$/i.test(url.pathname);
}
function isImageRequest(url) {
  return /\.(webp|png|jpe?g|svg|gif|ico|avif)$/i.test(url.pathname);
}
function isAssetRequest(url) {
  return /\.(css|js|woff2?|ttf|otf|eot)$/i.test(url.pathname);
}

// Network-first : toujours essayer le réseau, fallback cache si KO
async function networkFirst(request) {
  try {
    const fresh = await fetch(request);
    const clean = await cleanRedirected(fresh);
    if (clean && clean.status === 200) {
      const clone = clean.clone();
      caches.open(CACHE_NAME).then(c => c.put(request, clone)).catch(() => {});
    }
    return clean;
  } catch (_) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const home = await caches.match('./index.html');
      if (home) return home;
    }
    throw new Error('Offline et non en cache');
  }
}

// Stale-while-revalidate : sert le cache instantanément + refresh en bg
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const networkPromise = fetch(request)
    .then(async res => {
      const clean = await cleanRedirected(res);
      if (clean && clean.status === 200) {
        const clone = clean.clone();
        caches.open(CACHE_NAME).then(c => c.put(request, clone)).catch(() => {});
      }
      return clean;
    })
    .catch(() => null);
  return cached || networkPromise;
}

// Cache-first : sert le cache, fetch seulement si manquant
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  const clean = await cleanRedirected(fresh);
  if (clean && clean.status === 200) {
    const clone = clean.clone();
    caches.open(CACHE_NAME).then(c => c.put(request, clone)).catch(() => {});
  }
  return clean;
}

// ------------------------------------------------------------------
// Fetch handler
// ------------------------------------------------------------------
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Pas d'interception cross-origin (Google Fonts, GitHub API, etc.)
  if (url.origin !== self.location.origin) return;

  // Pas de cache pour les requêtes avec query string explicitement no-cache
  if (url.searchParams.has('_') || url.searchParams.has('nocache')) {
    e.respondWith(fetch(e.request).then(cleanRedirected).catch(() => caches.match(e.request)));
    return;
  }

  if (isHTMLRequest(e.request, url) || isDataRequest(url)) {
    // HTML + data : toujours frais
    e.respondWith(networkFirst(e.request));
    return;
  }
  if (isAssetRequest(url)) {
    // CSS / JS / fonts : rapide + refresh en arrière-plan
    e.respondWith(staleWhileRevalidate(e.request));
    return;
  }
  if (isImageRequest(url)) {
    // Images : cache long terme
    e.respondWith(cacheFirst(e.request));
    return;
  }
  // Tout le reste : stale-while-revalidate par défaut
  e.respondWith(staleWhileRevalidate(e.request));
});

// ------------------------------------------------------------------
// Message handler : permet de forcer le skipWaiting depuis pwa.js
// ------------------------------------------------------------------
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
