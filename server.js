// serverV variable is the version of the server.
let serverV = 6.72;

if (!globalThis.crypto) { globalThis.crypto = require('crypto').webcrypto; }
require('dotenv').config();

const http = require('http');
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const readline = require('readline');
const multer = require('multer');
const { Server } = require('socket.io');
const PDFDocument = require('pdfkit');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const webpush = require('web-push');
const cookieParser  = require('cookie-parser');
const activityLog   = require('./ext/activityLog');
const deviceManager = require('./ext/deviceManager');
const telemetryProcessor = require('./ext/telemetryProcessor');
const { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } = require('@simplewebauthn/server');
const { isoBase64URL, isoBase64ToBuffer, isoUint8ArrayToBase64 } = require('@simplewebauthn/server/helpers');
const app = express();
const PORT = process.env.PORT || 3000;
const DIR_DATA      = path.join(__dirname, 'data');
const DIR_PUBLIC    = path.join(__dirname, 'public');
const DIR_PRIVATE   = path.join(__dirname, 'private');
const DIR_UPLOADS   = path.join(DIR_PUBLIC, 'uploads');
const FILE_ORDERS   = path.join(DIR_DATA, 'orders.json');
const FILE_LOGS     = path.join(DIR_DATA, 'server.log');
const FILE_PRODUCTS = path.join(DIR_PUBLIC, 'js', 'products.js');
const FILE_PRODUCTS_JSON = path.join(DIR_DATA, 'products.json');
const FILE_I18N     = path.join(DIR_PUBLIC, 'js', 'i18n.js');
const FILE_CREDS    = path.join(DIR_DATA, 'credentials.json');
const FILE_PUSH     = path.join(DIR_DATA, 'push-subscriptions.json');
const FILE_TELEMETRY = path.join(DIR_DATA, 'telemetry.json');
const FILE_TELEMETRY_SETTINGS = path.join(DIR_DATA, 'telemetry-settings.json');
const Logger = require('./ext/logger');
const secureStore = require('./ext/secureStore');
const logger = new Logger(DIR_DATA);
const MAX_TELEMETRY_EVENTS = 5000;
const TELEMETRY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_TELEMETRY_SETTINGS = {
    enabled: true,
    errors: true,
    performance: true,
    clicks: false,
    td3: true,
    checkout: true
};
const ASSET_LEASE_MS = 30 * 60 * 1000;
const VAPID_PUBLIC  = process.env.VAPID_PUBLIC  || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE || '';
if (VAPID_PUBLIC && VAPID_PRIVATE) {
    webpush.setVapidDetails(`mailto:${process.env.EMAIL_USER}`, VAPID_PUBLIC, VAPID_PRIVATE);
}

function readPushSubs() {
    return secureStore.readJson(FILE_PUSH, []);
}

function savePushSubs(subs) {
    secureStore.writeJson(FILE_PUSH, subs);
}

async function sendPushNotification(orderId, status) {
    const subs = readPushSubs().filter(sub => sub && sub.adminDeviceToken);
    if (!subs.length) return;
    const titles = {
        new_order: 'Comanda noua',
        preparing: 'Comanda in pregatire',
        shipped: 'Comanda a fost expediata',
        delivered: 'Comanda a fost livrata!'
    };
    const bodies = {
        new_order: `A intrat o comanda noua: #${orderId}.`,
        preparing: `Comanda #${orderId} este acum in pregatire. Vom lua legatura cu tine curand.`,
        shipped: `Comanda #${orderId} a plecat spre tine! Curand o vei primi.`,
        delivered: `Comanda #${orderId} a fost livrata cu succes! Florile au ajuns in siguranta.`
    };
    const payload = JSON.stringify({
        title: titles[status] || 'Actualizare comanda',
        body: bodies[status] || `Comanda #${orderId} a fost actualizata.`,
        icon: '/assets/favicon.svg',
        badge: '/assets/favicon.svg',
        tag: `order-${orderId}`,
        data: { orderId, status, url: '/admops' }
    });
    const results = await Promise.allSettled(
        subs.map(sub => webpush.sendNotification(sub, payload).catch(() => null))
    );
    const failed = results.filter(r => r.status === 'rejected' || !r.value).length;
    if (failed > 0) {
        const validSubs = subs.filter((_, i) => !(results[i].status === 'rejected' || !results[i].value));
        if (validSubs.length < subs.length) { savePushSubs(validSubs); logger.info(`Push: ${failed} subs expirati eliminati`); }
    }
}

for (const dir of [DIR_DATA, DIR_UPLOADS]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function ensureJsonFile(filePath, fallback) {
    if (secureStore.encryptionEnabled()) {
        secureStore.migrateJsonFile(filePath, fallback);
    } else if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2));
    }
}

ensureJsonFile(FILE_ORDERS, []);
if (!fs.existsSync(FILE_LOGS)) fs.writeFileSync(FILE_LOGS, '');
ensureJsonFile(FILE_CREDS, []);
ensureJsonFile(FILE_PUSH, []);
ensureJsonFile(FILE_TELEMETRY, []);
ensureJsonFile(FILE_TELEMETRY_SETTINGS, DEFAULT_TELEMETRY_SETTINGS);
ensureJsonFile(path.join(DIR_DATA, 'devices.json'), []);
ensureJsonFile(path.join(DIR_DATA, 'activity.json'), {});


function escHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escXml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function sanitize(val, maxLen) {
    if (val == null) return '';
    const s = String(val).trim().slice(0, maxLen);
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;')
        .replace(/`/g, '&#x60;')
        .replace(/=/g, '&#x3D;')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

function validateName(val) {
    return /^[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF\s\-\.\']+$/.test(String(val ?? '').trim()) && String(val).trim().length >= 2;
}

function validatePhone(val) {
    return /^[+\d][\d\s\-\(\)]{6,18}$/.test(String(val ?? '').trim());
}

function validateEmail(email) {
    return /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(String(email ?? '').trim());
}

function validateAddress(val) {
    return /^[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF0-9\s\-\.\,\'\/]+$/.test(String(val ?? '').trim()) && String(val).trim().length >= 5;
}

function sanitizeNoSQL(val) {
    if (Array.isArray(val)) {
        return val.map(item => sanitizeNoSQL(item));
    }
    if (typeof val === 'object' && val !== null) {
        const clean = {};
        for (const [k, v] of Object.entries(val)) {
            if (typeof k === 'string' && !k.startsWith('$')) {
                clean[sanitizeNoSQL(k)] = sanitizeNoSQL(v);
            }
        }
        return clean;
    }
    return sanitize(val, 10000);
}

function parseUserAgent(uaRaw) {
    const ua = String(uaRaw || '');
    const l  = ua.toLowerCase();
    const isBrave = l.includes('brave') || (l.includes('chrome') && l.includes('opt/') && !l.includes('edg/'));
    const isFirefox = l.includes('firefox/') && !l.includes('seamonkey/');
    const isSafari = l.includes('safari/') && !l.includes('chrome/') && !l.includes('chromium');
    const isEdge   = l.includes('edg/');
    const isOpera  = l.includes('opr/') || l.includes('opera');
    const isChrome = !isEdge && !isOpera && !isSafari && (l.includes('chrome/') || l.includes('chromium'));
    let browser = 'Unknown';
    if      (isBrave)   browser = 'Brave';
    else if (isEdge)    browser = 'Edge';
    else if (isOpera)   browser = 'Opera';
    else if (isChrome)  browser = 'Chrome';
    else if (isFirefox) browser = 'Firefox';
    else if (isSafari)  browser = 'Safari';

    let os = 'Unknown';
    if      (l.includes('windows nt 11'))      os = 'Windows 11';
    else if (l.includes('windows nt 10'))     os = 'Windows 10';
    else if (l.includes('windows nt 6.3'))    os = 'Windows 8.1';
    else if (l.includes('windows nt 6.2'))    os = 'Windows 8';
    else if (l.includes('windows nt 6.1'))    os = 'Windows 7';
    else if (l.includes('windows'))           os = 'Windows';
    else if (l.includes('chromeos'))          os = 'Chrome OS';
    else if (l.includes('android'))           os = 'Android';
    else if (l.includes('iphone') && !l.includes('ipad')) os = 'iOS';
    else if (l.includes('ipad') || l.includes('tablet'))   os = 'iPadOS';
    else if (l.includes('mac os x') && !l.includes('iphone')) os = 'macOS';
    else if (l.includes('macintosh'))          os = 'macOS';
    else if (l.includes('linux') && !l.includes('android')) os = 'Linux';
    else if (l.includes('ubuntu'))            os = 'Ubuntu';
    else if (l.includes('fedora'))            os = 'Fedora';
    else if (l.includes('debian'))            os = 'Debian';

    const isMobile = /mobi|android|iphone|ipad|ipod|webos|blackberry|iemobile|opera mini/i.test(ua);
    const isTablet = /(ipad|tablet|playbook|silk|tablet pc)/i.test(ua) && !/mobi/i.test(ua);
    return { os, browser, isMobile, isTablet };
}

function telemetryDayKey(tsMs) {
    return new Date(tsMs).toISOString().slice(0, 10);
}

const geoip = require('geoip-lite');

function getCountryFromReq(req) {
    const ip = getRealIp(req);
    if (!ip || ip === '::1' || ip === '127.0.0.1') return 'unknown';
    const geo = geoip.lookup(ip);
    return geo?.country || 'unknown';
}

function readTelemetryEvents() {
    const data = secureStore.readJson(FILE_TELEMETRY, []);
    return Array.isArray(data) ? data : [];
}

function appendTelemetryEvents(events) {
    if (!events.length) return 0;
    const cutoff = Date.now() - TELEMETRY_RETENTION_MS;
    const existing = readTelemetryEvents()
        .filter(e => Number(e && (e.serverTs || e.ts || 0)) >= cutoff);
    existing.push(...events);
    const trimmed = existing.length > MAX_TELEMETRY_EVENTS
        ? existing.slice(existing.length - MAX_TELEMETRY_EVENTS)
        : existing;
    secureStore.writeJson(FILE_TELEMETRY, trimmed);
    telemetryProcessor.invalidate();
    return events.length;
}

function readTelemetrySettings() {
    const raw = secureStore.readJson(FILE_TELEMETRY_SETTINGS, DEFAULT_TELEMETRY_SETTINGS);
    return { ...DEFAULT_TELEMETRY_SETTINGS, ...(raw && typeof raw === 'object' ? raw : {}), clicks: false };
}

function saveTelemetrySettings(next) {
    const merged = { ...DEFAULT_TELEMETRY_SETTINGS, ...next, clicks: false };
    secureStore.writeJson(FILE_TELEMETRY_SETTINGS, merged);
    return merged;
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

function safeTelemetryNumber(val) {
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
}

function clampTelemetryInteger(val, min, max) {
    const n = Number(val);
    if (!Number.isFinite(n)) return null;
    return Math.min(max, Math.max(min, Math.floor(n)));
}

function normalizeTelemetryEventName(val) {
    const event = sanitize(val, 40).toLowerCase();
    return TELEMETRY_ALLOWED_EVENTS.has(event) ? event : '';
}

function normalizeTelemetryProductId(val) {
    const n = Number(val);
    if (!Number.isFinite(n)) return '';
    return String(Math.floor(n));
}

function telemetryPathOnly(val) {
    const raw = decodeTelemetryText(val).trim();
    if (!raw) return '/';
    let pathname = '/';
    try {
        const u = new URL(raw, 'https://local.invalid');
        pathname = u.pathname || '/';
    } catch {
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

function telemetryReferrerHost(val) {
    const raw = decodeTelemetryText(val).trim();
    if (!raw) return '';
    try {
        const u = new URL(raw, 'https://local.invalid');
        return u.hostname === 'local.invalid' ? '' : sanitize(u.hostname, 120);
    } catch {
        return '';
    }
}

function telemetryFileNameOnly(val) {
    const raw = decodeTelemetryText(val).split('?')[0].split('#')[0].trim();
    if (!raw) return '';
    return sanitize(raw.split(/[\\/]/).pop(), 100);
}

function isIgnorableTelemetryError(message) {
    const msg = String(message || '').toLowerCase();
    if (!msg) return false;
    return msg.includes('transition was skipped')
        || msg.includes('aborterror: transition was skipped');
}

function sanitizeTelemetryEventData(event, rawData, validProductIds) {
    const data = (rawData && typeof rawData === 'object') ? sanitizeNoSQL(rawData) : {};

    if (event === 'js_error') {
        const message = sanitize(data.message, 220);
        if (!message || isIgnorableTelemetryError(message)) return null;
        data.message = message.slice(0, 120);
        data.filename = telemetryFileNameOnly(data.filename);
        data.line = clampTelemetryInteger(data.line, 0, 100000) ?? 0;
        data.col = clampTelemetryInteger(data.col, 0, 100000) ?? 0;
        return data;
    }

    if (event === 'time_on_page') {
        const ms = clampTelemetryInteger(data.ms, 0, 24 * 60 * 60 * 1000);
        if (ms == null) return null;
        data.ms = ms;
        return data;
    }

    if (event === 'web_vital') {
        const metric = sanitize(data.name, 20).toUpperCase();
        if (!['LCP', 'FCP', 'CLS'].includes(metric)) return null;
        const rawValue = safeTelemetryNumber(data.value);
        if (rawValue == null) return null;
        const limit = metric === 'CLS' ? 5 : 120000;
        data.name = metric;
        data.value = Math.max(0, Math.min(limit, rawValue));
        return data;
    }

    if (event === 'page_view') {
        data.url = telemetryPathOnly(data.url);
        data.referrer = telemetryReferrerHost(data.referrer);
        delete data.screen;
        delete data.dpr;
        delete data.connection;
        delete data.ua;
        return data;
    }

    if (event === 'checkout_attempt') {
        const totalQty = clampTelemetryInteger(data.totalQty, 1, MAX_TELEMETRY_FLOWERS);
        if (totalQty == null) return null;
        data.totalQty = totalQty;
        data.cartItems = clampTelemetryInteger(data.cartItems, 1, MAX_CART_LINES) ?? 1;
        const totalValue = safeTelemetryNumber(data.totalValue);
        if (totalValue != null) {
            data.totalValue = Math.round(Math.max(0, Math.min(totalValue, MAX_TELEMETRY_VALUE)) * 100) / 100;
        } else {
            delete data.totalValue;
        }
        return data;
    }

    if (event === 'native_pay_attempt' || event === 'payment_method_shown') {
        data.method = sanitize(data.method, 80);
        const totalValue = safeTelemetryNumber(data.totalValue);
        if (totalValue != null) {
            data.totalValue = Math.round(Math.max(0, Math.min(totalValue, MAX_TELEMETRY_VALUE)) * 100) / 100;
        }
        return data;
    }

    if (event === 'product_view'
        || event === 'cart_add'
        || event === 'model_load_start'
        || event === 'model_load_end'
        || event === 'model_error') {
        const productId = normalizeTelemetryProductId(data.productId);
        if (!productId || (validProductIds.size && !validProductIds.has(productId))) return null;
        data.productId = productId;
        if (data.productName != null) data.productName = sanitize(data.productName, 160);
        if (event === 'cart_add') {
            const qty = clampTelemetryInteger(data.qty, 1, MAX_TELEMETRY_FLOWERS);
            if (qty == null) return null;
            data.qty = qty;
        }
        if (event === 'model_load_end') {
            data.durationMs = clampTelemetryInteger(data.durationMs, 0, 120000) ?? 0;
        }
        return data;
    }

    if (event === 'model_fps') {
        data.deviceType = sanitize(data.deviceType, 20) || 'desktop';
        const avgFps = safeTelemetryNumber(data.avgFps ?? data.fps);
        if (avgFps == null) return null;
        data.avgFps = Math.max(1, Math.min(240, avgFps));
        data.samples = clampTelemetryInteger(data.samples, 1, 5000) ?? 1;
        return data;
    }

    if (event === 'contact_submit') {
        data.source = sanitize(data.source, 120);
        return data;
    }

    return data;
}

function sanitizeTelemetryEventRecord(rawEvent, context) {
    if (!rawEvent || typeof rawEvent !== 'object') return null;
    const event = normalizeTelemetryEventName(rawEvent.event);
    if (!event) return null;
    const data = sanitizeTelemetryEventData(event, rawEvent.data, context.validProductIds);
    if (!data) return null;
    const tsRaw = safeTelemetryNumber(rawEvent.ts);
    const ts = tsRaw != null ? tsRaw : context.now;
    return {
        event,
        data,
        sessionId: sanitize(rawEvent.sessionId, 120),
        ts,
        serverTs: context.serverTs,
        country: context.country,
        ip: '',
        ua: '',
        parsedUa: context.parsedUa
    };
}

function computeTelemetryCartAdds(events) {
    const addsBySession = new Map();
    let anonAdds = 0;
    for (const e of events) {
        if (!e || e.event !== 'cart_add') continue;
        const productId = normalizeTelemetryProductId(e.data && e.data.productId);
        if (!productId) continue;
        const qty = clampTelemetryInteger(e.data && e.data.qty, 1, MAX_TELEMETRY_FLOWERS) ?? 1;
        const sid = String(e.sessionId || '').trim();
        if (!sid) {
            anonAdds += qty;
            continue;
        }
        const key = `${sid}|${productId}`;
        const prev = addsBySession.get(key) || 0;
        if (qty > prev) addsBySession.set(key, qty);
    }
    let total = anonAdds;
    for (const qty of addsBySession.values()) total += qty;
    return total;
}

function toTopList(mapObj, limit = 8) {
    return Object.entries(mapObj)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([label, value]) => ({ label, value }));
}

function extractArrayLiteral(source, marker) {
    const markerIdx = source.indexOf(marker);
    const fromIdx = markerIdx >= 0 ? markerIdx : 0;
    const start = source.indexOf('[', fromIdx);
    if (start === -1) return '';
    let depth = 0;
    let inSingle = false;
    let inDouble = false;
    let escaped = false;
    for (let i = start; i < source.length; i++) {
        const ch = source[i];
        if (escaped) {
            escaped = false;
            continue;
        }
        if ((inSingle || inDouble) && ch === '\\') {
            escaped = true;
            continue;
        }
        if (!inDouble && ch === '\'') {
            inSingle = !inSingle;
            continue;
        }
        if (!inSingle && ch === '"') {
            inDouble = !inDouble;
            continue;
        }
        if (inSingle || inDouble) continue;
        if (ch === '[') depth++;
        if (ch === ']') {
            depth--;
            if (depth === 0) return source.slice(start, i + 1);
        }
    }
    return '';
}

function parseLegacyProductsJs(source) {
    const arrSrc = extractArrayLiteral(source, 'productsData');
    if (!arrSrc) return [];
    const jsonLike = arrSrc
        .replace(/([{,]\s*)([A-Za-z_$][A-Za-z0-9_$]*)\s*:/g, '$1"$2":')
        .replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(jsonLike);
}

function readProducts() {
    const stored = secureStore.readJson(FILE_PRODUCTS_JSON, null);
    if (Array.isArray(stored)) return stored;

    // Migration path from legacy /public/js/products.js
    try {
        const src = fs.readFileSync(FILE_PRODUCTS, 'utf-8');
        const migrated = parseLegacyProductsJs(src);
        if (Array.isArray(migrated)) {
            secureStore.writeJson(FILE_PRODUCTS_JSON, migrated);
            return migrated;
        }
    } catch (e) {
        logger.error(`readProducts migrate: ${e.message}`);
    }
    return [];
}

function pickShareLang(rawLang) {
    return ['ro', 'en', 'ru'].includes(rawLang) ? rawLang : 'ro';
}

function getProductShareText(product, lang) {
    const rawDesc = String(product.desc || '').replace(/\s+/g, ' ').trim();
    const desc = rawDesc.length > 180 ? `${rawDesc.slice(0, 177)}...` : rawDesc;
    const title = `${product.name} — ${product.price} MDL | Luci Boutique`;
    return { title, desc };
}

function toAbsoluteAssetUrl(assetPath, siteUrl) {
    const raw = String(assetPath || '').trim();
    if (!raw) return `${siteUrl}/assets/logo.png`;
    if (/^https?:\/\//i.test(raw)) return raw;
    const normalized = raw.startsWith('/') ? raw : `/${raw}`;
    return `${siteUrl}${encodeURI(normalized)}`;
}

function resolveShareImageUrl(imagePath, siteUrl) {
    const raw = String(imagePath || '').trim();
    if (!raw) return `${siteUrl}/assets/logo.png`;
    if (/^https?:\/\//i.test(raw)) return raw;

    const normalized = raw.startsWith('/') ? raw : `/${raw}`;
    const ext = path.extname(normalized).toLowerCase();

    if (ext === '.avif') {
        const baseName = path.basename(normalized, ext);
        const shareFullPath = path.join(DIR_PUBLIC, 'assets', 'share', `${baseName}.jpg`);
        if (fs.existsSync(shareFullPath)) {
            return `${siteUrl}${encodeURI(`/assets/share/${baseName}.jpg`)}`;
        }
    }

    return toAbsoluteAssetUrl(normalized, siteUrl);
}

function renderProductShareHtml(req, product, lang) {
    const assetState = getStorefrontAssetState();
    const siteUrl = normalizeSiteUrl(process.env.SITE_URL, getRequestOrigin(req));
    const shareUrl = `${siteUrl}/?product=${product.id}&lang=${lang}`;
    const imgUrl = resolveShareImageUrl(product.image, siteUrl);
    const { title, desc } = getProductShareText(product, lang);
    const locale = ({ ro: 'ro_MD', en: 'en_US', ru: 'ru_RU' })[lang];
    const priceLabel = ({ ro: 'Pret', en: 'Price', ru: 'Цена' })[lang] || 'Price';
    let html = fs.readFileSync(path.join(DIR_PUBLIC, 'index.html'), 'utf-8');

    html = html
        .replace('<head>', '<head>\n    <base href="/">')
        .replace(/<html lang="[^"]*">/, `<html lang="${lang}">`)
        .replace(/<title>.*?<\/title>/, `<title>${escHtml(title)}</title>`)
        .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${escHtml(desc)}">`)
        .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${escHtml(title)}">`)
        .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${escHtml(desc)}">`)
        .replace(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${escHtml(imgUrl)}">
    <meta property="og:image:alt" content="${escHtml(product.name)}">
    <meta property="og:site_name" content="Luci Boutique">
    <meta property="og:url" content="${escHtml(shareUrl)}">
    <meta property="product:price:amount" content="${Number(product.price) || 0}">
    <meta property="product:price:currency" content="MDL">`)
        .replace(/<meta property="og:type" content="[^"]*">/, '<meta property="og:type" content="product">')
        .replace(/<meta property="og:locale" content="[^"]*">/, `<meta property="og:locale" content="${locale}">`)
        .replace(/<meta name="twitter:card" content="[^"]*">/, '<meta name="twitter:card" content="summary">')
        .replace(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${escHtml(title)}">`)
        .replace(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${escHtml(desc)}">`)
        .replace(/<meta name="twitter:image" content="[^"]*">/, `<meta name="twitter:image" content="${escHtml(imgUrl)}">
    <meta name="twitter:image:alt" content="${escHtml(product.name)}">
    <meta name="twitter:url" content="${escHtml(shareUrl)}">
    <meta name="twitter:label1" content="${escHtml(priceLabel)}">
    <meta name="twitter:data1" content="${Number(product.price) || 0} MDL">
    <link rel="canonical" href="${escHtml(shareUrl)}">`)
        .replace('</head>', `    <script>
        window.__shareProductId = ${Number(product.id)};
        window.__shareLang = ${JSON.stringify(lang)};
        window.__shareFingerprint = ${JSON.stringify(assetState.fingerprint)};
        localStorage.setItem('lb_lang', ${JSON.stringify(lang)});
        document.documentElement.lang = ${JSON.stringify(lang)};
    </script>
</head>`);

    return html;
}

let assetFingerprintCache = null;

function invalidateAssetFingerprint() {
    assetFingerprintCache = null;
}

function toPublicAssetPath(assetPath) {
    const raw = String(assetPath || '').split('?')[0].split('#')[0].trim();
    if (!raw || /^https?:\/\//i.test(raw) || raw.startsWith('data:')) return null;
    const normalized = path.normalize(raw.replace(/^\/+/, ''));
    const fullPath = path.join(DIR_PUBLIC, normalized);
    const rel = path.relative(DIR_PUBLIC, fullPath);
    if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
    return { fullPath, publicPath: '/' + rel.replace(/\\/g, '/') };
}

function listUploadAssetStats() {
    try {
        return fs.readdirSync(DIR_UPLOADS)
            .filter(name => /\.(avif|webp|png|jpe?g|svg|gif|glb|gltf)$/i.test(name))
            .map(name => {
                const fullPath = path.join(DIR_UPLOADS, name);
                const st = fs.statSync(fullPath);
                return { publicPath: `/uploads/${name}`, size: st.size, mtimeMs: Math.round(st.mtimeMs) };
            });
    } catch {
        return [];
    }
}

function getFileVersionEntry(filePath, label) {
    try {
        const st = fs.statSync(filePath);
        return { label, size: st.size, mtimeMs: Math.round(st.mtimeMs) };
    } catch {
        return { label, missing: true };
    }
}

function getStorefrontAssetState() {
    const products = readProducts();
    const localAssets = new Map();
    for (const p of products) {
        for (const assetPath of [p.image, p.model3d]) {
            const asset = toPublicAssetPath(assetPath);
            if (!asset || localAssets.has(asset.publicPath)) continue;
            try {
                const st = fs.statSync(asset.fullPath);
                localAssets.set(asset.publicPath, {
                    publicPath: asset.publicPath,
                    size: st.size,
                    mtimeMs: Math.round(st.mtimeMs)
                });
            } catch {
                localAssets.set(asset.publicPath, { publicPath: asset.publicPath, missing: true });
            }
        }
    }

    for (const upload of listUploadAssetStats()) {
        localAssets.set(upload.publicPath, upload);
    }

    const visibleProducts = products
        .filter(p => p.listed !== false)
        .map(p => ({
            id: p.id,
            name: p.name,
            category: p.category,
            price: p.price,
            image: p.image,
            family: p.family,
            desc: p.desc,
            care: p.care,
            note: p.note,
            model3d: p.model3d || null,
            listed: p.listed !== false
        }))
        .sort((a, b) => Number(a.id) - Number(b.id));

    const payload = {
        products: visibleProducts,
        code: [
            getFileVersionEntry(FILE_PRODUCTS, 'products.js'),
            getFileVersionEntry(FILE_I18N, 'i18n.js')
        ],
        assets: Array.from(localAssets.values()).sort((a, b) => a.publicPath.localeCompare(b.publicPath))
    };

    const fingerprint = crypto
        .createHash('sha256')
        .update(JSON.stringify(payload))
        .digest('hex')
        .slice(0, 32);

    assetFingerprintCache = {
        fingerprint,
        productCount: visibleProducts.length,
        generatedAt: new Date().toISOString(),
        images: visibleProducts.map(p => p.image).filter(Boolean),
        models: visibleProducts.map(p => p.model3d).filter(Boolean)
    };
    return assetFingerprintCache;
}

function writeProducts(products) {
    const safeProducts = Array.isArray(products) ? products.map(p => ({
        id: Number(p.id),
        name: String(p.name || '').trim(),
        category: String(p.category || 'General').trim(),
        price: Number(p.price) || 0,
        image: String(p.image || ''),
        family: String(p.family || ''),
        desc: String(p.desc || ''),
        care: String(p.care || ''),
        note: String(p.note || ''),
        model3d: p.model3d ? String(p.model3d) : null,
        listed: p.listed !== false,
    })) : [];

    // Source of truth is strict JSON in /data, never executable JS.
    secureStore.writeJson(FILE_PRODUCTS_JSON, safeProducts);

    // Keep browser compatibility by mirroring JSON payload into /public/js/products.js.
    const jsPayload = `const productsData = ${JSON.stringify(safeProducts, null, 4)};\n`;
    fs.writeFileSync(FILE_PRODUCTS, jsPayload, 'utf-8');
    invalidateAssetFingerprint();
}

function readOrders() {
    return secureStore.readJson(FILE_ORDERS, []);
}

function parseOrderSequence(id) {
    const match = /^ORD-(\d+)$/.exec(String(id || '').trim());
    if (!match) return null;
    const n = Number.parseInt(match[1], 10);
    if (!Number.isFinite(n) || n <= 0) return null;
    if (match[1].length > 6) return null;
    return n;
}

function formatOrderId(sequence) {
    const n = Math.max(1, Math.floor(Number(sequence) || 1));
    const width = Math.max(2, String(n).length);
    return `ORD-${String(n).padStart(width, '0')}`;
}

function nextOrderId(orders) {
    let maxSequence = 0;
    for (const order of Array.isArray(orders) ? orders : []) {
        const seq = parseOrderSequence(order?.id);
        if (seq && seq > maxSequence) maxSequence = seq;
    }
    if (maxSequence === 0 && Array.isArray(orders) && orders.length > 0) {
        return formatOrderId(orders.length + 1);
    }
    return formatOrderId(maxSequence + 1);
}

function saveOrder(order, existingOrders = null) {
    const orders = Array.isArray(existingOrders) ? existingOrders : readOrders();
    orders.push(order);
    secureStore.writeJson(FILE_ORDERS, orders);
}

function saveOrders(orders) {
    secureStore.writeJson(FILE_ORDERS, Array.isArray(orders) ? orders : []);
}

function migrateOrdersToSequentialIds() {
    const orders = readOrders();
    if (!Array.isArray(orders) || orders.length === 0) return { changed: false, total: 0, updated: 0 };

    const indexed = orders.map((order, index) => {
        const ts = Date.parse(String(order?.timestamp || ''));
        return { order, index, ts: Number.isFinite(ts) ? ts : Number.POSITIVE_INFINITY };
    });

    indexed.sort((a, b) => {
        if (a.ts !== b.ts) return a.ts - b.ts;
        return a.index - b.index;
    });

    let updated = 0;
    indexed.forEach((entry, idx) => {
        const expectedId = formatOrderId(idx + 1);
        if (entry.order?.id !== expectedId) {
            entry.order.id = expectedId;
            updated += 1;
        }
    });

    if (updated > 0) saveOrders(orders);
    return { changed: updated > 0, total: orders.length, updated };
}

const orderIdMigrationResult = migrateOrdersToSequentialIds();
if (orderIdMigrationResult.changed) {
    logger.info(
        `Order ID migration complete: ${orderIdMigrationResult.updated}/${orderIdMigrationResult.total} orders renumbered to sequential ORD-XX format.`
    );
}

const mailer = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});
const STORE_EMAIL = process.env.STORE_EMAIL || process.env.EMAIL_USER;

// trebuie sa fie pe enviroment usr si pass.
const ADMIN_USER      = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS      = process.env.ADMIN_PASS || '';
const ADMIN_PASS_HASH = process.env.ADMIN_PASS_HASH || '';
const BCRYPT_HASH_RE  = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;
let bcrypt = null;

if (!ADMIN_PASS_HASH && !ADMIN_PASS) {
    process.stderr.write(
        '\n WARNING: ADMIN_PASS_HASH or ADMIN_PASS is not set.\n' +
        '   Admin login is disabled until credentials are configured in .env.\n\n'
    );
}

function getBcrypt() {
    if (!bcrypt) bcrypt = require('bcrypt');
    return bcrypt;
}

// Fix 1: SESSION_SECRET must be stable across restarts.
// If it's missing from .env, every server restart signs out ALL active sessions.
if (!process.env.SESSION_SECRET) {
    process.stderr.write(
        '\n WARNING: SESSION_SECRET is not set in .env!\n' +
        '   Sessions will be invalidated on every server restart.\n' +
        '   Add to .env:  SESSION_SECRET=' + require('crypto').randomBytes(64).toString('hex') + '\n\n'
    );
}
const SESSION_SECRET  = process.env.SESSION_SECRET || crypto.randomBytes(64).toString('hex');
const RATE_WINDOW_MS  = 60 * 1000;
const RATE_MAX        = 5;
const ORDER_RATE_WINDOW_MS = 30 * 60 * 1000;
const ORDER_RATE_MAX = 1;
const MAX_FLOWERS_PER_ORDER = 25;
const MAX_CART_LINES = 25;
const MAX_TELEMETRY_FLOWERS = 25;
const MAX_TELEMETRY_VALUE = 200000;
const TELEMETRY_ALLOWED_EVENTS = new Set([
    'page_view',
    'time_on_page',
    'web_vital',
    'js_error',
    'product_view',
    'cart_add',
    'checkout_attempt',
    'checkout_success',
    'checkout_fail',
    'native_pay_attempt',
    'payment_method_shown',
    'model_fps',
    'model_load_start',
    'model_load_end',
    'model_error',
    'contact_submit'
]);

const loginAttempts   = new Map();
const contactCooldown = new Map();

function readCreds() {
    return secureStore.readJson(FILE_CREDS, []);
}

function saveCreds(creds) {
    secureStore.writeJson(FILE_CREDS, creds);
}

function genToken() { return crypto.randomBytes(32).toString('hex'); }

async function verifyAdminPassword(password) {
    const configuredHash = ADMIN_PASS_HASH || (BCRYPT_HASH_RE.test(ADMIN_PASS) ? ADMIN_PASS : '');
    if (configuredHash) {
        try {
            return await getBcrypt().compare(password, configuredHash);
        } catch (err) {
            logger.error(`bcrypt compare failed: ${err.message}`);
            return false;
        }
    }
    if (!ADMIN_PASS) return false;
    return password === ADMIN_PASS;
}

function requireAdm(req, res, next) {
    if (!req.session || !req.session.authenticated) {
        return res.status(401).json({ success: false, error: 'Unauthorized.' });
    }
    // Re-hydrate device record if it went missing (e.g. server restart cleared in-memory state).
    // Only hard-block if the device was explicitly revoked via revokeDevice().
    const deviceToken = req.session.deviceToken || deviceManager.getDeviceToken(req);
    if (deviceToken) {
        const device = deviceManager.getDevice(deviceToken);
        if (!device) {
            // Device missing from manager — restore it from session context rather than
            // killing the session. The session itself is proof of prior authentication.
            deviceManager.upsertDevice(deviceToken, {
                ip:         getRealIp(req),
                userAgent:  req.headers['user-agent'],
                secChUa:    req.headers['sec-ch-ua'],
                secChUaFullVersionList: req.headers['sec-ch-ua-full-version-list'],
                authMethod: 'session-restore',
            });
        }
    }
    if (req.session.usingPasskey && req.session.lastPasskeyAuth) {
        const passkeyGracePeriod = 30 * 60 * 1000;
        if (Date.now() - req.session.lastPasskeyAuth < passkeyGracePeriod) {
            return next();
        }
    }
    next();
}

function requireAdmPage(req, res, next) {
    if (!req.session || !req.session.authenticated) {
        return res.redirect(302, '/login');
    }
    // Re-hydrate device record if it went missing (e.g. server restart cleared in-memory state).
    // Only hard-block if the device was explicitly revoked via revokeDevice().
    const deviceToken = req.session.deviceToken || deviceManager.getDeviceToken(req);
    if (deviceToken) {
        const device = deviceManager.getDevice(deviceToken);
        if (!device) {
            // Device missing — restore silently. Session is proof of prior authentication.
            deviceManager.upsertDevice(deviceToken, {
                ip:         getRealIp(req),
                userAgent:  req.headers['user-agent'],
                secChUa:    req.headers['sec-ch-ua'],
                secChUaFullVersionList: req.headers['sec-ch-ua-full-version-list'],
                authMethod: 'session-restore',
            });
        }
    }
    next();
}

const loginLimiter = rateLimit({
    windowMs: RATE_WINDOW_MS,
    max: RATE_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Prea multe incercari. Asteptati un minut.' }
});
// Strict limiter for actual verify endpoints (prevents brute-force)
const webauthnVerifyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Prea multe incercari WebAuthn. Asteptati 15 minute.' }
});
// Lenient limiter for options/challenge endpoints (fetched on every page load)
const webauthnOptionsLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Prea multe cereri. Asteptati un minut.' }
});
const telemetryIngestLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 180,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Prea multe evenimente telemetry. Așteptați puțin.' }
});
const orderLimiter = rateLimit({
    windowMs: ORDER_RATE_WINDOW_MS,
    max: ORDER_RATE_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    skipFailedRequests: true,
    message: { success: false, error: 'Poți trimite o singură comandă la 30 de minute.' }
});

function checkBrute(ip) {
    const now = Date.now();
    const e   = loginAttempts.get(ip) || { count: 0, first: now };
    if (e.blockedUntil && now < e.blockedUntil) {
        return { ok: false, wait: Math.ceil((e.blockedUntil - now) / 1000) };
    }
    if (now - e.first > RATE_WINDOW_MS) {
        loginAttempts.set(ip, { count: 1, first: now });
        return { ok: true };
    }
    e.count++;
    if (e.count >= RATE_MAX) {
        e.blockedUntil = now + RATE_WINDOW_MS;
        loginAttempts.set(ip, e);
        logger.warn(`Brute force blocat: ${ip}`);
        return { ok: false, wait: Math.ceil(RATE_WINDOW_MS / 1000) };
    }
    loginAttempts.set(ip, e);
    return { ok: true };
}

// cooldown la pagina de contact ca sa oprim spamul 
function checkContactCooldown(ip) {
    const now  = Date.now();
    const last = contactCooldown.get(ip) || 0;
    if (now - last < 60 * 1000) return false;
    contactCooldown.set(ip, now);
    return true;
}

setInterval(() => {
    const now = Date.now();
    for (const [ip, e] of loginAttempts) if (e.blockedUntil && now > e.blockedUntil + 60000) loginAttempts.delete(ip);
    for (const [ip, t] of contactCooldown) if (now - t > 10 * 60 * 1000)            contactCooldown.delete(ip);
}, 10 * 60 * 1000);

// folosesc modulul multer pentru a incarca imagini 
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, DIR_UPLOADS),
        filename:    (req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase();
            cb(null, `flower_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`);
        }
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ok = ['.jpg', '.jpeg', '.png', '.avif', '.webp']
            .includes(path.extname(file.originalname).toLowerCase());
        cb(null, ok);
    }
});

const FileStore = require('session-file-store')(session);
const sessionsDir = path.join(DIR_DATA, 'sessions');
if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
}

function fileStoreLog(msg) {
    const text = String(msg || '');
    if (!text) return;
    if (text.includes('ENOENT')) return; // stale session file races are harmless
    if (text.includes('Deleting expired sessions')) return; // noisy periodic cleanup
    logger.warn(`[session-file-store] ${text}`);
}

app.set('trust proxy', 1); // Trust Nginx so secure cookies work
// Helper: get the real client IP even when behind nginx reverse proxy.
// nginx should set: proxy_set_header X-Real-IP $remote_addr;
// Express trust-proxy handles X-Forwarded-For, but X-Real-IP is the safest single-value header.
function getRealIp(req) {
    return req.headers['x-real-ip']
        || (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
        || req.ip;
}

function getRequestOrigin(req) {
    const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'http').toString().split(',')[0].trim();
    const host = (req.headers['x-forwarded-host'] || req.headers.host || '').toString().split(',')[0].trim();
    if (!host) return `http://localhost:${PORT}`;
    return `${proto}://${host}`;
}

function normalizeSiteUrl(rawValue, fallback) {
    const raw = String(rawValue || '').trim().replace(/^['"`]+|['"`]+$/g, '');
    if (!raw) return fallback;
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
        return new URL(withScheme).origin;
    } catch {
        return fallback;
    }
}

function normalizeRpId(rawValue, fallbackOrigin) {
    const raw = String(rawValue || '').trim().replace(/^['"`]+|['"`]+$/g, '');
    if (raw) {
        if (/^https?:\/\//i.test(raw)) {
            try { return new URL(raw).hostname; } catch {}
        }
        return raw.replace(/\/+$/, '');
    }
    try { return new URL(fallbackOrigin).hostname; } catch { return 'localhost'; }
}

function getWebAuthnContext(req) {
    const requestOrigin = getRequestOrigin(req);
    const expectedOrigin = normalizeSiteUrl(process.env.SITE_URL, requestOrigin);
    const rpId = normalizeRpId(process.env.RP_ID, expectedOrigin);
    return { expectedOrigin, rpId };
}
app.use(cookieParser()); // needed to read device_id cookie separately from session

// Explicitly trust proxy headers from Nginx for HTTPS cookies
const normalizedSiteUrl = normalizeSiteUrl(process.env.SITE_URL, `http://localhost:${PORT}`);
const isHttpsSite = normalizedSiteUrl.startsWith('https://');
app.set('trust proxy', 1);

const sessionMiddleware = session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    rolling: false, // do NOT roll — let the per-login maxAge stick
    store: new FileStore({
        path: sessionsDir,
        secret: SESSION_SECRET,
        ttl: 30 * 24 * 60 * 60, // max possible — actual expiry driven by cookie
        retries: 0,
        logFn: fileStoreLog
    }),
    cookie: {
        httpOnly: true,
        secure: isHttpsSite || process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        // No default maxAge — session cookie by default; login sets it per rememberMe choice
    },
    name: 'admin_sid'
});
app.use(sessionMiddleware);
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
        : [`http://localhost:${PORT}`],
    credentials: true
}));
const jsonBodyParser = express.json({ limit: '512kb' });
const urlEncodedBodyParser = express.urlencoded({ extended: true, limit: '512kb' });
app.use((req, res, next) => req.path === '/api/telemetry' ? next() : jsonBodyParser(req, res, next));
app.use((req, res, next) => req.path === '/api/telemetry' ? next() : urlEncodedBodyParser(req, res, next));

const ADMOPS_PUBLIC_PATHS = new Set([
    '/login',
    '/logout',
    '/auth-methods',
    '/check-device-passkey',
    '/webauthn/auth-options',
    '/webauthn/options',
    '/webauthn/verify-authentication',
]);

app.use('/api/admops', (req, res, next) => {
    if (ADMOPS_PUBLIC_PATHS.has(req.path)) return next();
    return requireAdm(req, res, next);
});

app.use(express.static(DIR_PUBLIC, {
    index: false,
    maxAge: 0,
    setHeaders(res, filePath) {
        if (filePath.endsWith('.html') || filePath.endsWith('sw.js') || filePath.endsWith('manifest.json') || /\.(js|css)$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'no-cache');
        } else if (/\.(avif|webp|png|jpe?g|svg|gif|glb|gltf)$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'public, max-age=86400');
        }
    }
}));

app.get('/robots.txt', (req, res) => {
    const siteUrl = normalizeSiteUrl(process.env.SITE_URL, getRequestOrigin(req));
    res.type('text/plain');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send([
        'User-agent: *',
        'Allow: /',
        'Disallow: /admops',
        'Disallow: /admin',
        'Disallow: /login',
        'Disallow: /api/',
        'Disallow: /private/',
        'Disallow: /checkout',
        '',
        `Sitemap: ${siteUrl}/sitemap.xml`,
        ''
    ].join('\n'));
});

app.get('/sitemap.xml', (req, res) => {
    const siteUrl = normalizeSiteUrl(process.env.SITE_URL, getRequestOrigin(req));
    const now = new Date().toISOString();
    const urls = [
        { loc: `${siteUrl}/`, priority: '1.0', changefreq: 'daily' },
        { loc: `${siteUrl}/contact.html`, priority: '0.6', changefreq: 'monthly' },
        ...readProducts()
            .filter(p => p && p.listed !== false && Number.isFinite(Number(p.id)))
            .map(p => ({
                loc: `${siteUrl}/product/${encodeURIComponent(String(Number(p.id)))}`,
                priority: '0.8',
                changefreq: 'weekly'
            }))
    ];
    const body = `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        urls.map(u => `  <url><loc>${escXml(u.loc)}</loc><lastmod>${now}</lastmod><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`).join('\n') +
        `\n</urlset>\n`;
    res.type('application/xml');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(body);
});


// niste rute pentru serving, dar nu avem nevoie de astea daca suntem pe nginx
// sunt aici pentru developement
app.get('/', (req, res) => {
    const id = Number(req.query.product);
    const lang = pickShareLang(String(req.query.lang || '').toLowerCase());
    if (Number.isFinite(id) && id > 0) {
        const products = readProducts();
        const product = products.find(x => x.id === id && x.listed !== false);
        if (product) {
            res.setHeader('Cache-Control', 'no-cache');
            return res.send(renderProductShareHtml(req, product, lang));
        }
    }
    return res.sendFile(path.join(DIR_PUBLIC, 'index.html'));
});
app.get('/checkout', (req, res) => res.sendFile(path.join(DIR_PUBLIC, 'checkout.html')));
app.get('/contact',  (req, res) => res.sendFile(path.join(DIR_PUBLIC, 'contact.html')));
app.get('/product/:id', (req, res) => {
    const id = Number(req.params.id);
    const lang = pickShareLang(String(req.query.lang || '').toLowerCase());
    const products = readProducts();
    const product = products.find(x => x.id === id && x.listed !== false);
    if (!product) return res.status(404).sendFile(path.join(DIR_PUBLIC, '404.html'));
    res.setHeader('Cache-Control', 'no-cache');
    res.send(renderProductShareHtml(req, product, lang));
});
app.get('/login', (req, res) => {
    if (req.session?.authenticated) return res.redirect(302, '/admops');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(path.join(DIR_PUBLIC, 'login.html'));
});

app.get('/admops', requireAdmPage, (req, res) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(path.join(DIR_PRIVATE, 'admin.html'));
});

app.get('/admin', (req, res) => res.redirect(302, '/admops'));

app.get('/private/admin.html', requireAdmPage, (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(302, '/admops');
});

app.use('/private', requireAdmPage, express.static(DIR_PRIVATE, {
    maxAge: 0,
    etag: true,
    lastModified: true,
    setHeaders(res) {
        res.setHeader('Cache-Control', 'private, no-store');
    }
}));


// api custom 
app.get('/api/assets/lease', (req, res) => {
    try {
        const clientFingerprint = String(req.query.fingerprint || '').trim();
        const state = getStorefrontAssetState();
        const match = Boolean(clientFingerprint && clientFingerprint === state.fingerprint);
        res.setHeader('Cache-Control', 'no-store');
        res.json({
            success: true,
            match,
            fingerprint: state.fingerprint,
            productCount: state.productCount,
            leaseMs: ASSET_LEASE_MS,
            expiresAt: Date.now() + ASSET_LEASE_MS,
            generatedAt: state.generatedAt
        });
    } catch (e) {
        logger.error(`asset lease: ${e.message}`);
        res.status(500).json({ success: false, error: 'Nu am putut verifica versiunea.' });
    }
});

app.get('/api/products', (req, res) => {
    try {
        const products = readProducts().filter(p => p.listed !== false);
        const state = getStorefrontAssetState();
        res.setHeader('Cache-Control', 'no-store');
        res.json({
            success: true,
            products,
            fingerprint: state.fingerprint,
            leaseMs: ASSET_LEASE_MS,
            generatedAt: state.generatedAt
        });
    } catch (e) {
        logger.error(`readProducts: ${e.message}`);
        res.json({ success: true, products: [] });
    }
});

app.get('/api/telemetry-settings', (req, res) => {
    const settings = readTelemetrySettings();
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, settings });
});

app.post('/api/telemetry', telemetryIngestLimiter, express.text({ type: '*/*', limit: '256kb' }), (req, res) => {
    try {
        const settings = readTelemetrySettings();
        if (settings.enabled === false) return res.json({ success: true, accepted: 0 });

        let payload = [];
        if (typeof req.body === 'string' && req.body.trim()) {
            payload = JSON.parse(req.body);
        } else if (Array.isArray(req.body)) {
            payload = req.body;
        } else {
            return res.json({ success: true, accepted: 0 });
        }
        if (!Array.isArray(payload) || payload.length === 0) return res.json({ success: true, accepted: 0 });

        const ua       = req.headers['user-agent'] || '';
        const parsedUa = parseUserAgent(ua);
        const country  = getCountryFromReq(req);
        const ip       = getRealIp(req);
        const now      = Date.now();
        const validProductIds = new Set(
            readProducts()
                .map(p => normalizeTelemetryProductId(p && p.id))
                .filter(Boolean)
        );

        const normalized = payload
            .slice(0, 200)
            .map(e => sanitizeTelemetryEventRecord(e, {
                now,
                serverTs: now,
                country,
                ip,
                ua,
                parsedUa,
                validProductIds
            }))
            .filter(Boolean);

        const accepted = appendTelemetryEvents(normalized);
        if (accepted > 0) {
            emitAdmin('telemetry_ingest', {
                accepted,
                serverTs: now
            });
        }
        res.json({ success: true, accepted });
    } catch (e) {
        logger.error(`telemetry ingest: ${e.message}`);
        res.status(400).json({ success: false, error: 'Telemetry payload invalid.' });
    }
});

// api pentru admin fiecare endpoint este verificat.
app.post('/api/admops/login', loginLimiter, async (req, res) => {
    const ip       = getRealIp(req);
    const brute    = checkBrute(ip);
    if (!brute.ok) {
        logger.warn(`Login blocat (brute): ${ip}`);
        return res.status(429).json({ success: false, error: `Prea multe încercări. Așteptați ${brute.wait}s.` });
    }
    const username   = sanitize(req.body.username, 80);
    const password   = String(req.body.password ?? '').slice(0, 200);
    const rememberMe = req.body.rememberMe === true;
    const passOk = username === ADMIN_USER ? await verifyAdminPassword(password) : false;
    if (!username || !password || username !== ADMIN_USER || !passOk) {
        logger.warn(`Login esuat: ${ip} — user: ${username}`);
        activityLog.logActivity('password', 'login_failed', { ip });
        return res.status(401).json({ success: false, error: 'Credentiale gresite.' });
    }

    // Upsert device record — creates one on first login, updates lastSeen on subsequent ones
    const existingToken = deviceManager.getDeviceToken(req);
    const device = deviceManager.upsertDevice(existingToken, {
        ip:         ip,
        userAgent:  req.headers['user-agent'],
        secChUa:    req.headers['sec-ch-ua'],
        secChUaFullVersionList: req.headers['sec-ch-ua-full-version-list'],
        authMethod: 'password',
    });

    // Regenerate session ID to prevent session fixation attacks
    req.session.regenerate((err) => {
        if (err) {
            logger.error(`Session regeneration failed: ${err.message}`);
            return res.status(500).json({ success: false, error: 'Eroare server.' });
        }

        req.session.authenticated = true;
        req.session.loginTime     = Date.now();
        req.session.credId        = 'password';
        req.session.deviceToken   = device.token;
        if (rememberMe) {
            req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
        } else {
            req.session.cookie.maxAge = undefined; // session cookie — expires when browser closes
            req.session.cookie.expires = false;
        }

        deviceManager.setDeviceCookie(res, device.token, isHttpsSite || process.env.NODE_ENV === 'production');

        activityLog.logActivity(device.token, 'login', { ip, deviceName: device.name });
        logger.info(`Admin logat: ${ip}${rememberMe ? ' (remember me)' : ''} device=${device.token.slice(0,8)}`);

        emitAdmin('devices_update', deviceManager.getAllDevices());

        req.session.save((saveErr) => {
            if (saveErr) {
                logger.error(`Session save failed (password login): ${saveErr.message}`);
                return res.status(500).json({ success: false, error: 'Eroare server.' });
            }
            res.json({ success: true });
        });
    });
});

app.post('/api/admops/logout', (req, res) => {
    req.session.destroy(() => {});
    res.json({ success: true });
});

// Auth challenge endpoint called by login page (conditional autofill) and passkey button
app.get('/api/admops/webauthn/auth-options', webauthnOptionsLimiter, async (req, res) => {
    try {
        const creds = readCreds();
        if (creds.length === 0) return res.status(400).json({ success: false, error: 'Niciun passkey inregistrat.' });
        const challengeBytes = crypto.randomBytes(32);
        req.session.webauthnChallenge = challengeBytes.toString('base64url');
        const { rpId } = getWebAuthnContext(req);
        const opts = await generateAuthenticationOptions({
            rpId,
            timeout: 120000,
            // WebAuthn helper expects base64url challenge as string, not raw bytes.
            challenge: req.session.webauthnChallenge,
            allowCredentials: creds.map(c => ({
                id: c.credentialID,
                type: 'public-key',
                transports: c.transports || ['internal']
            })),
            userVerification: 'preferred'
        });
        const payload = {
            challenge: req.session.webauthnChallenge,
            rpId: opts.rpId,
            timeout: opts.timeout,
            allowCredentials: opts.allowCredentials.map(c => ({
                ...c,
                id: typeof c.id === 'string' ? c.id : Buffer.from(c.id).toString('base64url')
            })),
            userVerification: opts.userVerification
        };
        // Explicitly flush session to disk before responding — the file-based session store
        // may not persist in time for the verify request that immediately follows.
        req.session.save((saveErr) => {
            if (saveErr) {
                logger.error(`Session save failed (auth-opts): ${saveErr.message}`);
                return res.status(500).json({ success: false, error: 'Eroare server.' });
            }
            res.json(payload);
        });
    } catch (e) { logger.error(`WebAuthn auth-opts: ${e.message}`); res.status(500).json({ success: false, error: e.message }); }
});

// Register challenge endpoint — only called when adding a new passkey
app.get('/api/admops/webauthn/register-options', webauthnOptionsLimiter, requireAdm, async (req, res) => {
    try {
        const creds = readCreds();
        const { expectedOrigin, rpId } = getWebAuthnContext(req);
        // Accept ?uv=discouraged as a fallback from clients that failed with 'preferred'
        // (e.g. Android devices where the Credential Manager throws NotReadableError when
        // biometrics are not enrolled, instead of gracefully falling back).
        const allowedUV = ['required', 'preferred', 'discouraged'];
        const userVerification = allowedUV.includes(req.query.uv) ? req.query.uv : 'preferred';
        // Accept ?clearExclude=1 to send an empty excludeCredentials list.
        // Fixes a Chrome/Android Credential Manager bug where the presence of a matching
        // credential ID in excludeCredentials causes NotReadableError instead of InvalidStateError.
        const clearExclude = req.query.clearExclude === '1';
        logger.info(`WebAuthn reg-opts: origin=${getRequestOrigin(req)}, rpId=${rpId}, uv=${userVerification}, clearExclude=${clearExclude}`);
        // Keep a base64url string in session for client JSON, but pass raw bytes to SimpleWebAuthn.
        const webauthnUserIdB64 = crypto.randomBytes(16).toString('base64url');
        const userId = Buffer.from(webauthnUserIdB64, 'base64url');
        req.session.webauthnChallenge = crypto.randomBytes(32).toString('base64url');
        req.session.webauthnUserId = webauthnUserIdB64;
        const opts = await generateRegistrationOptions({
            rpName: 'Luci Boutique Admin',
            rpId,
            userName: ADMIN_USER,
            userDisplayName: 'Administrator',
            userID: userId,
            challenge: req.session.webauthnChallenge,
            timeout: 120000,
            attestationType: 'none',
            authenticatorSelection: {
                residentKey: 'preferred',
                userVerification,
            },
            supportedAlgorithmIDs: [-7, -257],
            excludeCredentials: clearExclude ? [] : creds.map(c => ({
                id: c.credentialID,
                type: 'public-key',
                transports: c.transports || ['internal']
            }))
        });
        const payload = {
            challenge: req.session.webauthnChallenge,
            rp: opts.rp,
            user: { ...opts.user, id: req.session.webauthnUserId },
            pubKeyCredParams: opts.pubKeyCredParams,
            timeout: opts.timeout,
            excludeCredentials: (opts.excludeCredentials || []).map(c => ({
                ...c,
                id: typeof c.id === 'string' ? c.id : Buffer.from(c.id).toString('base64url')
            })),
            attestation: opts.attestation,
            authenticatorSelection: opts.authenticatorSelection
        };
        logger.info(`WebAuthn reg-opts: rp.id=${opts.rp.id}, alg count=${opts.pubKeyCredParams?.length}`);
        // Explicitly flush session to disk before responding — the file-based store may not
        // persist quickly enough for the verify-registration request that immediately follows.
        req.session.save((saveErr) => {
            if (saveErr) {
                logger.error(`Session save failed (reg-opts): ${saveErr.message}`);
                return res.status(500).json({ success: false, error: 'Eroare server.' });
            }
            res.json(payload);
        });
    } catch (e) { logger.error(`WebAuthn reg-opts: ${e.message}`); res.status(500).json({ success: false, error: e.message }); }
});

// Keep legacy /options endpoint redirecting to auth-options for backwards compat
app.get('/api/admops/webauthn/options', webauthnOptionsLimiter, async (req, res) => {
    const creds = readCreds();
    if (creds.length === 0 || req.query.register === 'true') {
        // Redirect internal — just proxy to register-options logic inline
        if (!req.session.authenticated) return res.status(401).json({ success: false, error: 'Unauthorized.' });
    }
    res.redirect(307, creds.length === 0 || req.query.register === 'true'
        ? '/api/admops/webauthn/register-options'
        : '/api/admops/webauthn/auth-options');
});

app.post('/api/admops/webauthn/verify-registration', webauthnVerifyLimiter, async (req, res) => {
    try {
        const body = req.body;
        if (!body || !body.credential) {
            return res.status(400).json({ success: false, error: 'Credential invalid.' });
        }
        const { expectedOrigin, rpId } = getWebAuthnContext(req);
        const expectedChallenge = req.session.webauthnChallenge;
        if (!expectedChallenge) return res.status(400).json({ success: false, error: 'Sesiune expirata. Reincearca.' });
        delete req.session.webauthnChallenge;
        const verification = await verifyRegistrationResponse({
            response: body.credential,
            expectedChallenge,
            expectedOrigin,
            expectedRPID: rpId
        });
        if (!verification.verified) return res.status(400).json({ success: false, error: 'Verificare esuata.' });
        // v9+: credential info lives in registrationInfo.credential (not top-level)
        const { credential: regCred } = verification.registrationInfo;
        const creds = readCreds();
        // regCred.id is already a base64url string in v9 — no Buffer wrapping needed
        if (creds.some(c => c.credentialID === regCred.id)) {
            return res.status(400).json({ success: false, error: 'Passkey deja inregistrat.' });
        }
        creds.push({
            credentialID: regCred.id,
            publicKey:    Buffer.from(regCred.publicKey).toString('base64url'),
            counter:      regCred.counter,
            transports:   body.credential.transports || [],
            deviceName:   req.body.deviceName || 'Dispozitiv necunoscut',
            createdAt:    new Date().toISOString()
        });
        saveCreds(creds);

        // Link the new passkey to the current device record
        const deviceToken = req.session.deviceToken || deviceManager.getDeviceToken(req);
        if (deviceToken) {
            deviceManager.linkPasskey(deviceToken, regCred.id);
        }

        req.session.authenticated   = true;
        req.session.loginTime       = Date.now();
        req.session.usingPasskey    = true;
        req.session.lastPasskeyAuth = Date.now(); // was missing — grace period check in requireAdm needs this
        req.session.cookie.maxAge   = 30 * 24 * 60 * 60 * 1000;
        logger.info(`Passkey inregistrata de la: ${getRealIp(req)}`);
        emitAdmin('devices_update', deviceManager.getAllDevices());
        req.session.save((saveErr) => {
            if (saveErr) {
                logger.error(`Session save failed (register passkey): ${saveErr.message}`);
                return res.status(500).json({ success: false, error: 'Eroare server.' });
            }
            res.json({ success: true });
        });
    } catch (e) { logger.error(`WebAuthn reg: ${e.message}`); res.status(400).json({ success: false, error: e.message }); }
});

app.post('/api/admops/webauthn/verify-authentication', webauthnVerifyLimiter, async (req, res) => {
    try {
        const body = req.body;
        if (!body || !body.credential) {
            return res.status(400).json({ success: false, error: 'Credential invalid.' });
        }
        const creds = readCreds();
        const credIdBase64 = body.credential.id || body.credential.rawId;
        const cred = creds.find(c => c.credentialID === credIdBase64);
        if (!cred) return res.status(400).json({ success: false, error: 'Credential necunoscut. Inregistreaza mai intai un passkey folosind parola.' });
        const { expectedOrigin, rpId } = getWebAuthnContext(req);
        const expectedChallenge = req.session.webauthnChallenge;
        if (!expectedChallenge) return res.status(400).json({ success: false, error: 'Sesiune expirata. Reincearca.' });
        delete req.session.webauthnChallenge;
        const verification = await verifyAuthenticationResponse({
            response: body.credential,
            expectedChallenge,
            expectedOrigin,
            expectedRPID: rpId,
            // v9+: 'authenticator' renamed to 'credential'; fields renamed too
            credential: {
                id:         cred.credentialID,
                publicKey:  new Uint8Array(Buffer.from(cred.publicKey, 'base64url')),
                counter:    cred.counter,
                transports: cred.transports
            }
        });
        if (!verification.verified) return res.status(400).json({ success: false, error: 'Autentificare esuata.' });
        cred.counter  = verification.authenticationInfo.newCounter;
        cred.lastUsed = new Date().toISOString();
        saveCreds(creds);

        // Look up the canonical device for this passkey credential first.
        // This prevents a second browser (no device_id cookie) from creating a duplicate
        // device record when the same passkey is used across browsers on the same hardware.
        const ip = getRealIp(req);
        const passkeyDevice = deviceManager.getAllDevices().find(d => d.passkeyCredId === cred.credentialID);
        const existingToken = passkeyDevice?.token || deviceManager.getDeviceToken(req);
        const device = deviceManager.upsertDevice(existingToken, {
            ip,
            userAgent:     req.headers['user-agent'],
            secChUa:       req.headers['sec-ch-ua'],
            secChUaFullVersionList: req.headers['sec-ch-ua-full-version-list'],
            authMethod:    'passkey',
            passkeyCredId: cred.credentialID,
        });

        // Regenerate session ID to prevent session fixation attacks
        req.session.regenerate((err) => {
            if (err) {
                logger.error(`Session regeneration failed: ${err.message}`);
                return res.status(500).json({ success: false, error: 'Eroare server.' });
            }

            req.session.authenticated    = true;
            req.session.loginTime        = Date.now();
            req.session.usingPasskey     = true;
            req.session.lastPasskeyAuth  = Date.now();
            req.session.credId           = cred.credentialID;
            req.session.deviceToken      = device.token;
            req.session.cookie.maxAge    = 30 * 24 * 60 * 60 * 1000;

            deviceManager.setDeviceCookie(res, device.token, isHttpsSite || process.env.NODE_ENV === 'production');

            activityLog.logActivity(device.token, 'login', { ip, deviceName: device.name });
            logger.info(`Passkey login reusit: ${ip} device=${device.token.slice(0,8)}`);

            emitAdmin('devices_update', deviceManager.getAllDevices());

            req.session.save((saveErr) => {
                if (saveErr) {
                    logger.error(`Session save failed (passkey login): ${saveErr.message}`);
                    return res.status(500).json({ success: false, error: 'Eroare server.' });
                }
                res.json({ success: true });
            });
        });
    } catch (e) { logger.error(`WebAuthn auth: ${e.message}`); res.status(400).json({ success: false, error: e.message }); }
});

app.get('/api/admops/auth-methods', (req, res) => {
    const creds = readCreds();
    res.json({
        success: true,
        methods: ['password', ...(creds.length > 0 ? ['passkey'] : [])]
    });
});

app.get('/api/admops/passkeys', requireAdm, (req, res) => {
    const creds         = readCreds();
    const devices       = deviceManager.getAllDevices();
    const currentToken  = req.session.deviceToken || deviceManager.getDeviceToken(req);

    // Build a map of passkey credentialID → cred data for quick lookup
    const credMap = {};
    for (const c of creds) credMap[c.credentialID] = c;

    const result = devices.map(d => {
        const linkedCred = d.passkeyCredId ? credMap[d.passkeyCredId] : null;
        return {
            credentialID:     d.token,          // admin.js uses this as the modal key
            deviceToken:      d.token,
            deviceName:       d.name,
            createdAt:        d.createdAt,
            lastSeen:         d.lastSeen,
            lastIp:           d.lastIp,
            authMethods:      d.authMethods,
            passkeyCredId:    d.passkeyCredId || null,
            passkeyLastUsed:  linkedCred?.lastUsed || null,
            type:             d.authMethods.includes('passkey') ? 'passkey' : 'password',
            isCurrentDevice:  d.token === currentToken,
        };
    });

    res.json({ success: true, passkeys: result });
});

app.delete('/api/admops/passkeys/:credId', requireAdm, (req, res) => {
    const creds = readCreds();
    const idx   = creds.findIndex(c => c.credentialID === req.params.credId);
    if (idx === -1) return res.status(404).json({ success: false, error: 'Passkey negasit.' });
    const removedCred = creds[idx];
    creds.splice(idx, 1);
    saveCreds(creds);
    deviceManager.unlinkPasskeyByCred(req.params.credId); // detach from device record
    activityLog.logActivity(req.session.deviceToken || req.params.credId, 'passkey_deleted', { deviceName: removedCred.deviceName });
    logger.info(`Passkey sters de ${getRealIp(req)}`);
    res.json({ success: true });
});


// Rename device — accepts either a deviceToken or a legacy passkey credentialID
app.patch('/api/admops/passkeys/:credId/rename', requireAdm, (req, res) => {
    const newName = sanitize(req.body.deviceName, 80);
    if (!newName) return res.status(400).json({ success: false, error: 'Nume invalid.' });
    const id = req.params.credId;

    // Try as device token first
    if (deviceManager.renameDevice(id, newName)) {
        activityLog.logActivity(req.session.deviceToken, 'passkey_renamed', { newName });
        logger.info(`Device redenumit: ${newName} de la ${getRealIp(req)}`);
        return res.json({ success: true });
    }

    // Fallback: treat as WebAuthn credentialID (legacy path)
    const creds = readCreds();
    const cred  = creds.find(c => c.credentialID === id);
    if (!cred) return res.status(404).json({ success: false, error: 'Dispozitiv negasit.' });
    const oldName = cred.deviceName;
    cred.deviceName = newName;
    saveCreds(creds);
    activityLog.logActivity(req.session.deviceToken, 'passkey_renamed', { oldName, newName });
    logger.info(`Passkey redenumit: ${oldName} -> ${newName} de la ${getRealIp(req)}`);
    res.json({ success: true });
});

// ─── Device management endpoints ─────────────────────────────────────────────

/** Info about the device currently making the request. */
app.get('/api/admops/my-device', requireAdm, (req, res) => {
    const token  = req.session.deviceToken || deviceManager.getDeviceToken(req);
    const device = deviceManager.getDevice(token);
    if (!device) return res.json({ success: true, device: null });
    res.json({ success: true, device: {
        token:         device.token,
        name:          device.name,
        authMethods:   device.authMethods,
        passkeyCredId: device.passkeyCredId || null,
        lastSeen:      device.lastSeen,
        createdAt:     device.createdAt,
    }});
});

/** Rename a device by its token. */
app.patch('/api/admops/devices/:token/rename', requireAdm, (req, res) => {
    const newName = sanitize(req.body.name, 80);
    if (!newName) return res.status(400).json({ success: false, error: 'Nume invalid.' });
    const ok = deviceManager.renameDevice(req.params.token, newName);
    if (!ok) return res.status(404).json({ success: false, error: 'Dispozitiv negasit.' });
    activityLog.logActivity(req.session.deviceToken, 'passkey_renamed', { newName });
    logger.info(`Device ${req.params.token.slice(0,8)} redenumit: ${newName}`);
    res.json({ success: true });
});

/**
 * Remove only the passkey from a device.
 * Device record stays — device can still log in with password.
 */
app.delete('/api/admops/devices/:token/passkey', requireAdm, (req, res) => {
    const device = deviceManager.getDevice(req.params.token);
    if (!device)              return res.status(404).json({ success: false, error: 'Dispozitiv negasit.' });
    if (!device.passkeyCredId) return res.status(400).json({ success: false, error: 'Dispozitivul nu are passkey.' });
    const creds = readCreds();
    const idx   = creds.findIndex(c => c.credentialID === device.passkeyCredId);
    if (idx !== -1) { creds.splice(idx, 1); saveCreds(creds); }
    deviceManager.unlinkPasskeyByCred(device.passkeyCredId);
    activityLog.logActivity(req.session.deviceToken, 'passkey_deleted', { deviceName: device.name });
    logger.info(`Passkey sters de pe device ${req.params.token.slice(0,8)} de la ${getRealIp(req)}`);
    emitAdmin('devices_update', deviceManager.getAllDevices());
    res.json({ success: true });
});

/**
 * Revoke an entire device — removes its record AND its linked passkey.
 * You cannot revoke your own current device.
 */
app.delete('/api/admops/devices/:token', requireAdm, (req, res) => {
    const currentToken = req.session.deviceToken || deviceManager.getDeviceToken(req);
    if (req.params.token === currentToken) {
        return res.status(400).json({ success: false, error: 'Nu poți revoca dispozitivul curent.' });
    }
    const removed = deviceManager.revokeDevice(req.params.token);
    if (!removed) return res.status(404).json({ success: false, error: 'Dispozitiv negasit.' });
    if (removed.passkeyCredId) {
        const creds = readCreds();
        const idx   = creds.findIndex(c => c.credentialID === removed.passkeyCredId);
        if (idx !== -1) { creds.splice(idx, 1); saveCreds(creds); }
    }
    activityLog.clearActivity(removed.token);
    logger.info(`Device ${req.params.token.slice(0,8)} revocat de la ${getRealIp(req)}`);

    // Instantly kick the revoked device — any socket in its room gets force-logged out.
    io.to(`device:${req.params.token}`).emit('force_logout');

    // Destroy all server sessions that belong to this device token.
    // Not all stores implement `.all()`, so support `.list()` + `.get()` too.
    const revokedToken = req.params.token;
    const sessionStore = req.sessionStore;
    try {
        if (sessionStore && typeof sessionStore.all === 'function') {
            sessionStore.all((err, sessions) => {
                if (err || !sessions) return;
                for (const [sessId, sessData] of Object.entries(sessions)) {
                    if (sessData && sessData.deviceToken === revokedToken) {
                        sessionStore.destroy(sessId, () => {});
                    }
                }
            });
        } else if (sessionStore && typeof sessionStore.list === 'function' && typeof sessionStore.get === 'function') {
            sessionStore.list((listErr, files) => {
                if (listErr || !Array.isArray(files)) return;
                for (const file of files) {
                    const sessId = String(file).replace(/\.json$/i, '');
                    sessionStore.get(sessId, (getErr, sessData) => {
                        if (getErr || !sessData) return;
                        if (sessData.deviceToken === revokedToken) {
                            sessionStore.destroy(sessId, () => {});
                        }
                    });
                }
            });
        } else {
            logger.warn(`Session cleanup skipped for revoked device ${revokedToken.slice(0, 8)} (store lacks all/list APIs).`);
        }
    } catch (cleanupErr) {
        logger.warn(`Session cleanup failed for revoked device ${revokedToken.slice(0, 8)}: ${cleanupErr.message}`);
    }

    emitAdmin('devices_update', deviceManager.getAllDevices());
    res.json({ success: true });
});

app.get('/api/admops/activity', requireAdm, (req, res) => {
    const credId = req.query.credId;
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    if (credId) {
        res.json({ success: true, activity: activityLog.getActivity(credId, limit) });
    } else {
        res.json({ success: true, activity: activityLog.getAllActivity(limit) });
    }
});

app.get('/api/admops/telemetry/settings', requireAdm, (req, res) => {
    res.json({ success: true, settings: readTelemetrySettings() });
});

app.put('/api/admops/telemetry/settings', requireAdm, (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const updates = {};
    for (const k of Object.keys(DEFAULT_TELEMETRY_SETTINGS)) {
        if (typeof body[k] === 'boolean') updates[k] = body[k];
    }
    const settings = saveTelemetrySettings({ ...readTelemetrySettings(), ...updates });
    emitAdmin('telemetry_settings_update', { settings, updatedAt: new Date().toISOString() });
    res.json({ success: true, settings });
});

app.get('/api/admops/telemetry/overview', requireAdm, (req, res) => {
    try {
        const events = readTelemetryEvents();
        const today = telemetryDayKey(Date.now());
        const eventsToday = events.filter(e =>
            telemetryDayKey(e.serverTs || e.ts || Date.now()) === today
            && e.event === 'page_view'
        ).length;
        const eventsTodayStorefront = events.filter(e =>
            telemetryDayKey(e.serverTs || e.ts || Date.now()) === today
            && e.event === 'page_view'
            && !isAdminTelemetryPath((e.data && e.data.url) || '')
        ).length;
        const lastSyncAt = events.length
            ? new Date(events[events.length - 1].serverTs || events[events.length - 1].ts || Date.now()).toISOString()
            : null;
        const daily = telemetryProcessor.getDailySummary();
        const todayVisits = daily.length ? (daily[daily.length - 1].visits || 0) : 0;
        const byEvent = {};
        const topPagesMap = {};
        const topRefMap = {};
        const sessions = new Set();
        const sessions24h = new Set();
        const now = Date.now();
        const since24h = now - (24 * 60 * 60 * 1000);

        let pageViews = 0;
        let storefrontViews = 0;
        let adminViews = 0;
        let productViews = 0;
        let cartAdds = 0;
        let jsErrors = 0;
        let timeOnPageTotal = 0;
        let timeOnPageSamples = 0;

        for (const e of events) {
            const eventName = String(e.event || 'unknown');
            byEvent[eventName] = (byEvent[eventName] || 0) + 1;

            const sid = String(e.sessionId || '');
            if (sid) {
                sessions.add(sid);
                const evTs = Number(e.serverTs || e.ts || 0);
                if (evTs >= since24h) sessions24h.add(sid);
            }

            if (eventName === 'page_view') {
                pageViews++;
                const pathLabel = telemetryPathOnly(e.data && e.data.url);
                topPagesMap[pathLabel] = (topPagesMap[pathLabel] || 0) + 1;
                if (isAdminTelemetryPath(pathLabel)) adminViews++;
                else storefrontViews++;
                const rawRef = decodeTelemetryText(e.data && e.data.referrer).trim();
                if (rawRef) {
                    let refLabel = rawRef;
                    try {
                        const u = new URL(rawRef);
                        refLabel = `${u.hostname}${u.pathname}`;
                    } catch (_) {}
                    topRefMap[refLabel] = (topRefMap[refLabel] || 0) + 1;
                }
            }
            if (eventName === 'product_view') productViews++;
            if (eventName === 'js_error') jsErrors++;
            if (eventName === 'time_on_page') {
                const ms = safeTelemetryNumber(e.data && e.data.ms);
                if (ms != null) {
                    timeOnPageTotal += ms;
                    timeOnPageSamples++;
                }
            }
        }
        cartAdds = computeTelemetryCartAdds(events);

        const checkout = telemetryProcessor.getCheckoutFunnel();
        const checkoutConversionRate = checkout.attempts > 0
            ? Math.round((checkout.successes / checkout.attempts) * 1000) / 10
            : null;
        const addToCartRate = productViews > 0
            ? Math.round((cartAdds / productViews) * 1000) / 10
            : null;
        const errorRate = pageViews > 0
            ? Math.round((jsErrors / pageViews) * 1000) / 10
            : null;
        const avgTimeOnPageMs = timeOnPageSamples > 0
            ? Math.round(timeOnPageTotal / timeOnPageSamples)
            : null;

        res.json({
            success: true,
            settings: readTelemetrySettings(),
            overview: {
                eventsToday,
                eventsTodayStorefront,
                todayVisits,
                totalVisits: pageViews,
                totalEvents: events.length,
                lastSyncAt
            },
            dailySummary: daily,
            topProducts: telemetryProcessor.getTopProducts(),
            deviceBreakdown: telemetryProcessor.getDeviceBreakdown(),
            countryBreakdown: telemetryProcessor.getCountryBreakdown(),
            checkoutFunnel: checkout,
            errorLog: telemetryProcessor.getErrorLog(20),
            modelPerformance: (() => {
                const base = telemetryProcessor.get3DPerformance();
                const fpsMap = {};
                for (const e of events) {
                    if (e.event !== 'model_fps') continue;
                    const dt  = String(e.data?.deviceType || 'desktop');
                    const fps = Number(e.data?.avgFps) || 0;
                    const n   = Number(e.data?.samples) || 1;
                    if (!fps) continue;
                    if (!fpsMap[dt]) fpsMap[dt] = { sum: 0, totalSamples: 0, count: 0 };
                    fpsMap[dt].sum          += fps * n;
                    fpsMap[dt].totalSamples += n;
                    fpsMap[dt].count++;
                }
                base.fpsByDevice = Object.entries(fpsMap).map(([deviceType, v]) => ({
                    deviceType,
                    avgFps:  Math.round((v.sum / v.totalSamples) * 10) / 10,
                    samples: v.totalSamples
                }));
                return base;
            })(),
            webVitals: telemetryProcessor.getWebVitals(),
            insights: {
                sessions: sessions.size,
                activeSessions24h: sessions24h.size,
                pageViews,
                storefrontViews,
                adminViews,
                productViews,
                cartAdds,
                jsErrors,
                avgTimeOnPageMs,
                checkoutConversionRate,
                addToCartRate,
                errorRate,
                topPages: toTopList(topPagesMap, 12),
                topReferrers: toTopList(topRefMap, 8),
                eventMix: toTopList(byEvent, 12)
            }
        });
    } catch (e) {
        logger.error(`telemetry overview: ${e.message}`);
        res.status(500).json({ success: false, error: 'Nu am putut încărca telemetry.' });
    }
});

app.get('/api/admops/check-device-passkey', (req, res) => {
    const token  = deviceManager.getDeviceToken(req);
    const device = token ? deviceManager.getDevice(token) : null;
    const creds  = readCreds();
    res.json({
        success:       true,
        hasPasskey:    creds.length > 0,
        credentialIDs: creds.map(c => c.credentialID),
        // tells the client whether THIS specific device already has a passkey linked
        thisDeviceHasPasskey: !!(device && device.passkeyCredId),
    });
});

// GET /api/admops/orders — canonical route with error handling is defined below

app.get('/api/admops/logs', requireAdm, (req, res) => {
    const lines = fs.readFileSync(FILE_LOGS, 'utf-8')
        .trim().split('\n').filter(Boolean).slice(-200).reverse();
    res.json({ success: true, logs: lines });
});

app.get('/api/admops/products', requireAdm, (req, res) => {
    try {
        res.json({ success: true, products: readProducts() });
    } catch (e) {
        logger.error(`readProducts admin: ${e.message}`);
        res.status(500).json({ success: false, error: 'Nu am putut citi produsele.' });
    }
});

app.post('/api/admops/upload', requireAdm, upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, error: 'Fisier invalid.' });
    invalidateAssetFingerprint();
    logger.info(`Imagine incarcata: ${req.file.filename}`);
    res.json({ success: true, path: '/uploads/' + req.file.filename });
});

app.post('/api/admops/products', requireAdm, (req, res) => {
    const raw = sanitizeNoSQL(req.body);
    const name  = sanitize(raw.name, 120);
    const price = Math.max(0, parseFloat(Number(raw.price).toFixed(2)));
    if (!name || !price || price <= 0) {
        return res.status(400).json({ success: false, error: 'Nume si pret sunt obligatorii.' });
    }
    try {
        const products = readProducts();
        const p = {
            id:       Date.now(),
            name,
            category: sanitize(raw.category, 50) || 'General',
            price,
            image:    sanitize(raw.image, 500) || '',
            family:   sanitize(raw.family, 120) || '',
            desc:     sanitize(raw.desc, 1000) || '',
            care:     sanitize(raw.care, 500) || '',
            note:     sanitize(raw.note, 300) || '',
            model3d:  null,
            listed:   true,
        };
        products.push(p);
        writeProducts(products);
        logger.info(`Produs adaugat: ${name} (id=${p.id})`);
        activityLog.logActivity(req.session.deviceToken || req.session.credId, 'product_create', { productId: p.id, productName: name, price });
        res.json({ success: true, product: p });
    } catch (e) {
        logger.error(`Adaugare produs: ${e.message}`);
        res.status(500).json({ success: false, error: 'Nu am putut salva produsul.' });
    }
});

app.patch('/api/admops/products/:id', requireAdm, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: 'ID invalid.' });
    const raw = sanitizeNoSQL(req.body);
    try {
        const products = readProducts();
        const idx = products.findIndex(p => p.id === id);
        if (idx === -1) return res.status(404).json({ success: false, error: 'Produs negasit.' });
        const p = products[idx];
        if (raw.name     !== undefined) p.name     = sanitize(raw.name, 120);
        if (raw.price    !== undefined) p.price    = Math.max(0, parseFloat(Number(raw.price).toFixed(2)));
        if (raw.category !== undefined) p.category = sanitize(raw.category, 50);
        if (raw.family   !== undefined) p.family   = sanitize(raw.family, 120);
        if (raw.desc     !== undefined) p.desc     = sanitize(raw.desc, 1000);
        if (raw.care     !== undefined) p.care     = sanitize(raw.care, 500);
        if (raw.note     !== undefined) p.note     = sanitize(raw.note, 300);
        if (raw.image && raw.image !== '') p.image = sanitize(raw.image, 500);
        writeProducts(products);
        logger.info(`Produs actualizat: id=${id}`);
        activityLog.logActivity(req.session.deviceToken || req.session.credId, 'product_update', { productId: id, changes: raw });
        res.json({ success: true, product: p });
    } catch (e) {
        logger.error(`Actualizare produs: ${e.message}`);
        res.status(500).json({ success: false, error: 'Nu am putut actualiza produsul.' });
    }
});

app.patch('/api/admops/products/:id/toggle', requireAdm, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: 'ID invalid.' });
    try {
        const products = readProducts();
        const idx = products.findIndex(p => p.id === id);
        if (idx === -1) return res.status(404).json({ success: false, error: 'Produs negasit.' });
        products[idx].listed = products[idx].listed === false;
        writeProducts(products);
        logger.info(`Produs listed=${products[idx].listed}: id=${id}`);
        activityLog.logActivity(req.session.deviceToken || req.session.credId, 'product_toggle', { productId: id, listed: products[idx].listed });
        res.json({ success: true, listed: products[idx].listed });
    } catch (e) {
        logger.error(`Toggle produs: ${e.message}`);
        res.status(500).json({ success: false, error: 'Nu am putut schimba starea produsului.' });
    }
});

app.delete('/api/admops/products/:id', requireAdm, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: 'ID invalid.' });
    try {
        const products = readProducts();
        const filtered = products.filter(p => p.id !== id);
        if (filtered.length === products.length) {
            return res.status(404).json({ success: false, error: 'Produs negasit.' });
        }
        writeProducts(filtered);
        logger.info(`Produs sters: id=${id}`);
        activityLog.logActivity(req.session.deviceToken || req.session.credId, 'product_delete', { productId: id });
        res.json({ success: true });
    } catch (e) {
        logger.error(`Stergere produs: ${e.message}`);
        res.status(500).json({ success: false, error: 'Nu am putut sterge produsul.' });
    }
});

app.post('/api/admops/orders/:id/status', requireAdm, async (req, res) => {
    // Order IDs are string keys (e.g. "ORD-01") — do NOT Number() them
    const id = String(req.params.id).trim();
    if (!id) return res.status(400).json({ success: false, error: 'ID invalid.' });
    const { status } = req.body;
    const validStatuses = ['received', 'preparing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, error: 'Status invalid.' });
    }
    try {
        const orders = readOrders();
        const idx = orders.findIndex(o => o.id === id);
        if (idx === -1) return res.status(404).json({ success: false, error: 'Comanda negasita.' });
        const prev = orders[idx].status;
        orders[idx].status = status;
        orders[idx].updatedAt = new Date().toISOString();
        saveOrders(orders);
        emitAdmin('order_status', { orderId: id, status, prev, updatedAt: orders[idx].updatedAt });
        if (['preparing', 'shipped', 'delivered'].includes(status)) {
            await sendPushNotification(id, status);
        }
        logger.info(`Order ${id} status: ${prev} -> ${status}`);
        activityLog.logActivity(req.session.deviceToken || req.session.credId, 'order_status', { orderId: id, prev, status });
        res.json({ success: true });
    } catch (e) {
        logger.error(`Order status: ${e.message}`);
        res.status(500).json({ success: false, error: 'Nu am putut actualiza statusul.' });
    }
});

app.get('/api/admops/orders', requireAdm, (req, res) => {
    try {
        res.json({ success: true, orders: readOrders() });
    } catch (e) {
        logger.error(`readOrders: ${e.message}`);
        res.status(500).json({ success: false, error: 'Nu am putut citi comenzile.' });
    }
});

app.delete('/api/admops/orders/:id', requireAdm, (req, res) => {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ success: false, error: 'ID invalid.' });
    try {
        const orders = readOrders();
        const idx = orders.findIndex(o => o.id === id);
        if (idx === -1) return res.status(404).json({ success: false, error: 'Comanda negasita.' });
        const [removed] = orders.splice(idx, 1);
        saveOrders(orders);
        logger.info(`Order ${id} sters`);
        activityLog.logActivity(req.session.deviceToken || req.session.credId, 'order_delete', {
            orderId: id,
            total: removed?.total || null
        });
        emitAdmin('order_deleted', { orderId: id });
        res.json({ success: true });
    } catch (e) {
        logger.error(`Delete order: ${e.message}`);
        res.status(500).json({ success: false, error: 'Nu am putut sterge comanda.' });
    }
});

app.post('/api/push/subscribe', requireAdm, (req, res) => {
    try {
        const sub = req.body;
        if (!sub || !sub.endpoint) {
            return res.status(400).json({ success: false, error: 'Subscription invalid.' });
        }
        const adminDeviceToken = req.session.deviceToken || deviceManager.getDeviceToken(req) || 'admin';
        const adminSub = {
            ...sub,
            adminDeviceToken,
            savedAt: new Date().toISOString()
        };
        const subs = readPushSubs();
        const idx = subs.findIndex(s => s.endpoint === sub.endpoint);
        if (idx === -1) {
            subs.push(adminSub);
            savePushSubs(subs);
            logger.info(`Push subs crat: ${sub.endpoint.slice(0, 40)}...`);
        } else {
            subs[idx] = { ...subs[idx], ...adminSub };
            savePushSubs(subs);
        }
        res.json({ success: true });
    } catch (e) {
        logger.error(`Push sub: ${e.message}`);
        res.status(500).json({ success: false, error: 'Nu am putut salva subscriptia.' });
    }
});

app.delete('/api/push/subscribe', requireAdm, (req, res) => {
    try {
        const { endpoint } = req.body;
        if (!endpoint) return res.status(400).json({ success: false, error: 'Endpoint necesar.' });
        let subs = readPushSubs();
        subs = subs.filter(s => s.endpoint !== endpoint);
        savePushSubs(subs);
        res.json({ success: true });
    } catch (e) {
        logger.error(`Push unsub: ${e.message}`);
        res.status(500).json({ success: false, error: 'Nu am putut sterge subscriptia.' });
    }
});

app.get('/api/admops/vapid-key', requireAdm, (req, res) => {
    res.json({ success: true, publicKey: VAPID_PUBLIC || '' });
});

app.post('/api/order', orderLimiter, async (req, res) => {
    // Validate against raw input BEFORE sanitizeNoSQL — sanitize HTML-encodes characters
    // like ' → &#x27; and / → &#x2F; which then fail the validator regexes.
    const rawBody = req.body;

    if (!validateName(rawBody.customer?.name))
        return res.status(400).json({ success: false, error: 'Nume invalid.' });
    if (!validatePhone(rawBody.customer?.phone))
        return res.status(400).json({ success: false, error: 'Telefon invalid.' });
    if (!validateAddress(rawBody.customer?.address))
        return res.status(400).json({ success: false, error: 'Adresa invalida.' });
    if (rawBody.customer?.email && !validateEmail(rawBody.customer.email))
        return res.status(400).json({ success: false, error: 'Email invalid.' });

    if (!Array.isArray(rawBody.cart) || rawBody.cart.length === 0)
        return res.status(400).json({ success: false, error: 'Cosul este gol.' });
    if (rawBody.cart.length > MAX_CART_LINES) {
        return res.status(400).json({ success: false, error: `Maxim ${MAX_CART_LINES} produse diferite per comandă.` });
    }

    // Now sanitize for storage/display
    const raw = sanitizeNoSQL(req.body);

    const products = readProducts();
    const productMap = new Map(products.map(p => [Number(p.id), p]));
    const cart = raw.cart
        .filter(i => i && Number.isFinite(Number(i.id)) && Number.isFinite(Number(i.qty)))
        .map(i => {
            const productId = Number(i.id);
            const product = productMap.get(productId);
            if (!product) return null;
            return {
                id:    productId,
                name:  sanitize(product.name, 120),
                qty:   Math.max(1, Math.floor(Number(i.qty))),
                price: Math.max(0, parseFloat(Number(product.price).toFixed(2))),
            };
        })
        .filter(Boolean);

    if (!cart.length)
        return res.status(400).json({ success: false, error: 'Cos invalid.' });
    if (cart.some(i => i.qty > MAX_FLOWERS_PER_ORDER)) {
        return res.status(400).json({ success: false, error: `Maxim ${MAX_FLOWERS_PER_ORDER} flori per produs.` });
    }
    const totalFlowers = cart.reduce((sum, i) => sum + i.qty, 0);
    if (totalFlowers > MAX_FLOWERS_PER_ORDER) {
        return res.status(400).json({ success: false, error: `Maxim ${MAX_FLOWERS_PER_ORDER} flori per comandă.` });
    }

    const total = parseFloat(cart.reduce((s, i) => s + i.price * i.qty, 0).toFixed(2));
    const customer = {
        name:    sanitize(raw.customer?.name,    80),
        phone:   sanitize(raw.customer?.phone,    20),
        email:   sanitize(raw.customer?.email,   120),
        address: sanitize(raw.customer?.address, 300),
    };

    const liveMigration = migrateOrdersToSequentialIds();
    let currentOrders = readOrders();
    if (liveMigration.changed) currentOrders = readOrders();
    const order = {
        id:        nextOrderId(currentOrders),
        timestamp: new Date().toISOString(),
        customer, cart, total,
    };

    try {
        saveOrder(order, currentOrders);
        logger.info(`Comanda salvata: ${order.id} | ${total} MDL`);
        emitAdmin('new_order', order);
        sendPushNotification(order.id, 'new_order')
            .catch(e => logger.error(`Push comanda noua ${order.id}: ${e.message}`));
    } catch (e) {
        logger.error(`Salvare comanda: ${e.message}`);
        return res.status(500).json({ success: false, error: 'Eroare la salvarea comenzii.' });
    }

    // Respond immediately — the order is saved. Email is best-effort.
    res.json({ success: true, orderId: order.id });

    const rows = cart.map(i => `
        <tr>
            <td style="padding:8px;border:1px solid #ddd;">${escHtml(i.name)}</td>
            <td style="padding:8px;border:1px solid #ddd;text-align:center;">${i.qty}</td>
            <td style="padding:8px;border:1px solid #ddd;text-align:right;">${i.price} MDL</td>
        </tr>`).join('');

    const table = `
        <table style="width:100%;border-collapse:collapse;margin-top:12px;">
            <thead><tr style="background:#f4f4f4;">
                <th style="padding:8px;border:1px solid #ddd;text-align:left;">Produs</th>
                <th style="padding:8px;border:1px solid #ddd;">Cant.</th>
                <th style="padding:8px;border:1px solid #ddd;text-align:right;">Pret</th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table>
        <p style="text-align:right;font-size:1.1rem;font-weight:700;color:#aa0132;margin-top:10px;">Total: ${total} MDL</p>`;

    // Send emails in the background — do NOT block or fail the order on email errors
    (async () => {
        try {
            await mailer.sendMail({
                from:    `Luci Boutique <${process.env.EMAIL_USER}>`,
                to:      STORE_EMAIL,
                subject: `Comanda noua: ${escHtml(customer.name)} — ${total} MDL`,
                html: `<div style="font-family:Arial,sans-serif;color:#333;max-width:600px;">
                <h2 style="color:#aa0132;">Comanda Noua</h2>
                <p><strong>ID:</strong> ${order.id}</p>
                <p><strong>Client:</strong> ${escHtml(customer.name)}</p>
                <p><strong>Telefon:</strong> ${escHtml(customer.phone)}</p>
                <p><strong>Email:</strong> ${escHtml(customer.email || '—')}</p>
                <p><strong>Adresa:</strong> ${escHtml(customer.address)}</p>
                ${table}
            </div>`
            });
            logger.info(`Email proprietar: ${order.id}`);

            if (customer.email) {
                const pdfBuffer = await generateInvoicePDF(order);
                await mailer.sendMail({
                    from:    `Luci Boutique <${process.env.EMAIL_USER}>`,
                    to:      customer.email,
                    subject: `Confirmare comanda ${order.id}`,
                    html: `<div style="font-family:Arial,sans-serif;color:#333;max-width:600px;">
                    <h2 style="color:#aa0132;">Comanda ta a fost primita!</h2>
                    <p>Buna, <strong>${escHtml(customer.name)}</strong>.</p>
                    <p>Te contactam la <strong>${escHtml(customer.phone)}</strong> pentru confirmare.</p>
                    <p><strong>Nr. comanda:</strong> ${order.id}</p>
                    <p><strong>Adresa livrare:</strong> ${escHtml(customer.address)}</p>
                    ${table}
                    <p style="color:#888;font-size:0.85rem;margin-top:20px;">
                        Plata la livrare (ramburs) &mdash; Luci Boutique, Carpineni, Moldova &mdash; 068 167 766
                    </p>
                    <p style="color:#888;font-size:0.85rem;margin-top:10px;">
                        Factura PDF este atasata acestui email.
                    </p>
                </div>`,
                    attachments: [{
                        filename: `Factura_${order.id}.pdf`,
                        content: pdfBuffer
                    }]
                });
                logger.info(`Email confirmare client cu PDF: ${order.id}`);
            }
        } catch (e) {
            logger.error(`Email comanda ${order.id}: ${e.message}`);
        }
    })();
});

app.post('/api/contact', async (req, res) => {
    const ip = getRealIp(req);
    if (!checkContactCooldown(ip)) {
        return res.status(429).json({ success: false, error: 'Asteptati un minut intre mesaje.' });
    }
    // Validate on raw body BEFORE sanitizeNoSQL — same fix as /api/order
    if (!validateName(req.body?.name))
        return res.status(400).json({ success: false, error: 'Nume invalid.' });
    if (!req.body?.message || String(req.body.message).trim().length < 5)
        return res.status(400).json({ success: false, error: 'Mesaj prea scurt.' });
    const raw = sanitizeNoSQL(req.body);
    const name    = sanitize(raw.name, 80);
    const message = sanitize(raw.message, 1000);
    try {
        await mailer.sendMail({
            from:    `Luci Boutique <${process.env.EMAIL_USER}>`,
            to:      STORE_EMAIL,
            subject: `Mesaj nou de la ${escHtml(name)}`,
            html: `<div style="font-family:Arial,sans-serif;color:#333;max-width:600px;">
                <h2 style="color:#aa0132;">Mesaj de Contact</h2>
                <p><strong>Nume:</strong> ${escHtml(name)}</p>
                <p><strong>Mesaj:</strong></p>
                <p style="background:#f4f4f4;padding:15px;border-radius:8px;white-space:pre-wrap;">${escHtml(message)}</p>
            </div>`
        });
        logger.info(`Contact form primit (${ip})`);
        res.json({ success: true });
    } catch (e) {
        logger.error(`Email contact: ${e.message}`);
        res.status(500).json({ success: false, error: 'Eroare la trimitere.' });
    }
});

// api end

app.use((req, res) => {
    if (req.path.startsWith('/api/') || req.accepts(['html', 'json']) === 'json') {
        return res.status(404).json({ success: false, error: 'Not found.' });
    }
    return res.status(404).sendFile(path.join(DIR_PUBLIC, '404.html'));
});

app.use((err, req, res, next) => {
    logger.error(`Unhandled: ${err.message}`);
    res.status(500).json({ success: false, error: 'Eroare server.' });
});


async function shutdown(signal) {
    if (shutdown._running) return;
    shutdown._running = true;
    logger.info(`Oprire: ${signal}`);
    try {
        io.close();
        await new Promise(resolve => setTimeout(resolve, 200));
        await new Promise((resolve, reject) => {
            server.close(err => err ? reject(err) : resolve());
        });
        logger.info(`Server oprit. (${signal})`);
        process.exit(0);
    } catch (e) {
        if (e && /Server is not running/i.test(String(e.message || ''))) {
            logger.info(`Server oprit.`);
            process.exit(0);
        }
        logger.error(`Eroare oprire: ${e.message}`);
        process.exit(1);
    }
}

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException',  e => logger.error(`uncaughtException: ${e.message}`));
process.on('unhandledRejection', e => logger.error(`unhandledRejection: ${e}`));

const server = http.createServer(app);
const wsAllowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
    : ['http://localhost:3000'];

const io = new Server(server, {
    serveClient: true,
    path: '/api/socket.io',
    cors: {
        origin: wsAllowedOrigins,
        methods: ["GET", "POST"],
        credentials: true
    }
});

io.engine.use(sessionMiddleware);
io.use((socket, next) => {
    const sess = socket.request.session;
    if (sess && sess.authenticated) return next();
    next(new Error('unauthorized'));
});

function emitAdmin(event, payload) {
    io.to('admin').emit(event, payload);
}

process.stdin.on('data', chunk => {
    const cmd = chunk.toString().trim().toLowerCase();
    if (['stop', 'quit', 'exit', 'q'].includes(cmd)) shutdown('ADMIN');
});

io.on('connection', socket => {
    socket.join('admin');
    socket.on('register_device', (token) => {
        if (typeof token !== 'string' || token.length !== 64) return; // sanity check
        if (socket.request.session?.deviceToken !== token) return;
        // Leave any previous device room before joining the new one
        const prevRoom = [...socket.rooms].find(r => r.startsWith('device:'));
        if (prevRoom) socket.leave(prevRoom);
        socket.join(`device:${token}`);
        logger.info(`WS device registered: ${socket.id} → ${token.slice(0, 8)}`);
    });

    socket.on('disconnect', () => logger.info(`WS disc: ${socket.id}`));
});

function isTrustedHttpsUrl(url) {
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.toLowerCase();
        const isLocal =
            host === 'localhost' ||
            host === '127.0.0.1' ||
            host === '::1' ||
            host.endsWith('.local');
        return parsed.protocol === 'https:' && !isLocal;
    } catch {
        return false;
    }
}

server.listen(PORT, () => {
    const localUrl = `http://localhost:${PORT}`;
    const publicUrl = normalizeSiteUrl(process.env.SITE_URL, localUrl);
    const hasTrustedPublicUrl = isTrustedHttpsUrl(publicUrl);

    logger.banner('Server Version', `${serverV}`, [
        { key: 'Port',         val: PORT },
        { key: 'Environment',  val: process.env.NODE_ENV || 'development' },
        { key: 'Public URL',   val: hasTrustedPublicUrl ? publicUrl : 'not trusted - set SITE_URL=https://your-domain' },
        { key: 'Admin URL',    val: hasTrustedPublicUrl ? `${publicUrl}/admops` : `${localUrl}/admops (dev only)` },
        { key: 'Email',        val: process.env.EMAIL_USER ? 'configured' : 'not set' },
        { key: 'Push (VAPID)', val: VAPID_PUBLIC ? 'configured' : 'disabled' },
    ]);
    logger.divider();
    if (hasTrustedPublicUrl) {
        console.log(`  ➜  Public:  ${publicUrl}`);
        console.log(`  ➜  Admin:   ${publicUrl}/admops`);
    } else {
        console.log(`  ➜  Local:   ${localUrl} (dev only)`);
        console.log('  ⚠  HTTPS features need a trusted domain. Set SITE_URL=https://your-domain');
    }
    logger.divider();
});

function generateInvoicePDF(order) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        const doc = new PDFDocument({ margin: 50, size: 'A4' });

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const primary = '#aa0132';
        const dark = '#1a1a1a';
        const sub = '#666666';
        const light = '#f7f4f1';

        doc.rect(0, 0, doc.page.width, 100).fill(primary);

        doc.fillColor('#ffffff').fontSize(24).font('Helvetica-Bold')
            .text('Luci Boutique', 50, 35, { continued: false });

        doc.fontSize(10).font('Helvetica').fillColor('#ffffffaa')
            .text('Carpineni, Moldova | 068 167 766', 50, 62);

        doc.fillColor(dark).fontSize(22).font('Helvetica-Bold')
            .text('FACTURA', 0, 130, { align: 'center' });

        doc.moveTo(50, 165).lineTo(doc.page.width - 50, 165).stroke('#dddddd');

        doc.fontSize(11).fillColor(sub)
            .text(`Nr. comanda: ${order.id}`, 50, 180)
            .text(`Data: ${new Date(order.timestamp).toLocaleDateString('ro-RO')}`, 50, 196);

        doc.fontSize(12).fillColor(dark).font('Helvetica-Bold')
            .text('Client:', 350, 180);

        doc.font('Helvetica').fontSize(11).fillColor(sub)
            .text(order.customer.name, 350, 196)
            .text(order.customer.phone, 350, 212)
            .text(order.customer.email || '—', 350, 228)
            .text(order.customer.address, 350, 244);

        const pageBottomY = doc.page.height;
        const footerHeight = 44;
        const footerGap = 18;
        const footerTopY = pageBottomY - footerHeight;
        const contentMaxY = footerTopY - footerGap;

        let y = 290;
        doc.rect(50, y, doc.page.width - 100, 30).fill(light);
        doc.fillColor(dark).font('Helvetica-Bold').fontSize(10)
            .text('PRODUS', 60, y + 10)
            .text('CANT.', 320, y + 10, { width: 60, align: 'center' })
            .text('PRET', 400, y + 10, { width: 80, align: 'right' })
            .text('TOTAL', 480, y + 10, { width: 80, align: 'right' });

        y += 35;
        order.cart.forEach(item => {
            const lineTotal = (item.price * item.qty).toFixed(2);
            if (y > contentMaxY - 22) {
                doc.addPage();
                y = 70;
            }
            doc.fillColor(dark).font('Helvetica').fontSize(10)
                .text(item.name, 60, y, { width: 250 })
                .text(String(item.qty), 320, y, { width: 60, align: 'center' })
                .text(`${item.price} MDL`, 400, y, { width: 80, align: 'right' })
                .text(`${lineTotal} MDL`, 480, y, { width: 80, align: 'right' });
            y += 22;
        });

        y += 10;
        doc.moveTo(50, y).lineTo(doc.page.width - 50, y).stroke('#dddddd');
        y += 15;

        doc.fillColor(primary).font('Helvetica-Bold').fontSize(14)
            .text(`TOTAL: ${order.total} MDL`, 400, y, { width: 160, align: 'right' });

        if (y + 60 > contentMaxY) {
            doc.addPage();
            y = 70;
        }

        doc.fillColor(sub).fontSize(9)
            .text('Plata se face la livrare (ramburs).', 50, y + 30)
            .text('Luci Boutique, Carpineni, Moldova | Tel: 068 167 766', 50, y + 44);

        const currentPageBottomY = doc.page.height;
        const currentFooterTopY = currentPageBottomY - footerHeight;
        const previousBottomMargin = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        doc.rect(0, currentFooterTopY, doc.page.width, footerHeight).fill(light);
        doc.fillColor(sub).fontSize(8)
            .text(
                'Va multumim pentru comanda! Florile sunt proaspete in fiecare dimineata.',
                50,
                currentFooterTopY + 14,
                { align: 'center', width: doc.page.width - 100, lineBreak: false }
            );
        doc.page.margins.bottom = previousBottomMargin;

        doc.end();
    });
}
