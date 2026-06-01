'use strict';

const path = require('path');
const secureStore = require('./secureStore');

const FILE = path.join(__dirname, '..', 'data', 'telemetry.json');
const CACHE_TTL = 60 * 1000; // 60 seconds
const MAX_CART_ADD_QTY = 25;

let _cache     = null;
let _cacheTime = 0;

// ── Raw data reader ───────────────────────────────────────────────────────────
function readEvents() {
    const now = Date.now();
    if (_cache && now - _cacheTime < CACHE_TTL) return _cache;

    let events = secureStore.readJson(FILE, []);
    if (!Array.isArray(events)) events = [];

    _cache     = events;
    _cacheTime = now;
    return events;
}

// Force cache invalidation when a new batch is appended
function invalidate() {
    _cache     = null;
    _cacheTime = 0;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function dayKey(tsMs) {
    return new Date(tsMs).toISOString().slice(0, 10); // YYYY-MM-DD
}

function normalizeProductId(val) {
    const n = Number(val);
    if (!Number.isFinite(n)) return '';
    return String(Math.floor(n));
}

function clampQty(val, min, max) {
    const n = Number(val);
    if (!Number.isFinite(n)) return null;
    return Math.min(max, Math.max(min, Math.floor(n)));
}

function decodeTelemetryText(val) {
    if (val == null) return '';
    return String(val)
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x2F;/gi, '/');
}

function telemetryPathOnly(val) {
    const raw = decodeTelemetryText(val).trim();
    if (!raw) return '/';
    let pathname = '/';
    try {
        pathname = new URL(raw, 'https://local.invalid').pathname || '/';
    } catch (_) {
        pathname = raw.split('?')[0].split('#')[0] || '/';
    }
    if (!pathname.startsWith('/')) pathname = `/${pathname}`;
    pathname = pathname.replace(/\/{2,}/g, '/').trim();
    pathname = pathname.replace(/[\u0000-\u001f\u007f]/g, '');
    return pathname.slice(0, 200) || '/';
}

function isAdminTelemetryPath(val) {
    const p = telemetryPathOnly(val).toLowerCase();
    return p === '/admops'
        || p.startsWith('/admops/')
        || p === '/login'
        || p.startsWith('/private/')
        || p === '/private/admin.html';
}

function last30Days() {
    const days = [];
    const now  = new Date();
    for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        days.push(d.toISOString().slice(0, 10));
    }
    return days;
}

// ── Exported functions ────────────────────────────────────────────────────────

/** Unique page_view sessions per day, last 30 days */
function getDailySummary() {
    const events  = readEvents();
    const days    = last30Days();
    const counts  = {};
    const seen    = {};
    days.forEach(d => { counts[d] = 0; seen[d] = new Set(); });

    events
        .filter(e => {
            if (e.event !== 'page_view') return false;
            const url = (e.data && e.data.url) || '';
            return !isAdminTelemetryPath(url);
        })
        .forEach(e => {
            const d = dayKey(e.serverTs || e.ts || Date.now());
            if (counts[d] === undefined) return;
            const sid = e.sessionId || e.data && e.data.sessionId;
            if (sid && !seen[d].has(sid)) {
                seen[d].add(sid);
                counts[d]++;
            } else if (!sid) {
            }
        });

    return days.map(d => ({ date: d, visits: counts[d] }));
}

/** Most viewed products and most added to cart */
function getTopProducts() {
    const events  = readEvents();
    const views   = {};
    const adds    = {};
    const names   = {};
    const seenViews = {};
    const addBySessionAndProduct = new Map();

    events.forEach(e => {
        const id    = normalizeProductId(e.data && e.data.productId);
        const name  = e.data && e.data.productName;
        const sid   = e.sessionId || (e.data && e.data.sessionId);
        if (!id) return;
        if (name) names[id] = name;
        if (e.event === 'product_view') {
            if (!seenViews[id]) seenViews[id] = new Set();
            if (sid && !seenViews[id].has(sid)) { seenViews[id].add(sid); views[id] = (views[id] || 0) + 1; }
            else if (!sid) views[id] = (views[id] || 0) + 1;
        }
        if (e.event === 'cart_add') {
            const qty = clampQty(e.data && e.data.qty, 1, MAX_CART_ADD_QTY) || 1;
            if (sid) {
                const key = `${sid}|${id}`;
                const prevQty = addBySessionAndProduct.get(key) || 0;
                if (qty > prevQty) addBySessionAndProduct.set(key, qty);
            } else {
                adds[id] = (adds[id] || 0) + qty;
            }
        }
    });

    for (const [key, qty] of addBySessionAndProduct.entries()) {
        const id = key.split('|')[1];
        adds[id] = (adds[id] || 0) + qty;
    }

    const allIds = [...new Set([...Object.keys(views), ...Object.keys(adds)])];
    return allIds
        .map(id => ({ id, name: names[id] || id, views: views[id] || 0, adds: adds[id] || 0 }))
        .sort((a, b) => (b.views + b.adds) - (a.views + a.adds))
        .slice(0, 20);
}

/** Mobile vs desktop, OS split, browser split */
function getDeviceBreakdown() {
    const events = readEvents();
    const seen   = {}; // one per session
    const mobile = { yes: 0, no: 0 };
    const os     = {};
    const browser = {};

    events
        .filter(e => e.event === 'page_view' && e.sessionId)
        .forEach(e => {
            if (seen[e.sessionId]) return;
            seen[e.sessionId] = true;
            const ua = e.parsedUa || {};
            mobile[ua.isMobile ? 'yes' : 'no']++;
            if (ua.os)      os[ua.os]           = (os[ua.os] || 0) + 1;
            if (ua.browser) browser[ua.browser] = (browser[ua.browser] || 0) + 1;
        });

    return {
        mobile:   mobile.yes,
        desktop:  mobile.no,
        os:       sortObj(os),
        browser:  sortObj(browser)
    };
}

/** Visits per country */
function getCountryBreakdown() {
    const events  = readEvents();
    const seen    = {};
    const counts  = {};

    events
        .filter(e => e.event === 'page_view' && e.sessionId)
        .forEach(e => {
            if (seen[e.sessionId]) return;
            seen[e.sessionId] = true;
            const c = e.country || 'unknown';
            counts[c] = (counts[c] || 0) + 1;
        });

    return sortObj(counts);
}

/** checkout_attempt → checkout_success / checkout_fail counts */
function getCheckoutFunnel() {
    const events = readEvents();
    let attempts = 0, successes = 0, fails = 0;
    events.forEach(e => {
        if (e.event === 'checkout_attempt') attempts++;
        if (e.event === 'checkout_success') successes++;
        if (e.event === 'checkout_fail')    fails++;
    });
    return { attempts, successes, fails };
}

/** Last N JS errors with device info and time */
function getErrorLog(limit = 20) {
    const events = readEvents();
    return events
        .filter(e => e.event === 'js_error')
        .slice(-limit)
        .reverse()
        .map(e => ({
            ts:      e.serverTs || e.ts,
            message: (e.data && e.data.message) || '',
            file:    (e.data && e.data.filename) || '',
            line:    (e.data && e.data.line) || 0,
            browser: (e.parsedUa && e.parsedUa.browser) || '?',
            os:      (e.parsedUa && e.parsedUa.os) || '?',
            country: e.country || '?'
        }));
}

/** Average FPS per deviceType, average load time per model */
function get3DPerformance() {
    const events = readEvents();
    const fps    = {};   // deviceType → { sum, count }
    const loads  = {};   // modelId   → { sum, count }

    events.forEach(e => {
        if (e.event === 'model_fps' && e.data) {
            const dt = e.data.deviceType || 'unknown';
            if (!fps[dt]) fps[dt] = { sum: 0, count: 0 };
            fps[dt].sum   += Number(e.data.fps) || 0;
            fps[dt].count++;
        }
        if (e.event === 'model_load_end' && e.data) {
            const mid = e.data.productId || 'unknown';
            if (!loads[mid]) loads[mid] = { sum: 0, count: 0, name: e.data.productName || mid };
            loads[mid].sum   += Number(e.data.durationMs) || 0;
            loads[mid].count++;
        }
    });

    const fpsByDevice = Object.entries(fps).map(([dt, v]) => ({
        deviceType: dt,
        avgFps: Math.round(v.sum / v.count),
        samples: v.count
    }));

    const loadByModel = Object.entries(loads).map(([id, v]) => ({
        productId: id,
        name: v.name,
        avgLoadMs: Math.round(v.sum / v.count),
        samples: v.count
    }));

    return { fpsByDevice, loadByModel };
}

/** Average LCP, CLS, FCP */
function getWebVitals() {
    const events = readEvents();
    const acc    = { LCP: { sum: 0, n: 0 }, CLS: { sum: 0, n: 0 }, FCP: { sum: 0, n: 0 } };

    events
        .filter(e => e.event === 'web_vital' && e.data && e.data.name && acc[e.data.name])
        .forEach(e => {
            acc[e.data.name].sum += Number(e.data.value) || 0;
            acc[e.data.name].n++;
        });

    const avg = name => acc[name].n > 0 ? Math.round(acc[name].sum / acc[name].n) : null;

    return { lcp: avg('LCP'), cls: acc.CLS.n > 0 ? Math.round(acc.CLS.sum / acc.CLS.n * 1000) / 1000 : null, fcp: avg('FCP'), samples: { lcp: acc.LCP.n, cls: acc.CLS.n, fcp: acc.FCP.n } };
}

// ── Utility ───────────────────────────────────────────────────────────────────
function sortObj(obj) {
    return Object.entries(obj)
        .sort((a, b) => b[1] - a[1])
        .reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {});
}

module.exports = {
    getDailySummary,
    getTopProducts,
    getDeviceBreakdown,
    getCountryBreakdown,
    getCheckoutFunnel,
    getErrorLog,
    get3DPerformance,
    getWebVitals,
    invalidate
};
