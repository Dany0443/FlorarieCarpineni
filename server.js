// rewrite the entire server.js Vs6.2


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
const { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } = require('@simplewebauthn/server');
const { isoBase64URL, isoBase64ToBuffer, isoUint8ArrayToBase64 } = require('@simplewebauthn/server/helpers');
const app = express();
const PORT = process.env.PORT || 3000;
const DIR_DATA      = path.join(__dirname, 'data');
const DIR_PUBLIC    = path.join(__dirname, 'public');
const DIR_UPLOADS   = path.join(DIR_PUBLIC, 'uploads');
const FILE_ORDERS   = path.join(DIR_DATA, 'orders.json');
const FILE_LOGS     = path.join(DIR_DATA, 'server.log');
const FILE_PRODUCTS = path.join(DIR_PUBLIC, 'js', 'products.js');
const FILE_CREDS    = path.join(DIR_DATA, 'credentials.json');
const FILE_PUSH     = path.join(DIR_DATA, 'push-subscriptions.json');
const Logger = require('./ext/logger');
const logger = new Logger(DIR_DATA);

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC  || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE || '';
if (VAPID_PUBLIC && VAPID_PRIVATE) {
    webpush.setVapidDetails(`mailto:${process.env.EMAIL_USER}`, VAPID_PUBLIC, VAPID_PRIVATE);
}

function readPushSubs() {
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
        preparing: 'Comanda in pregatire',
        shipped: 'Comanda a fost expediata',
        delivered: 'Comanda a fost livrata!'
    };
    const bodies = {
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
        data: { orderId, status, url: '/' }
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
if (!fs.existsSync(FILE_ORDERS)) fs.writeFileSync(FILE_ORDERS, '[]');
if (!fs.existsSync(FILE_LOGS))   fs.writeFileSync(FILE_LOGS, '');
if (!fs.existsSync(FILE_CREDS))  fs.writeFileSync(FILE_CREDS, '[]');
if (!fs.existsSync(FILE_PUSH))   fs.writeFileSync(FILE_PUSH, '[]');


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
    // Arrays must be handled BEFORE the object branch — arrays are typeof 'object'
    // and without this check they become plain objects { '0': x, '1': y, ... }
    // which breaks every downstream .filter()/.map() call on the cart.
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

function readProducts() {
    const src   = fs.readFileSync(FILE_PRODUCTS, 'utf-8');
    const start = src.indexOf('[');
    const end   = src.lastIndexOf(']');
    if (start === -1 || end === -1) return [];
    return new Function(`return ${src.slice(start, end + 1)}`)();
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
}

function readOrders() {
    try { return JSON.parse(fs.readFileSync(FILE_ORDERS, 'utf-8')); }
    catch { return []; }
}

function saveOrder(order) {
    const orders = readOrders();
    orders.push(order);
    fs.writeFileSync(FILE_ORDERS, JSON.stringify(orders, null, 2));
}

const mailer = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

// trebuie sa fie pe enviroment usr si pass.
const ADMIN_USER      = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS      = process.env.ADMIN_PASS || 'admin1132';

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
    try { return JSON.parse(fs.readFileSync(FILE_CREDS, 'utf-8')); }
    catch { return []; }
}

function saveCreds(creds) {
    fs.writeFileSync(FILE_CREDS, JSON.stringify(creds, null, 2));
}

function genToken() { return crypto.randomBytes(32).toString('hex'); }

function requireAdm(req, res, next) {
    if (!req.session || !req.session.authenticated) {
        return res.status(401).json({ success: false, error: 'Unauthorized.' });
    }
    // If the device was revoked after this session was created, invalidate immediately
    const deviceToken = req.session.deviceToken || deviceManager.getDeviceToken(req);
    if (deviceToken && !deviceManager.getDevice(deviceToken)) {
        req.session.destroy(() => {});
        return res.status(401).json({ success: false, error: 'Dispozitiv revocat.' });
    }
    if (req.session.usingPasskey && req.session.lastPasskeyAuth) {
        const passkeyGracePeriod = 30 * 60 * 1000;
        if (Date.now() - req.session.lastPasskeyAuth < passkeyGracePeriod) {
            return next();
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

app.set('trust proxy', 1); // Trust Nginx so secure cookies work
// Helper: get the real client IP even when behind nginx reverse proxy.
// nginx should set: proxy_set_header X-Real-IP $remote_addr;
// Express trust-proxy handles X-Forwarded-For, but X-Real-IP is the safest single-value header.
function getRealIp(req) {
    return req.headers['x-real-ip']
        || (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
        || req.ip;
}
app.use(cookieParser()); // needed to read device_id cookie separately from session
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: false, // do NOT roll — let the per-login maxAge stick
    store: new FileStore({
        path: sessionsDir,
        secret: SESSION_SECRET,
        ttl: 30 * 24 * 60 * 60, // max possible — actual expiry driven by cookie
        retries: 1
    }),
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        // No default maxAge — session cookie by default; login sets it per rememberMe choice
    },
    name: 'admin_sid'
}));
app.use(cors());
app.use(express.json({ limit: '512kb' }));
app.use(express.urlencoded({ extended: true, limit: '512kb' }));
app.use(express.static(DIR_PUBLIC, {
    maxAge: '1d',
    setHeaders(res, filePath) {
        if (filePath.endsWith('.html') || filePath.endsWith('sw.js') || filePath.endsWith('manifest.json')) {
            res.setHeader('Cache-Control', 'no-cache');
        }
    }
}));


// niste rute pentru serving, dar nu avem nevoie de astea daca suntem pe nginx
// sunt aici pentru developement
app.get('/',         (req, res) => res.sendFile(path.join(DIR_PUBLIC, 'index.html')));
app.get('/checkout', (req, res) => res.sendFile(path.join(DIR_PUBLIC, 'checkout.html')));
app.get('/contact',  (req, res) => res.sendFile(path.join(DIR_PUBLIC, 'contact.html')));
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
    <script src="/js/app.js" defer></script>
    <script>initLang();</script>
</body>
</html>`;
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(html);
});
app.get('/admops', (req, res) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(path.join(DIR_PUBLIC, 'adminpan.html'));
});


// api custom 
app.get('/api/products', (req, res) => {
    try {
        const products = readProducts().filter(p => p.listed !== false);
        res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
        res.json({ success: true, products });
    } catch (e) {
        logger.error(`readProducts: ${e.message}`);
        res.json({ success: true, products: [] });
    }
});

// api pentru admin fiecare endpoint este verificat.
app.post('/api/admops/login', loginLimiter, (req, res) => {
    const ip       = getRealIp(req);
    const brute    = checkBrute(ip);
    if (!brute.ok) {
        logger.warn(`Login blocat (brute): ${ip}`);
        return res.status(429).json({ success: false, error: `Prea multe încercări. Așteptați ${brute.wait}s.` });
    }
    const username   = sanitize(req.body.username, 80);
    const password   = sanitize(req.body.password, 200);
    const rememberMe = req.body.rememberMe === true;
    if (!username || !password || username !== ADMIN_USER || password !== ADMIN_PASS) {
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

        res.json({ success: true });
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
        const siteUrl = process.env.SITE_URL || `http://localhost:${PORT}`;
        const rpId = process.env.RP_ID || new URL(siteUrl).hostname;
        const opts = await generateAuthenticationOptions({
            rpId,
            timeout: 120000,
            challenge: challengeBytes,
            allowCredentials: creds.map(c => ({
                id: Buffer.from(c.credentialID, 'base64url'),
                type: 'public-key',
                transports: c.transports || ['internal']
            })),
            userVerification: 'preferred'
        });
        res.json({
            challenge: req.session.webauthnChallenge,
            rpId: opts.rpId,
            timeout: opts.timeout,
            allowCredentials: opts.allowCredentials.map(c => ({
                ...c,
                id: typeof c.id === 'string' ? c.id : Buffer.from(c.id).toString('base64url')
            })),
            userVerification: opts.userVerification
        });
    } catch (e) { logger.error(`WebAuthn auth-opts: ${e.message}`); res.status(500).json({ success: false, error: e.message }); }
});

// Register challenge endpoint — only called when adding a new passkey
app.get('/api/admops/webauthn/register-options', webauthnOptionsLimiter, requireAdm, async (req, res) => {
    try {
        const creds = readCreds();
        const siteUrl = process.env.SITE_URL || `http://localhost:${PORT}`;
        const rpId = process.env.RP_ID || new URL(siteUrl).hostname;
        const userId = crypto.randomBytes(16);
        req.session.webauthnChallenge = crypto.randomBytes(32).toString('base64url');
        req.session.webauthnUserId = userId.toString('base64url');
        const opts = await generateRegistrationOptions({
            rpName: 'Luci Boutique Admin',
            rpId,
            userName: ADMIN_USER,
            userDisplayName: 'Administrator',
            userId,
            timeout: 120000,
            attestationType: 'none',
            authenticatorSelection: {
                authenticatorAttachment: 'platform',
                residentKey: 'required',
                userVerification: 'preferred'
            },
            supportedAlgorithmIDs: [-7, -257],
            excludeCredentials: creds.map(c => ({
                id: Buffer.from(c.credentialID, 'base64url'),
                type: 'public-key',
                transports: c.transports || ['internal']
            }))
        });
        res.json({
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
        const siteUrl = process.env.SITE_URL || `http://localhost:${PORT}`;
        const rpId = process.env.RP_ID || new URL(siteUrl).hostname;
        const expectedChallenge = req.session.webauthnChallenge;
        if (!expectedChallenge) return res.status(400).json({ success: false, error: 'Sesiune expirata. Reincearca.' });
        delete req.session.webauthnChallenge;
        const verification = await verifyRegistrationResponse({
            response: body.credential,
            expectedChallenge,
            expectedOrigin: siteUrl,
            expectedRPID: rpId
        });
        if (!verification.verified) return res.status(400).json({ success: false, error: 'Verificare esuata.' });
        const { credentialID, credentialPublicKey, counter, transports } = verification.registrationInfo;
        const creds = readCreds();
        const credIdStr = Buffer.from(credentialID).toString('base64url');
        if (creds.some(c => c.credentialID === credIdStr)) {
            return res.status(400).json({ success: false, error: 'Passkey deja inregistrat.' });
        }
        creds.push({
            credentialID: credIdStr,
            publicKey:    Buffer.from(credentialPublicKey).toString('base64url'),
            counter,
            transports:   transports || [],
            deviceName:   req.body.deviceName || 'Dispozitiv necunoscut',
            createdAt:    new Date().toISOString()
        });
        saveCreds(creds);

        // Link the new passkey to the current device record
        const deviceToken = req.session.deviceToken || deviceManager.getDeviceToken(req);
        if (deviceToken) {
            deviceManager.linkPasskey(deviceToken, credIdStr);
        }

        req.session.authenticated  = true;
        req.session.loginTime      = Date.now();
        req.session.usingPasskey   = true;
        req.session.cookie.maxAge  = 30 * 24 * 60 * 60 * 1000;
        logger.info(`Passkey inregistrata de la: ${getRealIp(req)}`);
        io.emit('devices_update', deviceManager.getAllDevices());
        res.json({ success: true });
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
        const siteUrl = process.env.SITE_URL || `http://localhost:${PORT}`;
        const rpId = process.env.RP_ID || new URL(siteUrl).hostname;
        const expectedChallenge = req.session.webauthnChallenge;
        if (!expectedChallenge) return res.status(400).json({ success: false, error: 'Sesiune expirata. Reincearca.' });
        delete req.session.webauthnChallenge;
        const verification = await verifyAuthenticationResponse({
            response: body.credential,
            expectedChallenge,
            expectedOrigin: siteUrl,
            expectedRPID: rpId,
            authenticator: {
                credentialID: Buffer.from(cred.credentialID, 'base64url'),
                credentialPublicKey: Buffer.from(cred.publicKey, 'base64url'),
                counter: cred.counter,
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

            io.emit('devices_update', deviceManager.getAllDevices());

            res.json({ success: true });
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
    io.emit('devices_update', deviceManager.getAllDevices());
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

    io.emit('devices_update', deviceManager.getAllDevices());
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
    // Order IDs are strings like "ORD-1749..." — do NOT Number() them
    const id = String(req.params.id).trim();
    if (!id) return res.status(400).json({ success: false, error: 'ID invalid.' });
    const { status } = req.body;
    const validStatuses = ['received', 'preparing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, error: 'Status invalid.' });
    }
    try {
        const orders = JSON.parse(fs.readFileSync(FILE_ORDERS, 'utf-8'));
        const idx = orders.findIndex(o => o.id === id);
        if (idx === -1) return res.status(404).json({ success: false, error: 'Comanda negasita.' });
        const prev = orders[idx].status;
        orders[idx].status = status;
        orders[idx].updatedAt = new Date().toISOString();
        fs.writeFileSync(FILE_ORDERS, JSON.stringify(orders, null, 2));
        io.emit('order_status', { orderId: id, status, prev, updatedAt: orders[idx].updatedAt });
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
        res.json({ success: true, orders: JSON.parse(fs.readFileSync(FILE_ORDERS, 'utf-8')) });
    } catch (e) {
        logger.error(`readOrders: ${e.message}`);
        res.status(500).json({ success: false, error: 'Nu am putut citi comenzile.' });
    }
});

app.post('/api/push/subscribe', (req, res) => {
    try {
        const sub = req.body;
        if (!sub || !sub.endpoint) {
            return res.status(400).json({ success: false, error: 'Subscription invalid.' });
        }
        const subs = readPushSubs();
        const exists = subs.find(s => s.endpoint === sub.endpoint);
        if (!exists) {
            subs.push(sub);
            savePushSubs(subs);
            logger.info(`Push subs crat: ${sub.endpoint.slice(0, 40)}...`);
        }
        res.json({ success: true });
    } catch (e) {
        logger.error(`Push sub: ${e.message}`);
        res.status(500).json({ success: false, error: 'Nu am putut salva subscriptia.' });
    }
});

app.delete('/api/push/subscribe', (req, res) => {
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

app.get('/api/vapid-key', (req, res) => {
    res.json({ success: true, publicKey: VAPID_PUBLIC || '' });
});

app.get('/api/admops/vapid-key', requireAdm, (req, res) => {
    res.json({ success: true, publicKey: VAPID_PUBLIC || '' });
});

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
        logger.info(`Comanda salvata: ${order.id} | ${customer.name} | ${total} MDL`);
        io.emit('new_order', order);
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
                to:      process.env.EMAIL_USER,
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
            to:      process.env.EMAIL_USER,
            subject: `Mesaj nou de la ${escHtml(name)}`,
            html: `<div style="font-family:Arial,sans-serif;color:#333;max-width:600px;">
                <h2 style="color:#aa0132;">Mesaj de Contact</h2>
                <p><strong>Nume:</strong> ${escHtml(name)}</p>
                <p><strong>Mesaj:</strong></p>
                <p style="background:#f4f4f4;padding:15px;border-radius:8px;white-space:pre-wrap;">${escHtml(message)}</p>
            </div>`
        });
        logger.info(`Contact de la ${name} (${ip})`);
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
    cors: {
        origin: wsAllowedOrigins,
        methods: ["GET", "POST"],
        credentials: true
    }
});

process.stdin.on('data', chunk => {
    const cmd = chunk.toString().trim().toLowerCase();
    if (['stop', 'quit', 'exit', 'q'].includes(cmd)) shutdown('ADMIN');
});

io.on('connection', socket => {
    logger.info(`WS client: ${socket.id}`);

    // Client calls this after login so we know which device this socket belongs to.
    // The socket is placed in room `device:{token}` — lets us target it on revocation.
    socket.on('register_device', (token) => {
        if (typeof token !== 'string' || token.length !== 64) return; // sanity check
        // Leave any previous device room before joining the new one
        const prevRoom = [...socket.rooms].find(r => r.startsWith('device:'));
        if (prevRoom) socket.leave(prevRoom);
        socket.join(`device:${token}`);
        logger.info(`WS device registered: ${socket.id} → ${token.slice(0, 8)}`);
    });

    socket.on('disconnect', () => logger.info(`WS disc: ${socket.id}`));
});

server.listen(PORT, () => {
    logger.banner('Luci Boutique', '6.2', [
        { key: 'Port',         val: PORT },
        { key: 'Environment',  val: process.env.NODE_ENV || 'development' },
        { key: 'Data dir',     val: DIR_DATA },
        { key: 'Uploads dir',  val: DIR_UPLOADS },
        '---',
        { key: 'VAPID',        val: VAPID_PUBLIC ? 'configured' : 'missing' },
        { key: 'Email',        val: process.env.EMAIL_USER || 'not set' },
    ]);
    logger.divider();
    console.log(`  ➜  Local:   http://localhost:${PORT}`);
    console.log(`  ➜  Network: http://${require('os').hostname()}:${PORT}`);
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
}
