// sw.js — Inspection Performans Paneli Service Worker
// Bu dosyayı HTML dosyanızla aynı dizine (GitHub Pages repo root'una) koyun.
// Chrome, Edge, Firefox ve Android için PWA install promptu bu dosya sayesinde tetiklenir.

const CACHE_NAME = 'inspection-panel-v3';

// Sayfa URL'sini dinamik al — hangi origin'den yüklenirse o cache edilsin
self.addEventListener('install', e => {
  console.log('[SW] Installing...');
  e.waitUntil(
    // Cache'e eklerken hata olursa install yine de tamamlansın
    caches.open(CACHE_NAME)
      .then(cache => {
        // SW'nin scope'undaki ana sayfayı cache'e al
        const pageUrl = self.registration.scope;
        // Panel HTML dosyasını bul (scope dizinindeki ilk HTML)
        return cache.addAll([pageUrl]).catch(err => {
          console.warn('[SW] Cache add failed (may be ok):', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  console.log('[SW] Activating...');
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => {
            console.log('[SW] Deleting old cache:', k);
            return caches.delete(k);
          })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  // Chrome DevTools ve extension isteklerini atla
  if (e.request.url.startsWith('chrome-extension://')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) {
        // Cache'den sun, arka planda güncelle (stale-while-revalidate)
        fetch(e.request)
          .then(resp => {
            if (resp && resp.ok && resp.type === 'basic') {
              caches.open(CACHE_NAME).then(c => c.put(e.request, resp));
            }
          })
          .catch(() => {});
        return cached;
      }
      // Cache'de yok — networkten getir ve cache'e ekle
      return fetch(e.request).then(resp => {
        if (resp && resp.ok && resp.type === 'basic') {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(err => {
        console.warn('[SW] Fetch failed:', e.request.url, err);
      });
    })
  );
});
