const CACHE_NAME  = 'luci-v2';
const IMG_CACHE   = 'luci-images-v2';
const ADMIN_CACHE = 'luci-admin-v1';

const PRECACHE_ASSETS = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/i18n.js',
    '/js/controls.js',
    '/js/app.js',
    '/js/products.js',
    '/js/controls-swipe.js',
];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME)
            .then(c => c.addAll(PRECACHE_ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(k => ![CACHE_NAME, IMG_CACHE, ADMIN_CACHE].includes(k))
                    .map(k => caches.delete(k))
            )
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);

    if (url.pathname.includes('admin')) {
        e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
        return;
    }

    if (/\.(avif|webp|png|jpe?g|svg|gif)(\?.*)?$/i.test(url.pathname)) {
        e.respondWith(
            caches.open(IMG_CACHE).then(async cache => {
                const cached = await cache.match(e.request);
                if (cached) return cached;
                try {
                    const res = await fetch(e.request);
                    if (res.ok) cache.put(e.request, res.clone());
                    return res;
                } catch {
                    return new Response('', { status: 404 });
                }
            })
        );
        return;
    }

    if (url.origin === self.location.origin) {
        e.respondWith(
            caches.open(CACHE_NAME).then(async cache => {
                const cached = await cache.match(e.request);
                const fetchP = fetch(e.request).then(res => {
                    if (res.ok) cache.put(e.request, res.clone());
                    return res;
                }).catch(() => cached);
                return cached || fetchP;
            })
        );
    }
});

self.addEventListener('message', e => {
    if (e.data?.type === 'PRELOAD_IMAGES' && Array.isArray(e.data.urls)) {
        caches.open(IMG_CACHE).then(cache => {
            e.data.urls.forEach(url => {
                cache.match(url).then(hit => {
                    if (!hit) fetch(url).then(res => { if (res.ok) cache.put(url, res); }).catch(() => {});
                });
            });
        });
    }
});