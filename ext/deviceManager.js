const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const secureStore = require('./secureStore');

const FILE_DEVICES           = path.join(__dirname, '..', 'data', 'devices.json');
const DEVICE_COOKIE          = 'device_id';
const DEVICE_COOKIE_MAX_AGE  = 365 * 24 * 60 * 60 * 1000; // 1 year — survives session expiry

// ─── persistence ──────────────────────────────────────────────────────────────

function ensureDataDir() {
    const dir = path.dirname(FILE_DEVICES);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readDevices() {
    ensureDataDir();
    return secureStore.readJson(FILE_DEVICES, []);
}

function saveDevices(devices) {
    ensureDataDir();
    secureStore.writeJson(FILE_DEVICES, devices);
}

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Infer a human-readable device name from User-Agent + optional Sec-CH-UA header.
 * Sec-CH-UA is sent by Chromium-based browsers and exposes the real brand (Brave, Edge, Opera…)
 * which the UA string alone can't distinguish from Chrome.
 * Admin can always rename devices manually.
 */
function detectDeviceName(userAgent, secChUa, secChUaFullVersionList) {
    if (!userAgent) return 'Dispozitiv necunoscut';

    // ── OS ────────────────────────────────────────────────────────────────────
    let os = 'Dispozitiv';
    if (/Windows/.test(userAgent))          os = 'Windows';
    else if (/iPhone/.test(userAgent))      os = 'iPhone';
    else if (/iPad/.test(userAgent))        os = 'iPad';
    else if (/Android/.test(userAgent))     os = 'Android';
    else if (/Mac OS X/.test(userAgent))    os = 'Mac';
    else if (/Linux/.test(userAgent))       os = 'Linux';

    // ── Browser ───────────────────────────────────────────────────────────────
    // Priority order matters — many Chromium UA strings contain "Chrome" and "Safari".

    let browser = 'Browser';

    // 1. Sec-CH-UA brand list — most reliable for Chromium-based browsers.
    //    Brave, Edge, Opera all send their real name here; plain Chrome does not include them.
    const brandHints = [secChUa, secChUaFullVersionList].filter(Boolean).join(' ');
    if (brandHints) {
        if (/Brave/i.test(brandHints))           { browser = 'Brave';   }
        else if (/"Opera"|OPR/i.test(brandHints)){ browser = 'Opera';   }
        else if (/Microsoft Edge/i.test(brandHints)) { browser = 'Edge'; }
        else if (/Chromium/i.test(brandHints))   { browser = 'Chrome';  }
        else if (/Google Chrome/i.test(brandHints)) { browser = 'Chrome'; }
    }

    // 2. UA string fallbacks (used when Sec-CH-UA is absent — Firefox, Safari, older browsers)
    if (browser === 'Browser') {
        if (/Edg\/|EdgA\/|EdgiOS\//.test(userAgent)) {
            browser = 'Edge';
        } else if (/OPR\/|Opera\/|OPiOS\//.test(userAgent)) {
            browser = 'Opera';
        } else if (/SamsungBrowser\//.test(userAgent)) {
            browser = 'Samsung Internet';
        } else if (/CriOS\//.test(userAgent)) {
            // Chrome on iOS — UA never has "Chrome" but does have "CriOS"
            browser = 'Chrome';
        } else if (/FxiOS\//.test(userAgent)) {
            // Firefox on iOS
            browser = 'Firefox';
        } else if (/Firefox\//.test(userAgent)) {
            browser = 'Firefox';
        } else if (/Chrome\//.test(userAgent)) {
            // Generic Chrome — after all other Chromium variants
            browser = 'Chrome';
        } else if (/Safari\//.test(userAgent)) {
            browser = 'Safari';
        }
    }

    return `${os} (${browser})`;
}

// ─── core API ─────────────────────────────────────────────────────────────────

/**
 * Called on every successful login.
 * - If the device_id cookie maps to a known device → update lastSeen/lastIp/authMethod.
 * - Otherwise → create a new device record.
 * Returns the (possibly new) device object.
 */
function upsertDevice(existingToken, { ip, userAgent, secChUa, secChUaFullVersionList, authMethod, passkeyCredId } = {}) {
    const devices = readDevices();
    let device = existingToken ? devices.find(d => d.token === existingToken) : null;
    const detectedName = detectDeviceName(userAgent, secChUa, secChUaFullVersionList);
    const nowMs = Date.now();

    // If token is missing/stale (ex: devices.json reset), try to reuse an existing record
    // instead of creating duplicates on every login.
    if (!device && passkeyCredId) {
        device = devices.find(d => d && d.passkeyCredId === passkeyCredId) || null;
    }
    if (!device && ip && detectedName && detectedName !== 'Dispozitiv necunoscut') {
        device = devices.find(d => {
            if (!d || d.name !== detectedName || d.lastIp !== ip) return false;
            const seenAt = new Date(d.lastSeen || d.createdAt || 0).getTime();
            return Number.isFinite(seenAt) && (nowMs - seenAt) < (7 * 24 * 60 * 60 * 1000);
        }) || null;
    }

    if (device) {
        if (!Array.isArray(device.authMethods)) device.authMethods = [];
        device.lastSeen = new Date().toISOString();
        if (ip)         device.lastIp = ip;
        if (detectedName && detectedName !== 'Dispozitiv necunoscut' && detectedName !== device.name) {
            const oldBrowser = /\(([^)]+)\)$/.exec(device.name || '')?.[1] || '';
            const newBrowser = /\(([^)]+)\)$/.exec(detectedName)?.[1] || '';
            const isUpgrade = oldBrowser === 'Browser'
                || oldBrowser === 'Chrome'
                || oldBrowser === 'necunoscut'
                || newBrowser === 'Brave'
                || newBrowser === 'Edge'
                || newBrowser === 'Opera';
            if (isUpgrade) device.name = detectedName;
        }
        if (authMethod && !device.authMethods.includes(authMethod)) {
            device.authMethods.push(authMethod);
        }
        if (passkeyCredId && device.passkeyCredId !== passkeyCredId) {
            device.passkeyCredId = passkeyCredId;
            if (!device.authMethods.includes('passkey')) device.authMethods.push('passkey');
        }
    } else {
        const stableToken = (typeof existingToken === 'string' && existingToken.trim())
            ? existingToken.trim().slice(0, 128)
            : crypto.randomBytes(32).toString('hex');
        device = {
            token:       stableToken,
            name:        detectedName,
            createdAt:   new Date().toISOString(),
            lastSeen:    new Date().toISOString(),
            lastIp:      ip || null,
            authMethods: authMethod ? [authMethod] : ['password'],
            passkeyCredId: passkeyCredId || null,
        };
        devices.push(device);
    }

    saveDevices(devices);
    return device;
}

/** Attach a WebAuthn credential to a device after passkey registration. */
function linkPasskey(token, credId) {
    if (!token || !credId) return false;
    const devices = readDevices();
    const device  = devices.find(d => d.token === token);
    if (!device) return false;
    device.passkeyCredId = credId;
    if (!device.authMethods.includes('passkey')) device.authMethods.push('passkey');
    saveDevices(devices);
    return true;
}

/** When a WebAuthn credential is deleted, detach it from whichever device holds it. */
function unlinkPasskeyByCred(credId) {
    if (!credId) return false;
    const devices = readDevices();
    let changed   = false;
    for (const d of devices) {
        if (d.passkeyCredId === credId) {
            d.passkeyCredId = null;
            d.authMethods   = d.authMethods.filter(m => m !== 'passkey');
            changed = true;
        }
    }
    if (changed) saveDevices(devices);
    return changed;
}

/** Rename a device. */
function renameDevice(token, name) {
    if (!token || !name) return false;
    const devices = readDevices();
    const device  = devices.find(d => d.token === token);
    if (!device) return false;
    device.name = name;
    saveDevices(devices);
    return true;
}

/**
 * Permanently revoke a device.
 * Does NOT delete the passkey credential — caller should do that separately if needed.
 */
function revokeDevice(token) {
    if (!token) return null;
    const devices = readDevices();
    const idx     = devices.findIndex(d => d.token === token);
    if (idx === -1) return null;
    const [removed] = devices.splice(idx, 1);
    saveDevices(devices);
    return removed; // return so caller can also delete the linked passkey
}

/** Lookup a single device by token. */
function getDevice(token) {
    if (!token) return null;
    return readDevices().find(d => d.token === token) || null;
}

/** All devices, newest-active first. */
function getAllDevices() {
    return readDevices().sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));
}

// ─── cookie helpers ───────────────────────────────────────────────────────────

/** Set the long-lived device_id cookie. */
function setDeviceCookie(res, token, isProduction) {
    res.cookie(DEVICE_COOKIE, token, {
        httpOnly: true,
        secure:   isProduction,
        sameSite: 'strict',
        maxAge:   DEVICE_COOKIE_MAX_AGE,
        path:     '/',
    });
}

/** Read the device_id cookie from an incoming request. */
function getDeviceToken(req) {
    return (req.cookies && req.cookies[DEVICE_COOKIE]) || null;
}

// ─── exports ──────────────────────────────────────────────────────────────────

module.exports = {
    upsertDevice,
    getDevice,
    linkPasskey,
    unlinkPasskeyByCred,
    renameDevice,
    revokeDevice,
    getAllDevices,
    setDeviceCookie,
    getDeviceToken,
    detectDeviceName,
    DEVICE_COOKIE,
};
