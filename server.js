<<<<<<< HEAD
// rewrite the entire server.js Vs6.2


if (!globalThis.crypto) { globalThis.crypto = require('crypto').webcrypto; }
=======
<<<<<<< Updated upstream
// rewrite the entire server.js V4 speram ca de data asta merge cum trebu
// patch 4.4

=======
// serverV variable is the version of the server.
let serverV = 6.5;

if (!globalThis.crypto) { globalThis.crypto = require('crypto').webcrypto; }
>>>>>>> Stashed changes
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
require('dotenv').config();

const http = require('http');
const express = require('express');
const nodemailer = require('nodemailer');
<<<<<<< HEAD
=======
<<<<<<< Updated upstream
const cors       = require('cors');
const path       = require('path');
const fs         = require('fs');
const crypto     = require('crypto');
const readline   = require('readline');
const multer     = require('multer');
const app  = express();
=======
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
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
<<<<<<< HEAD
const bcrypt = require('bcrypt');
=======
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
const activityLog   = require('./ext/activityLog');
const deviceManager = require('./ext/deviceManager');
const telemetryProcessor = require('./ext/telemetryProcessor');
const { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } = require('@simplewebauthn/server');
const { isoBase64URL, isoBase64ToBuffer, isoUint8ArrayToBase64 } = require('@simplewebauthn/server/helpers');
const app = express();
<<<<<<< HEAD
=======
>>>>>>> Stashed changes
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
const PORT = process.env.PORT || 3000;
const DIR_DATA      = path.join(__dirname, 'data');
const DIR_PUBLIC    = path.join(__dirname, 'public');
const DIR_PRIVATE   = path.join(__dirname, 'private');
const DIR_UPLOADS   = path.join(DIR_PUBLIC, 'uploads');
const FILE_ORDERS   = path.join(DIR_DATA, 'orders.json');
const FILE_LOGS     = path.join(DIR_DATA, 'server.log');
const FILE_PRODUCTS = path.join(DIR_PUBLIC, 'js', 'products.js');
<<<<<<< HEAD
=======
<<<<<<< Updated upstream
=======
const FILE_I18N     = path.join(DIR_PUBLIC, 'js', 'i18n.js');
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
const FILE_CREDS    = path.join(DIR_DATA, 'credentials.json');
const FILE_PUSH     = path.join(DIR_DATA, 'push-subscriptions.json');
const FILE_TELEMETRY = path.join(DIR_DATA, 'telemetry.json');
const FILE_TELEMETRY_SETTINGS = path.join(DIR_DATA, 'telemetry-settings.json');
const Logger = require('./ext/logger');
<<<<<<< HEAD
=======
const secureStore = require('./ext/secureStore');
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
const logger = new Logger(DIR_DATA);
const MAX_TELEMETRY_EVENTS = 20000;
const DEFAULT_TELEMETRY_SETTINGS = {
    enabled: true,
    errors: true,
    performance: true,
    clicks: true,
    td3: true,
    checkout: true
};
<<<<<<< HEAD
=======
const ASSET_LEASE_MS = 30 * 60 * 1000;
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC  || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE || '';
if (VAPID_PUBLIC && VAPID_PRIVATE) {
    webpush.setVapidDetails(`mailto:${process.env.EMAIL_USER}`, VAPID_PUBLIC, VAPID_PRIVATE);
}

function readPushSubs() {
<<<<<<< HEAD
    try { return JSON.parse(fs.readFileSync(FILE_PUSH, 'utf-8')); }
    catch { return []; }
}

function savePushSubs(subs) {
    fs.writeFileSync(FILE_PUSH, JSON.stringify(subs, null, 2));
}

async function sendPushNotification(orderId, status) {
    const subs = readPushSubs();
    if (!subs.length) return;
    const titles = {
=======
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
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
        preparing: 'Comanda in pregatire',
        shipped: 'Comanda a fost expediata',
        delivered: 'Comanda a fost livrata!'
    };
    const bodies = {
<<<<<<< HEAD
=======
        new_order: `A intrat o comanda noua: #${orderId}.`,
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
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
<<<<<<< HEAD
        data: { orderId, status, url: '/' }
=======
        data: { orderId, status, url: '/admops' }
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
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
<<<<<<< HEAD
=======
>>>>>>> Stashed changes
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)

for (const dir of [DIR_DATA, DIR_UPLOADS]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
<<<<<<< Updated upstream
if (!fs.existsSync(FILE_ORDERS)) fs.writeFileSync(FILE_ORDERS, '[]');
if (!fs.existsSync(FILE_LOGS))   fs.writeFileSync(FILE_LOGS, '');
<<<<<<< HEAD
if (!fs.existsSync(FILE_CREDS))  fs.writeFileSync(FILE_CREDS, '[]');
if (!fs.existsSync(FILE_PUSH))   fs.writeFileSync(FILE_PUSH, '[]');
if (!fs.existsSync(FILE_TELEMETRY)) fs.writeFileSync(FILE_TELEMETRY, '[]');
if (!fs.existsSync(FILE_TELEMETRY_SETTINGS)) fs.writeFileSync(FILE_TELEMETRY_SETTINGS, JSON.stringify(DEFAULT_TELEMETRY_SETTINGS, null, 2));
=======
=======

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
>>>>>>> Stashed changes
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)


function escHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

<<<<<<< HEAD
=======
<<<<<<< Updated upstream
function isValidEmail(email) {
    return /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(email);
=======
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
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
<<<<<<< HEAD
    try {
        const data = JSON.parse(fs.readFileSync(FILE_TELEMETRY, 'utf-8'));
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
=======
    const data = secureStore.readJson(FILE_TELEMETRY, []);
    return Array.isArray(data) ? data : [];
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
}

function appendTelemetryEvents(events) {
    if (!events.length) return 0;
    const existing = readTelemetryEvents();
    existing.push(...events);
    const trimmed = existing.length > MAX_TELEMETRY_EVENTS
        ? existing.slice(existing.length - MAX_TELEMETRY_EVENTS)
        : existing;
<<<<<<< HEAD
    fs.writeFileSync(FILE_TELEMETRY, JSON.stringify(trimmed, null, 2));
=======
    secureStore.writeJson(FILE_TELEMETRY, trimmed);
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
    telemetryProcessor.invalidate();
    return events.length;
}

function readTelemetrySettings() {
<<<<<<< HEAD
    try {
        const raw = JSON.parse(fs.readFileSync(FILE_TELEMETRY_SETTINGS, 'utf-8'));
        return { ...DEFAULT_TELEMETRY_SETTINGS, ...(raw && typeof raw === 'object' ? raw : {}) };
    } catch {
        return { ...DEFAULT_TELEMETRY_SETTINGS };
    }
=======
    const raw = secureStore.readJson(FILE_TELEMETRY_SETTINGS, DEFAULT_TELEMETRY_SETTINGS);
    return { ...DEFAULT_TELEMETRY_SETTINGS, ...(raw && typeof raw === 'object' ? raw : {}) };
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
}

function saveTelemetrySettings(next) {
    const merged = { ...DEFAULT_TELEMETRY_SETTINGS, ...next };
<<<<<<< HEAD
    fs.writeFileSync(FILE_TELEMETRY_SETTINGS, JSON.stringify(merged, null, 2));
=======
    secureStore.writeJson(FILE_TELEMETRY_SETTINGS, merged);
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
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

function toTopList(mapObj, limit = 8) {
    return Object.entries(mapObj)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([label, value]) => ({ label, value }));
<<<<<<< HEAD
=======
>>>>>>> Stashed changes
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
}

function readProducts() {
    const src   = fs.readFileSync(FILE_PRODUCTS, 'utf-8');
    const start = src.indexOf('[');
    const end   = src.lastIndexOf(']');
    if (start === -1 || end === -1) return [];
    return new Function(`return ${src.slice(start, end + 1)}`)();
}

function readTranslations() {
    const src = fs.readFileSync(FILE_I18N, 'utf-8');
    const start = src.indexOf('{', src.indexOf('const TRANSLATIONS'));
    const end = src.indexOf('\n};', start);
    if (start === -1 || end === -1) return {};
    return new Function(`return ${src.slice(start, end + 2)}`)();
}

function pickShareLang(rawLang) {
    return ['ro', 'en', 'ru'].includes(rawLang) ? rawLang : 'ro';
}

function getProductShareText(product, lang) {
    let translations = {};
    try { translations = readTranslations(); } catch {}
    const dict = translations[lang] || translations.ro || {};
    const ro = translations.ro || {};
    const descKey = `product_${product.id}_desc`;
    const desc = dict[descKey] || ro[descKey] || product.desc || '';
    const title = `${product.name} — ${product.price} MDL | Luci Boutique`;
    return { title, desc };
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
    const items = products.map(p => {
        const lines = [
            `        id: ${p.id}`,
            `        name: ${JSON.stringify(p.name)}`,
            `        category: ${JSON.stringify(p.category || 'General')}`,
            `        price: ${Number(p.price)}`,
            `        image: ${JSON.stringify(p.image || '')}`,
            `        family: ${JSON.stringify(p.family || '')}`,
            `        desc: ${JSON.stringify(p.desc || '')}`,
            `        care: ${JSON.stringify(p.care || '')}`,
            `        note: ${JSON.stringify(p.note || '')}`,
            `        model3d: ${p.model3d ? JSON.stringify(p.model3d) : 'null'}`,
            `        listed: ${p.listed === false ? 'false' : 'true'}`,
        ];
        return `    {\n${lines.join(',\n')}\n    }`;
    });
    fs.writeFileSync(FILE_PRODUCTS, `const productsData = [\n${items.join(',\n')}\n];\n`, 'utf-8');
    invalidateAssetFingerprint();
}

function readOrders() {
    return secureStore.readJson(FILE_ORDERS, []);
}

function saveOrder(order) {
    const orders = readOrders();
    orders.push(order);
    secureStore.writeJson(FILE_ORDERS, orders);
}

function saveOrders(orders) {
    secureStore.writeJson(FILE_ORDERS, Array.isArray(orders) ? orders : []);
}

const mailer = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});
const STORE_EMAIL = process.env.STORE_EMAIL || process.env.EMAIL_USER;

// trebuie sa fie pe enviroment usr si pass.
const ADMIN_USER      = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS      = process.env.ADMIN_PASS || 'admin1132';
<<<<<<< HEAD
const ADMIN_PASS_HASH = process.env.ADMIN_PASS_HASH || '';
const BCRYPT_HASH_RE  = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

// Fix 1: SESSION_SECRET must be stable across restarts.
// If it's missing from .env, every server restart signs out ALL active sessions.
if (!process.env.SESSION_SECRET) {
    process.stderr.write(
        '\n⚠️  WARNING: SESSION_SECRET is not set in .env!\n' +
        '   Sessions will be invalidated on every server restart.\n' +
        '   Add to .env:  SESSION_SECRET=' + require('crypto').randomBytes(64).toString('hex') + '\n\n'
    );
}
const SESSION_SECRET  = process.env.SESSION_SECRET || crypto.randomBytes(64).toString('hex');
const RATE_WINDOW_MS  = 60 * 1000;
const RATE_MAX        = 5;

=======
<<<<<<< Updated upstream
const sessions        = new Map();
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
const loginAttempts   = new Map();
const contactCooldown = new Map();

function readCreds() {
    try { return JSON.parse(fs.readFileSync(FILE_CREDS, 'utf-8')); }
    catch { return []; }
}

function saveCreds(creds) {
    fs.writeFileSync(FILE_CREDS, JSON.stringify(creds, null, 2));
}

function genToken() { return crypto.randomBytes(32).toString('hex'); }

<<<<<<< HEAD
=======
// protejam rutele daca nu i administrator
function requireAdmin(req, res, next) {
    // Permitem si formatul x-admin-token si formatul Authorization Bearer
    let token = req.headers['x-admin-token'];
    if (!token && req.headers['authorization']) {
        token = req.headers['authorization'].split(' ')[1];
=======
const ADMIN_PASS_HASH = process.env.ADMIN_PASS_HASH || '';
const BCRYPT_HASH_RE  = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;
let bcrypt = null;

function getBcrypt() {
    if (!bcrypt) bcrypt = require('bcrypt');
    return bcrypt;
}

// Fix 1: SESSION_SECRET must be stable across restarts.
// If it's missing from .env, every server restart signs out ALL active sessions.
if (!process.env.SESSION_SECRET) {
    process.stderr.write(
        '\n⚠️  WARNING: SESSION_SECRET is not set in .env!\n' +
        '   Sessions will be invalidated on every server restart.\n' +
        '   Add to .env:  SESSION_SECRET=' + require('crypto').randomBytes(64).toString('hex') + '\n\n'
    );
}
const SESSION_SECRET  = process.env.SESSION_SECRET || crypto.randomBytes(64).toString('hex');
const RATE_WINDOW_MS  = 60 * 1000;
const RATE_MAX        = 5;

const loginAttempts   = new Map();
const contactCooldown = new Map();

function readCreds() {
    return secureStore.readJson(FILE_CREDS, []);
}

function saveCreds(creds) {
    secureStore.writeJson(FILE_CREDS, creds);
}

function genToken() { return crypto.randomBytes(32).toString('hex'); }

>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
async function verifyAdminPassword(password) {
    const configuredHash = ADMIN_PASS_HASH || (BCRYPT_HASH_RE.test(ADMIN_PASS) ? ADMIN_PASS : '');
    if (configuredHash) {
        try {
<<<<<<< HEAD
            return await bcrypt.compare(password, configuredHash);
=======
            return await getBcrypt().compare(password, configuredHash);
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
        } catch (err) {
            logger.error(`bcrypt compare failed: ${err.message}`);
            return false;
        }
<<<<<<< HEAD
=======
>>>>>>> Stashed changes
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
    }
    return password === ADMIN_PASS;
}

function requireAdm(req, res, next) {
    if (!req.session || !req.session.authenticated) {
        return res.status(401).json({ success: false, error: 'Unauthorized.' });
    }
<<<<<<< HEAD
=======
<<<<<<< Updated upstream
    const s = sessions.get(token);
    if (Date.now() > s.expires) {
        sessions.delete(token);
        return res.status(401).json({ success: false, error: 'Sesiune expirata.' });
=======
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
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
                authMethod: 'session-restore',
            });
        }
    }
    if (req.session.usingPasskey && req.session.lastPasskeyAuth) {
        const passkeyGracePeriod = 30 * 60 * 1000;
        if (Date.now() - req.session.lastPasskeyAuth < passkeyGracePeriod) {
            return next();
        }
<<<<<<< HEAD
=======
>>>>>>> Stashed changes
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
    }
    next();
}

<<<<<<< HEAD
=======
<<<<<<< Updated upstream
// limitam incercarile de login sa nu scaneze parole
=======
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
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

<<<<<<< HEAD
=======
>>>>>>> Stashed changes
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
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

<<<<<<< HEAD
=======
<<<<<<< Updated upstream
app.use(cors());
=======
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
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

<<<<<<< HEAD
app.use(session({
=======
const sessionMiddleware = session({
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
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
<<<<<<< HEAD
}));
=======
});
app.use(sessionMiddleware);
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
        : [`http://localhost:${PORT}`],
    credentials: true
}));
<<<<<<< HEAD
=======
>>>>>>> Stashed changes
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
app.use(express.json({ limit: '512kb' }));
app.use(express.urlencoded({ extended: true, limit: '512kb' }));

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
    maxAge: 0,
    setHeaders(res, filePath) {
<<<<<<< HEAD
        if (filePath.endsWith('.html') || filePath.endsWith('sw.js') || filePath.endsWith('manifest.json')) {
            res.setHeader('Cache-Control', 'no-cache');
        }
=======
<<<<<<< Updated upstream
        if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
=======
        if (filePath.endsWith('.html') || filePath.endsWith('sw.js') || filePath.endsWith('manifest.json') || /\.(js|css)$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'no-cache');
        } else if (/\.(avif|webp|png|jpe?g|svg|gif|glb|gltf)$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'public, max-age=86400');
        }
>>>>>>> Stashed changes
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
    }
}));


// niste rute pentru serving, dar nu avem nevoie de astea daca suntem pe nginx
// sunt aici pentru developement
app.get('/',         (req, res) => res.sendFile(path.join(DIR_PUBLIC, 'index.html')));
app.get('/checkout', (req, res) => res.sendFile(path.join(DIR_PUBLIC, 'checkout.html')));
app.get('/contact',  (req, res) => res.sendFile(path.join(DIR_PUBLIC, 'contact.html')));
<<<<<<< HEAD
app.get('/product/:id', (req, res) => {
    const id = Number(req.params.id);
    const products = readProducts();
    const p = products.find(x => x.id === id && x.listed !== false);
    if (!p) return res.status(404).sendFile(path.join(DIR_PUBLIC, 'index.html'));
    const siteUrl = process.env.SITE_URL || `http://localhost:${PORT}`;
    const productUrl = `${siteUrl}/product/${p.id}`;
    const imagePath = String(p.image || '');
    const imgUrl = !imagePath ? ''
        : (/^https?:\/\//i.test(imagePath) ? imagePath : `${siteUrl}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`);
    const ogTitle = `${p.name} — ${p.price} MDL | Luci Boutique`;
    const ogDesc = p.desc || `Comanda ${p.name} de la Luci Boutique. Livrare rapida in Carpineni, Moldova.`;
    const html = `<!DOCTYPE html>
<html lang="ro">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <title>${escHtml(ogTitle)}</title>
    <meta name="description" content="${escHtml(ogDesc)}">
    <meta property="og:title" content="${escHtml(ogTitle)}">
    <meta property="og:description" content="${escHtml(ogDesc)}">
    <meta property="og:image" content="${imgUrl}">
    <meta property="og:url" content="${productUrl}">
    <meta property="og:type" content="product">
    <meta property="og:locale" content="ro_MD">
    <meta property="product:price:amount" content="${p.price}">
    <meta property="product:price:currency" content="MDL">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escHtml(ogTitle)}">
    <meta name="twitter:description" content="${escHtml(ogDesc)}">
    <meta name="twitter:image" content="${imgUrl}">
    <link rel="canonical" href="${productUrl}">
    <meta name="view-transition" content="same-origin">
    <link rel="icon" type="image/png" href="${siteUrl}/assets/favicon.svg">
    <link href="https://fonts.googleapis.com/css2?family=Baskervville:ital@0;1&family=Montserrat:wght@300;400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="${siteUrl}/css/style.css">
    <link rel="manifest" href="${siteUrl}/manifest.json">
    <meta name="theme-color" content="#aa0132">
    <script>
        (function() {
            const savedLang = localStorage.getItem('lb_lang') || 'ro';
            const savedTheme = localStorage.getItem('lb_theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
            document.documentElement.lang = savedLang;
            document.documentElement.setAttribute('data-theme', savedTheme);
        })();
    </script>
</head>
<body>
    <div id="loader">
        <div class="loader-content">
            <svg class="loader-flower" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
                <g transform="translate(256,256)">
                    <ellipse cx="0" cy="-82" rx="43" ry="64" fill="var(--primary)"/>
                    <ellipse cx="0" cy="-82" rx="43" ry="64" fill="var(--primary)" transform="rotate(60)"/>
                    <ellipse cx="0" cy="-82" rx="43" ry="64" fill="var(--primary)" transform="rotate(120)"/>
                    <ellipse cx="0" cy="-82" rx="43" ry="64" fill="var(--primary)" transform="rotate(180)"/>
                    <ellipse cx="0" cy="-82" rx="43" ry="64" fill="var(--primary)" transform="rotate(240)"/>
                    <ellipse cx="0" cy="-82" rx="43" ry="64" fill="var(--primary)" transform="rotate(300)"/>
                    <circle cx="0" cy="0" r="47" fill="var(--primary)"/>
                    <circle cx="0" cy="0" r="26" fill="var(--bg-color)"/>
                </g>
            </svg>
            <div class="loader-text">Luci Boutique.</div>
        </div>
    </div>
    <nav class="navbar">
        <div class="nav-container">
            <a href="/" class="logo">Luci Boutique.</a>
            <div class="nav-links">
                <a href="/" data-i18n="nav_home">Acasa</a>
                <a href="/#shop" data-i18n="nav_collection">Colectie</a>
                <a href="/contact.html" data-i18n="nav_contact">Contact</a>
            </div>
            <div class="toggles-container">
                <div class="lang-selector" id="lang-selector">
                    <div class="lang-option" data-lang="ro">RO</div>
                    <div class="lang-option" data-lang="en">EN</div>
                    <div class="lang-option" data-lang="ru">RU</div>
                    <div class="lang-slider"></div>
                </div>
                <div class="toggle-wrapper" id="theme-toggle" aria-label="Schimba tema / Change theme">
                    <span class="toggle-label"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg></span>
                    <div class="toggle-slider"><div class="toggle-thumb"></div></div>
                    <span class="toggle-label"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg></span>
                </div>
            </div>
            <div class="nav-icons">
                <button id="menu-btn" class="icon-btn mobile-only" aria-label="Deschide meniul">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                </button>
            </div>
        </div>
    </nav>
    <div class="mobile-menu">
        <button class="close-menu">✕</button>
        <div class="mobile-nav-top">
            <div class="lang-selector" id="lang-selector-mobile">
                <div class="lang-option" data-lang="ro">RO</div>
                <div class="lang-option" data-lang="en">EN</div>
                <div class="lang-option" data-lang="ru">RU</div>
                <div class="lang-slider"></div>
            </div>
            <div class="toggle-wrapper" id="theme-toggle-mobile" aria-label="Schimba tema / Change theme">
                <span class="toggle-label"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg></span>
                <div class="toggle-slider"><div class="toggle-thumb"></div></div>
                <span class="toggle-label"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg></span>
            </div>
        </div>
        <div class="mobile-nav-links">
            <a href="/">Acasa</a>
            <a href="/#shop">Colectie</a>
            <a href="/contact.html">Contact</a>
        </div>
    </div>
    <div style="max-width:900px;margin:0 auto;padding:120px 24px 60px;text-align:center;">
        <img src="${escHtml(p.image)}" alt="${escHtml(p.name)}" style="max-width:340px;width:100%;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.25);" onerror="this.style.display='none'">
        <h1 style="font-family:var(--font-heading);font-size:2.4rem;margin:1.5rem 0 0.5rem;color:var(--text-main);">${escHtml(p.name)}</h1>
        <p style="font-size:1.5rem;color:var(--primary);font-weight:600;margin-bottom:1rem;">${p.price} MDL</p>
        <p style="color:var(--text-muted);max-width:480px;margin:0 auto 2rem;">${escHtml(p.desc || '')}</p>
        <a href="/#shop" class="cta-btn" style="display:inline-block;text-decoration:none;padding:14px 36px;font-size:1rem;">Vezi Colectia</a>
    </div>
    <footer><p data-i18n="footer">&copy; 2026 Luci Boutique. Toate drepturile rezervate.</p></footer>
    <script src="/js/i18n.js"></script>
    <script src="/js/controls.js"></script>
    <script src="/js/controls-swipe.js"></script>
    <script src="/js/telemetry.js"></script>
    <script src="/js/app.js" defer></script>
    <script>initLang();</script>
</body>
</html>`;
    res.setHeader('Cache-Control', 'public, max-age=3600');
=======
<<<<<<< Updated upstream
app.get('/adminpan', (req, res) => {
=======
app.get('/product/:id', (req, res) => {
    const id = Number(req.params.id);
    const lang = pickShareLang(String(req.query.lang || '').toLowerCase());
    const products = readProducts();
    const p = products.find(x => x.id === id && x.listed !== false);
    if (!p) return res.status(404).sendFile(path.join(DIR_PUBLIC, 'index.html'));
    const assetState = getStorefrontAssetState();
    const siteUrl = normalizeSiteUrl(process.env.SITE_URL, getRequestOrigin(req));
    const productUrl = `${siteUrl}/product/${p.id}?lang=${lang}`;
    const imagePath = String(p.image || '');
    const imgUrl = !imagePath ? ''
        : (/^https?:\/\//i.test(imagePath) ? imagePath : `${siteUrl}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`);
    const { title, desc } = getProductShareText(p, lang);
    const locale = ({ ro: 'ro_MD', en: 'en_US', ru: 'ru_RU' })[lang];
    let html = fs.readFileSync(path.join(DIR_PUBLIC, 'index.html'), 'utf-8');

    html = html
        .replace('<head>', '<head>\n    <base href="/">')
        .replace(/<html lang="[^"]*">/, `<html lang="${lang}">`)
        .replace(/<title>.*?<\/title>/, `<title>${escHtml(title)}</title>`)
        .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${escHtml(desc)}">`)
        .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${escHtml(title)}">`)
        .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${escHtml(desc)}">`)
        .replace(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${escHtml(imgUrl)}">
    <meta property="og:url" content="${escHtml(productUrl)}">
    <meta property="product:price:amount" content="${Number(p.price) || 0}">
    <meta property="product:price:currency" content="MDL">`)
        .replace(/<meta property="og:type" content="[^"]*">/, '<meta property="og:type" content="product">')
        .replace(/<meta property="og:locale" content="[^"]*">/, `<meta property="og:locale" content="${locale}">`)
        .replace(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${escHtml(title)}">`)
        .replace(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${escHtml(desc)}">`)
        .replace(/<meta name="twitter:image" content="[^"]*">/, `<meta name="twitter:image" content="${escHtml(imgUrl)}">
    <link rel="canonical" href="${escHtml(productUrl)}">`)
        .replace('</head>', `    <script>
        window.__shareProductId = ${Number(p.id)};
        window.__shareLang = ${JSON.stringify(lang)};
        window.__shareFingerprint = ${JSON.stringify(assetState.fingerprint)};
        localStorage.setItem('lb_lang', ${JSON.stringify(lang)});
        document.documentElement.lang = ${JSON.stringify(lang)};
    </script>
</head>`);

    res.setHeader('Cache-Control', 'no-cache');
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
    res.send(html);
});
app.get('/login', (req, res) => {
    if (req.session?.authenticated) return res.redirect(302, '/admops');
<<<<<<< HEAD
=======
>>>>>>> Stashed changes
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
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

<<<<<<< HEAD
app.get('/api/telemetry-settings', (req, res) => {
    const settings = readTelemetrySettings();
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, settings });
=======
// api pentru admin fiecare endpoint este verificat.
app.post('/api/admin/login', (req, res) => {
    const ip = req.ip;
    const bf = checkBrute(ip);
    if (!bf.ok) {
        log('WARN', `Login blocat: ${ip}`);
        return res.status(429).json({ success: false, error: `Prea multe incercari. Asteptati ${bf.wait}s.` });
    }
    const username = sanitize(req.body.username, 80);
    const password = sanitize(req.body.password, 200);
    if (!username || !password || username !== ADMIN_USER || password !== ADMIN_PASS) {
        log('WARN', `Login esuat: ${ip}`);
        return res.status(401).json({ success: false, error: 'Credentiale gresite.' });
    }
<<<<<<< Updated upstream
    const token = genToken();
    sessions.set(token, { expires: Date.now() + 4 * 60 * 60 * 1000, ip });
    loginAttempts.delete(ip);
    log('INFO', `Admin logat: ${ip}`);
    res.json({ success: true, token });
=======

    // Upsert device record — creates one on first login, updates lastSeen on subsequent ones
    const existingToken = deviceManager.getDeviceToken(req);
    const device = deviceManager.upsertDevice(existingToken, {
        ip:         ip,
        userAgent:  req.headers['user-agent'],
        secChUa:    req.headers['sec-ch-ua'],
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

        deviceManager.setDeviceCookie(res, device.token, process.env.NODE_ENV === 'production');

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
>>>>>>> Stashed changes
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
});

app.post('/api/telemetry', express.text({ type: '*/*', limit: '256kb' }), (req, res) => {
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
        const allowed  = new Set(['page_view', 'time_on_page', 'web_vital', 'js_error', 'click', 'product_view', 'cart_add', 'checkout_attempt', 'checkout_success', 'checkout_fail', 'native_pay_attempt', 'payment_method_shown', 'model_fps', 'model_load_start', 'model_load_end', 'model_error', 'contact_submit']);

        const normalized = payload
            .slice(0, 200)
            .filter(e => e && typeof e === 'object')
            .map(e => {
                const event = sanitize(e.event, 40).toLowerCase();
                if (!allowed.has(event)) return null;
                const ts = Number(e.ts);
                const data = (e.data && typeof e.data === 'object') ? sanitizeNoSQL(e.data) : {};
                return {
                    event,
                    data,
                    sessionId: sanitize(e.sessionId, 120),
                    ts: Number.isFinite(ts) ? ts : now,
                    serverTs: now,
                    country,
                    ip,
                    ua: sanitize(ua, 300),
                    parsedUa
                };
            })
            .filter(Boolean);

        const accepted = appendTelemetryEvents(normalized);
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

        deviceManager.setDeviceCookie(res, device.token, process.env.NODE_ENV === 'production');

        activityLog.logActivity(device.token, 'login', { ip, deviceName: device.name });
        logger.info(`Admin logat: ${ip}${rememberMe ? ' (remember me)' : ''} device=${device.token.slice(0,8)}`);

        io.emit('devices_update', deviceManager.getAllDevices());

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

// Auth challenge endpoint — called by login page (conditional autofill) and passkey button
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

<<<<<<< HEAD
=======
<<<<<<< Updated upstream
app.get('/api/admin/logs', requireAdmin, (req, res) => {
=======
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
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
<<<<<<< HEAD
        io.emit('devices_update', deviceManager.getAllDevices());
=======
        emitAdmin('devices_update', deviceManager.getAllDevices());
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
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

            deviceManager.setDeviceCookie(res, device.token, process.env.NODE_ENV === 'production');

            activityLog.logActivity(device.token, 'login', { ip, deviceName: device.name });
            logger.info(`Passkey login reusit: ${ip} device=${device.token.slice(0,8)}`);

<<<<<<< HEAD
            io.emit('devices_update', deviceManager.getAllDevices());
=======
            emitAdmin('devices_update', deviceManager.getAllDevices());
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)

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
<<<<<<< HEAD
    io.emit('devices_update', deviceManager.getAllDevices());
=======
    emitAdmin('devices_update', deviceManager.getAllDevices());
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
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
    // session-file-store returns { sessionId: sessionData } from .all().
    const revokedToken = req.params.token;
    const sessionStore = req.sessionStore;
    sessionStore.all((err, sessions) => {
        if (err || !sessions) return;
        for (const [sessId, sessData] of Object.entries(sessions)) {
            if (sessData && sessData.deviceToken === revokedToken) {
                sessionStore.destroy(sessId, () => {});
            }
        }
    });

<<<<<<< HEAD
    io.emit('devices_update', deviceManager.getAllDevices());
=======
    emitAdmin('devices_update', deviceManager.getAllDevices());
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
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
    res.json({ success: true, settings });
});

app.get('/api/admops/telemetry/overview', requireAdm, (req, res) => {
    try {
        const events = readTelemetryEvents();
        const today = telemetryDayKey(Date.now());
        const eventsToday = events.filter(e =>
            telemetryDayKey(e.serverTs || e.ts || Date.now()) === today
            && e.event === 'page_view'  
            && !((e.data && e.data.url) || '').includes('/admops')  
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
                const rawUrl = decodeTelemetryText(e.data && e.data.url);
                if (rawUrl) {
                    let label = rawUrl;
                    try {
                        const u = new URL(rawUrl);
                        label = `${u.pathname}${u.search || ''}`;
                    } catch (_) {}
                    topPagesMap[label] = (topPagesMap[label] || 0) + 1;
                    if (label.includes('/admops')) adminViews++;
                    else storefrontViews++;
                }
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
            if (eventName === 'cart_add') cartAdds++;
            if (eventName === 'js_error') jsErrors++;
            if (eventName === 'time_on_page') {
                const ms = safeTelemetryNumber(e.data && e.data.ms);
                if (ms != null) {
                    timeOnPageTotal += ms;
                    timeOnPageSamples++;
                }
            }
        }

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
                todayVisits,
                totalEvents: events.length,
                lastSyncAt
            },
            dailySummary: telemetryProcessor.getDailySummary(),
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
<<<<<<< HEAD
=======
>>>>>>> Stashed changes
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
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
<<<<<<< HEAD
    logger.info(`Imagine incarcata: ${req.file.filename}`);
=======
<<<<<<< Updated upstream
    log('INFO', `Imagine incarcata: ${req.file.filename}`);
=======
    invalidateAssetFingerprint();
    logger.info(`Imagine incarcata: ${req.file.filename}`);
>>>>>>> Stashed changes
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
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

<<<<<<< HEAD
=======
<<<<<<< Updated upstream
=======
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
app.post('/api/admops/orders/:id/status', requireAdm, async (req, res) => {
    // Order IDs are strings like "ORD-1749..." — do NOT Number() them
    const id = String(req.params.id).trim();
    if (!id) return res.status(400).json({ success: false, error: 'ID invalid.' });
    const { status } = req.body;
    const validStatuses = ['received', 'preparing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, error: 'Status invalid.' });
    }
    try {
<<<<<<< HEAD
        const orders = JSON.parse(fs.readFileSync(FILE_ORDERS, 'utf-8'));
=======
        const orders = readOrders();
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
        const idx = orders.findIndex(o => o.id === id);
        if (idx === -1) return res.status(404).json({ success: false, error: 'Comanda negasita.' });
        const prev = orders[idx].status;
        orders[idx].status = status;
        orders[idx].updatedAt = new Date().toISOString();
<<<<<<< HEAD
        fs.writeFileSync(FILE_ORDERS, JSON.stringify(orders, null, 2));
        io.emit('order_status', { orderId: id, status, prev, updatedAt: orders[idx].updatedAt });
=======
        saveOrders(orders);
        emitAdmin('order_status', { orderId: id, status, prev, updatedAt: orders[idx].updatedAt });
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
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
<<<<<<< HEAD
        res.json({ success: true, orders: JSON.parse(fs.readFileSync(FILE_ORDERS, 'utf-8')) });
=======
        res.json({ success: true, orders: readOrders() });
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
    } catch (e) {
        logger.error(`readOrders: ${e.message}`);
        res.status(500).json({ success: false, error: 'Nu am putut citi comenzile.' });
    }
});

<<<<<<< HEAD
app.post('/api/push/subscribe', (req, res) => {
=======
app.post('/api/push/subscribe', requireAdm, (req, res) => {
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
    try {
        const sub = req.body;
        if (!sub || !sub.endpoint) {
            return res.status(400).json({ success: false, error: 'Subscription invalid.' });
        }
<<<<<<< HEAD
        const subs = readPushSubs();
        const exists = subs.find(s => s.endpoint === sub.endpoint);
        if (!exists) {
            subs.push(sub);
            savePushSubs(subs);
            logger.info(`Push subs crat: ${sub.endpoint.slice(0, 40)}...`);
=======
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
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
        }
        res.json({ success: true });
    } catch (e) {
        logger.error(`Push sub: ${e.message}`);
        res.status(500).json({ success: false, error: 'Nu am putut salva subscriptia.' });
    }
});

<<<<<<< HEAD
app.delete('/api/push/subscribe', (req, res) => {
=======
app.delete('/api/push/subscribe', requireAdm, (req, res) => {
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
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

<<<<<<< HEAD
app.get('/api/vapid-key', (req, res) => {
    res.json({ success: true, publicKey: VAPID_PUBLIC || '' });
});

=======
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
app.get('/api/admops/vapid-key', requireAdm, (req, res) => {
    res.json({ success: true, publicKey: VAPID_PUBLIC || '' });
});

<<<<<<< HEAD
=======
>>>>>>> Stashed changes
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
app.post('/api/order', async (req, res) => {
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

    // Now sanitize for storage/display
    const raw = sanitizeNoSQL(req.body);

    const cart = raw.cart
        .filter(i => i && typeof i.name === 'string'
            && Number.isFinite(Number(i.price))
            && Number.isFinite(Number(i.qty)))
        .map(i => ({
            name:  sanitize(i.name, 120),
            qty:   Math.max(1, Math.min(99, Math.floor(Number(i.qty)))),
            price: Math.max(0, parseFloat(Number(i.price).toFixed(2))),
        }));

    if (!cart.length)
        return res.status(400).json({ success: false, error: 'Cos invalid.' });

    const total = parseFloat(cart.reduce((s, i) => s + i.price * i.qty, 0).toFixed(2));
    const customer = {
        name:    sanitize(raw.customer?.name,    80),
        phone:   sanitize(raw.customer?.phone,    20),
        email:   sanitize(raw.customer?.email,   120),
        address: sanitize(raw.customer?.address, 300),
    };

    const order = {
        id:        `ORD-${Date.now()}`,
        timestamp: new Date().toISOString(),
        customer, cart, total,
    };

    try {
        saveOrder(order);
<<<<<<< HEAD
        logger.info(`Comanda salvata: ${order.id} | ${customer.name} | ${total} MDL`);
        io.emit('new_order', order);
=======
<<<<<<< Updated upstream
        log('INFO', `Comanda salvata: ${order.id} | ${customer.name} | ${total} MDL`);
=======
        logger.info(`Comanda salvata: ${order.id} | ${total} MDL`);
        emitAdmin('new_order', order);
        sendPushNotification(order.id, 'new_order')
            .catch(e => logger.error(`Push comanda noua ${order.id}: ${e.message}`));
>>>>>>> Stashed changes
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
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

<<<<<<< HEAD
=======
<<<<<<< Updated upstream
    try {
        await mailer.sendMail({
            from:    `Luci Boutique <${process.env.EMAIL_USER}>`,
            to:      process.env.EMAIL_USER,
            subject: `Comanda noua: ${escHtml(customer.name)} — ${total} MDL`,
            html: `<div style="font-family:Arial,sans-serif;color:#333;max-width:600px;">
=======
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
    // Send emails in the background — do NOT block or fail the order on email errors
    (async () => {
        try {
            await mailer.sendMail({
                from:    `Luci Boutique <${process.env.EMAIL_USER}>`,
<<<<<<< HEAD
                to:      process.env.EMAIL_USER,
                subject: `Comanda noua: ${escHtml(customer.name)} — ${total} MDL`,
                html: `<div style="font-family:Arial,sans-serif;color:#333;max-width:600px;">
=======
                to:      STORE_EMAIL,
                subject: `Comanda noua: ${escHtml(customer.name)} — ${total} MDL`,
                html: `<div style="font-family:Arial,sans-serif;color:#333;max-width:600px;">
>>>>>>> Stashed changes
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
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
<<<<<<< HEAD
        logger.info(`Contact de la ${name} (${ip})`);
=======
<<<<<<< Updated upstream
        log('INFO', `Contact de la ${name} (${ip})`);
=======
        logger.info(`Contact form primit (${ip})`);
>>>>>>> Stashed changes
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
        res.json({ success: true });
    } catch (e) {
        logger.error(`Email contact: ${e.message}`);
        res.status(500).json({ success: false, error: 'Eroare la trimitere.' });
    }
});

// api end

app.use((req, res) => res.status(404).json({ success: false, error: 'Not found.' }));

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
<<<<<<< HEAD
        if (e && /Server is not running/i.test(String(e.message || ''))) {
            logger.info(`Server deja oprit. (${signal})`);
            process.exit(0);
        }
        logger.error(`Eroare oprire: ${e.message}`);
=======
<<<<<<< Updated upstream
        log('ERROR', `Eroare oprire: ${e.message}`);
=======
        if (e && /Server is not running/i.test(String(e.message || ''))) {
            logger.info(`Server oprit.`);
            process.exit(0);
        }
        logger.error(`Eroare oprire: ${e.message}`);
>>>>>>> Stashed changes
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
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
    cors: {
        origin: wsAllowedOrigins,
        methods: ["GET", "POST"],
        credentials: true
    }
});
<<<<<<< HEAD
=======
<<<<<<< Updated upstream
=======

io.engine.use(sessionMiddleware);
io.use((socket, next) => {
    const sess = socket.request.session;
    if (sess && sess.authenticated) return next();
    next(new Error('unauthorized'));
});

function emitAdmin(event, payload) {
    io.to('admin').emit(event, payload);
}
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)

process.stdin.on('data', chunk => {
    const cmd = chunk.toString().trim().toLowerCase();
    if (['stop', 'quit', 'exit', 'q'].includes(cmd)) shutdown('ADMIN');
});

io.on('connection', socket => {
<<<<<<< HEAD
    socket.on('register_device', (token) => {
        if (typeof token !== 'string' || token.length !== 64) return; // sanity check
=======
    socket.join('admin');
    socket.on('register_device', (token) => {
        if (typeof token !== 'string' || token.length !== 64) return; // sanity check
        if (socket.request.session?.deviceToken !== token) return;
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
        // Leave any previous device room before joining the new one
        const prevRoom = [...socket.rooms].find(r => r.startsWith('device:'));
        if (prevRoom) socket.leave(prevRoom);
        socket.join(`device:${token}`);
        logger.info(`WS device registered: ${socket.id} → ${token.slice(0, 8)}`);
    });

    socket.on('disconnect', () => logger.info(`WS disc: ${socket.id}`));
});

<<<<<<< HEAD
server.listen(PORT, () => {
    logger.banner('Luci Boutique', '6.2', [
        { key: 'Port',         val: PORT },
        { key: 'Environment',  val: process.env.NODE_ENV || 'development' },
        { key: 'Admin URL',    val: `http://localhost:${PORT}/admops` },
=======
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
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
        { key: 'Email',        val: process.env.EMAIL_USER ? 'configured' : 'not set' },
        { key: 'Push (VAPID)', val: VAPID_PUBLIC ? 'configured' : 'disabled' },
    ]);
    logger.divider();
<<<<<<< HEAD
    console.log(`  ➜  Local:   http://localhost:${PORT}`);
    console.log(`  ➜  Network: http://${require('os').hostname()}:${PORT}`);
=======
    if (hasTrustedPublicUrl) {
        console.log(`  ➜  Public:  ${publicUrl}`);
        console.log(`  ➜  Admin:   ${publicUrl}/admops`);
    } else {
        console.log(`  ➜  Local:   ${localUrl} (dev only)`);
        console.log('  ⚠  HTTPS features need a trusted domain. Set SITE_URL=https://your-domain');
    }
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
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

        doc.moveDown(2);
        doc.fillColor(sub).fontSize(9)
            .text('Plata se face la livrare (ramburs).', 50, y + 30)
            .text('Luci Boutique, Carpineni, Moldova | Tel: 068 167 766', 50, y + 44);

        doc.rect(0, doc.page.height - 60, doc.page.width, 60).fill(light);
        doc.fillColor(sub).fontSize(8)
            .text('Va multumim pentru comanda! Florile sunt proaspete in fiecare dimineata.', 50, doc.page.height - 40, { align: 'center', width: doc.page.width - 100 });

        doc.end();
    });
<<<<<<< HEAD
}
=======
}
>>>>>>> Stashed changes
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
