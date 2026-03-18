const CACHE = 'luci-admin-v1';
const PRECACHE = [
    '/adminpan.html',
];

self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);
    // ONLY intercept requests if they are related to the admin panel
    if (url.pathname.includes('admin')) {
        e.respondWith(
            caches.match(e.request).then(res => res || fetch(e.request))
        );
    }
});