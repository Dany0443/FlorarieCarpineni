'use strict';

const fs   = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'telemetry.json');
const CACHE_TTL = 60 * 1000; // 60 seconds

let _cache     = null;
let _cacheTime = 0;

// ── Raw data reader ───────────────────────────────────────────────────────────
function readEvents() {
    const now = Date.now();
    if (_cache && now - _cacheTime < CACHE_TTL) return _cache;

    let events = [];
    try {
        const raw = fs.readFileSync(FILE, 'utf-8').trim();
        if (raw) events = JSON.parse(raw);
        if (!Array.isArray(events)) events = [];
    } catch (_) {
        events = [];
    }

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
        events
        .filter(e => {
        if (e.event !== 'page_view') return false;
        const url = (e.data && e.data.url) || '';
        return !url.includes('/admops');
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
    const seen   = {};

    events.forEach(e => {
        const id    = e.data && e.data.productId;
        const name  = e.data && e.data.productName;
        const sid   = e.sessionId || (e.data && e.data.sessionId);
        if (!id) return;
        if (name) names[id] = name;
        if (e.event === 'product_view') {
            if (!seen[id]) seen[id] = new Set();
            if (sid && !seen[id].has(sid)) { seen[id].add(sid); views[id] = (views[id] || 0) + 1; }
            else if (!sid) views[id] = (views[id] || 0) + 1;
        }
        if (e.event === 'cart_add') adds[id] = (adds[id] || 0) + 1;
    });

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
