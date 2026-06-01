(function (W, D) {
    'use strict';

    // ── Session ID ────────────────────────────────────────────────────────────
    function genSessionId() {
        try { return crypto.randomUUID(); } catch (_) {}
        return 'ss-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
    }
    var SESSION_ID = genSessionId();
    var privacyOptOut = navigator.globalPrivacyControl === true || navigator.doNotTrack === '1';

    // ── Settings cache ────────────────────────────────────────────────────────
    var settings = { enabled: !privacyOptOut, errors: true, performance: true, clicks: false, td3: true, checkout: true };
    // Fetch settings async — does not block anything
    fetch('/api/telemetry-settings').then(function (r) {
        return r.ok ? r.json() : null;
    }).then(function (d) {
        if (d && d.settings) settings = Object.assign(settings, d.settings);
        if (privacyOptOut) settings.enabled = false;
    }).catch(function () {});

    // ── Batch & flush ─────────────────────────────────────────────────────────
    var BATCH = [];
    var FLUSH_SIZE = 20;
    var FLUSH_INTERVAL = 30000;
    var flushTimer = null;

    function flush() {
        if (!BATCH.length) return;
        clearTimeout(flushTimer);
        var payload;
        try { payload = JSON.stringify(BATCH.splice(0)); } catch (_) { BATCH = []; return; }
        if (navigator.sendBeacon) {
            try { Blob && navigator.sendBeacon('/api/telemetry', new Blob([payload], { type: 'text/plain;charset=UTF-8' })); } catch (_) { navigator.sendBeacon('/api/telemetry', payload); }
            return;
        }
        fetch('/api/telemetry', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true
        }).catch(function () {});
    }

    function resetTimer() {
        clearTimeout(flushTimer);
        flushTimer = setTimeout(flush, FLUSH_INTERVAL);
    }

    function push(event, data) {
        if (settings.enabled === false) return;
        BATCH.push({ event: event, data: data || {}, sessionId: SESSION_ID, ts: Date.now() });
        if (BATCH.length >= FLUSH_SIZE) flush();
        else resetTimer();
    }

    // Flush on tab hide / close
    D.addEventListener('visibilitychange', function () {
        if (D.visibilityState === 'hidden') flush();
    });
    W.addEventListener('pagehide', flush);

    // ── Auto page_view ────────────────────────────────────────────────────────
    var pageStart = Date.now();
    push('page_view', {
        url: W.location.pathname,
        referrer: (function () {
            try { return D.referrer ? new URL(D.referrer).hostname : ''; }
            catch (_) { return ''; }
        })()
    });

    // ── Time on page ──────────────────────────────────────────────────────────
    D.addEventListener('visibilitychange', function () {
        if (D.visibilityState === 'hidden') {
            push('time_on_page', { ms: Date.now() - pageStart });
        }
    });

    // ── Web Vitals ────────────────────────────────────────────────────────────
    if (settings.performance !== false) {
        // FCP
        try {
            var fcpEntries = W.performance.getEntriesByName('first-contentful-paint');
            if (fcpEntries.length) {
                push('web_vital', { name: 'FCP', value: Math.round(fcpEntries[0].startTime) });
            }
        } catch (_) {}

        // LCP
        try {
            var lcp = 0;
            new PerformanceObserver(function (list) {
                var entries = list.getEntries();
                if (entries.length) lcp = Math.round(entries[entries.length - 1].startTime);
            }).observe({ type: 'largest-contentful-paint', buffered: true });
            W.addEventListener('pagehide', function () {
                if (lcp) push('web_vital', { name: 'LCP', value: lcp });
            });
        } catch (_) {}

        // CLS
        try {
            var clsTotal = 0;
            new PerformanceObserver(function (list) {
                list.getEntries().forEach(function (e) {
                    if (!e.hadRecentInput) clsTotal += e.value;
                });
            }).observe({ type: 'layout-shift', buffered: true });
            W.addEventListener('pagehide', function () {
                push('web_vital', { name: 'CLS', value: Math.round(clsTotal * 1000) / 1000 });
            });
        } catch (_) {}
    }

    // ── Error tracking ────────────────────────────────────────────────────────
    if (settings.errors !== false) {
        W.addEventListener('error', function (e) {
            var msg = String(e.message || '');
            if (msg.toLowerCase().indexOf('transition was skipped') !== -1) return;
            push('js_error', {
                message: msg.slice(0, 200),
                filename: String(e.filename || '').slice(0, 200),
                line: e.lineno || 0,
                col: e.colno || 0
            });
        });
        W.addEventListener('unhandledrejection', function (e) {
            var reasonText = String(e.reason || '');
            var lower = reasonText.toLowerCase();
            if (lower.indexOf('transition was skipped') !== -1) return;
            push('js_error', {
                message: reasonText.slice(0, 200),
                filename: 'promise',
                line: 0,
                col: 0
            });
        });
    }

    // ── Public API ────────────────────────────────────────────────────────────
    W.Telemetry = {
        track: function (event, data) {
            // Category gate
            if (settings.enabled === false) return;
            if (event === 'click') return;
            if (event === 'js_error' && settings.errors === false) return;
            if ((event === 'web_vital' || event === 'model_fps' || event === 'model_load_start' ||
                 event === 'model_load_end') && settings.performance === false) return;
            if ((event === 'checkout_attempt' || event === 'checkout_success' ||
                 event === 'checkout_fail' || event === 'native_pay_attempt' ||
                 event === 'payment_method_shown') && settings.checkout === false) return;
            if ((event === 'model_fps' || event === 'model_load_start' || event === 'model_load_end' ||
                 event === 'model_error') && settings.td3 === false) return;
            push(event, data || {});
        }
    };

}(window, document));
