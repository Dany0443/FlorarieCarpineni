const ADMIN_SHELL_CACHE = 'luci-admin-shell-v1';
const ADMIN_SHELL_ASSETS = [
    '/admops',
    '/private/admin.css',
    '/private/admin.js',
    '/private/manifest.json',
    '/assets/icon-192.svg',
    '/assets/icon-512.svg',
    '/assets/apple-touch-icon.svg'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(ADMIN_SHELL_CACHE).then(async cache => {
            for (const url of ADMIN_SHELL_ASSETS) {
                try {
                    const res = await fetch(new Request(url, { cache: 'reload' }));
                    if (res.ok) await cache.put(url, res);
                } catch (_) {}
            }
        })
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys
                .filter(key => key !== ADMIN_SHELL_CACHE)
                .filter(key => key.startsWith('luci-admin-shell-'))
                .map(key => caches.delete(key))
        )).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const req = event.request;
    const url = new URL(req.url);

    if (req.method !== 'GET') return;
    if (!url.protocol.startsWith('http')) return;
    if (url.origin !== self.location.origin) return;

    if (url.pathname.startsWith('/api/')) {
        event.respondWith(fetch(req));
        return;
    }

    if (!url.pathname.startsWith('/private/')) return;

    event.respondWith(
        fetch(req)
            .then(res => {
                if (res.ok) {
                    const copy = res.clone();
                    caches.open(ADMIN_SHELL_CACHE).then(cache => cache.put(req, copy));
                }
                return res;
            })
            .catch(() => caches.match(req))
    );
});

self.addEventListener('push', event => {
    if (!event.data) return;

    let data;
    try { data = event.data.json(); } catch { data = { title: 'Luci Admin', body: event.data.text() }; }

    event.waitUntil(
        self.registration.showNotification(data.title || 'Luci Admin', {
            body: data.body || '',
            icon: data.icon || '/assets/icon-192.svg',
            badge: data.badge || '/assets/icon-192.svg',
            data: data.data || {},
            tag: data.tag || 'admin-default',
            requireInteraction: true
        })
    );
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    const targetUrl = event.notification?.data?.url || '/admops';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            for (const client of clientList) {
                if ((client.url.includes('/admops') || client.url.includes('/private/')) && 'focus' in client) {
                    client.navigate(targetUrl);
                    return client.focus();
                }
            }
            return clients.openWindow(targetUrl);
        })
    );
});
