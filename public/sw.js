const CACHE_NAME  = 'luci-v4';
const IMG_CACHE   = 'luci-images-v2';
const ADMIN_CACHE = 'luci-admin-v3';

const PRECACHE_ASSETS = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/i18n.js',
    '/js/app.js',
    '/js/products.js',
    '/manifest.json'
];

self.addEventListener('install', e => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return Promise.all(
                PRECACHE_ASSETS.map(url => {
                    return fetch(new Request(url, { cache: 'reload' })).then(res => {
                        if (res.ok) {
                            return cache.put(url, res);
                        }
                    }).catch(err => console.error('Precache failed:', url, err));
                })
            );
        })
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

    if (e.request.method !== 'GET') return;
    if (!url.protocol.startsWith('http')) return;

    if (url.pathname.endsWith('.html') || url.pathname.endsWith('.json') || url.pathname.match(/\.(js|css)(\?|$)/)) {
        e.respondWith(
            fetch(e.request, { cache: 'no-cache' })
                .then(res => {
                    if (res.ok) {
                        const clone = res.clone();
                        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
                    }
                    return res;
                })
                .catch(() => caches.match(e.request))
        );
        return;
    }

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

    e.respondWith(
        fetch(e.request)
            .then(res => {
                if (res.ok) {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
                }
                return res;
            })
            .catch(() => caches.match(e.request))
    );
});

self.addEventListener('push', e => {
    if (!e.data) return;
    let data;
    try { data = e.data.json(); } catch { data = { title: 'Luci Boutique', body: e.data.text() }; }
    const options = {
        body: data.body || '',
        icon: data.icon || '/assets/favicon.svg',
        badge: data.badge || '/assets/favicon.svg',
        tag: data.tag || 'default',
        data: data.data || {},
        vibrate: [200, 100, 200],
        requireInteraction: true
    };
    e.waitUntil(
        self.registration.showNotification(data.title || 'Luci Boutique', options)
    );
});

self.addEventListener('notificationclick', e => {
    e.notification.close();
    const url = e.notification.data?.url || '/';
    e.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.navigate(url);
                    return client.focus();
                }
            }
            if (clients.openWindow) return clients.openWindow(url);
        })
    );
});

self.addEventListener('message', async e => {
    if (e.data?.type === 'PRELOAD_IMAGES' && Array.isArray(e.data.urls)) {
        const cache = await caches.open(IMG_CACHE);
        const fetchPromises = e.data.urls.map(async url => {
            const hit = await cache.match(url);
            if (!hit) {
                try {
                    const res = await fetch(url);
                    if (res.ok) await cache.put(url, res);
                } catch (err) {}
            }
        });
        await Promise.all(fetchPromises);
    }
});