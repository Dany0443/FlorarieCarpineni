const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const secureStore = require('./secureStore');

const FILE_DEVICES           = path.join(__dirname, '..', 'data', 'devices.json');
const DEVICE_COOKIE          = 'device_id';
const DEVICE_COOKIE_MAX_AGE  = 365 * 24 * 60 * 60 * 1000; // 1 year survives session expiry

// persistence

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
const LINUX_DISTROS = [
    ['Ubuntu', /ubuntu/i],
    ['Linux Mint', /linux mint|mint/i],
    ['Pop!_OS', /pop!_os|pop_os/i],
    ['Fedora', /fedora/i],
    ['Debian', /debian/i],
    ['Arch Linux', /arch/i],
    ['Manjaro', /manjaro/i],
    ['openSUSE', /opensuse|suse/i],
    ['Gentoo', /gentoo/i],
    ['Alpine Linux', /alpine/i],
    ['Kali Linux', /kali/i],
    ['CentOS', /centos/i],
    ['Red Hat Linux', /red hat|rhel/i],
];

const ANDROID_VENDOR_PATTERNS = [
    ['Samsung', /^(?:samsung\s+)?sm-|^gt-|^samsung\b/i],
    ['Google Pixel', /^pixel\b/i],
    ['OnePlus', /^oneplus\b|^(?:kb|in|hd|gm|ne)\d{4}/i],
    ['Xiaomi', /^(?:mi|m210|m200|m190|redmi|poco)\b/i],
    ['Huawei', /^(?:huawei|ane-|vog-|lya-|ele-|clt-|mar-|was-)/i],
    ['Honor', /^honor\b|^(?:bnd-|jsn-|yal-)/i],
    ['OPPO', /^(?:oppo|cph|pch|pgm|pgt|peh|pfem|pffm)/i],
    ['Realme', /^(?:realme|rmx)/i],
    ['Motorola', /^(?:moto|motorola|xt\d)/i],
    ['Nokia', /^nokia\b/i],
    ['Sony Xperia', /^(?:xperia|so-\d|sog\d)/i],
    ['LG', /^(?:lg-|lm-)/i],
    ['ASUS', /^(?:asus|zenfone|rog phone)/i],
    ['Nothing', /^a\d{3}\b|^nothing/i],
];

const BROWSER_UA_PATTERNS = [
    ['Edge', /EdgA?\/|EdgiOS\//],
    ['Opera Mini', /Opera Mini\//],
    ['Opera', /OPR\/|Opera\/|OPiOS\//],
    ['Vivaldi', /Vivaldi\//],
    ['Yandex Browser', /YaBrowser\//],
    ['Samsung Internet', /SamsungBrowser\//],
    ['DuckDuckGo', /DuckDuckGo\//],
    ['Huawei Browser', /HuaweiBrowser\//],
    ['MIUI Browser', /MiuiBrowser\//],
    ['HeyTap Browser', /HeyTapBrowser\//],
    ['UC Browser', /UCBrowser\/|UCWEB\//],
    ['Amazon Silk', /Silk\//],
    ['Puffin', /Puffin\//],
    ['Brave', /Brave\//],
    ['LibreWolf', /LibreWolf\//],
    ['Waterfox', /Waterfox\//],
    ['Floorp', /Floorp\//],
    ['SeaMonkey', /SeaMonkey\//],
    ['Pale Moon', /PaleMoon\//],
    ['Basilisk', /Basilisk\//],
    ['GNU IceCat', /IceCat\//],
    ['Iceweasel', /Iceweasel\//],
    ['Tor Browser', /TorBrowser\//],
    ['Firefox', /FxiOS\/|Firefox\//],
    ['GNOME Web', /Epiphany\//],
    ['Falkon', /Falkon\//],
    ['Konqueror', /Konqueror\//],
    ['qutebrowser', /qutebrowser\//i],
    ['Midori', /Midori\//],
    ['Chromium', /Chromium\//],
    ['Chrome', /CriOS\/|Chrome\//],
    ['Safari', /Safari\//],
];

function cleanHint(value) {
    return String(value || '').replace(/^"|"$/g, '').trim();
}

function parseBrands(secChUa, secChUaFullVersionList) {
    const raw = [secChUaFullVersionList, secChUa].filter(Boolean).join(', ');
    const brands = [];
    raw.replace(/"([^"]+)"/g, (_, brand) => {
        if (!/not[ _-]?a[ _-]?brand/i.test(brand)) brands.push(brand);
        return '';
    });
    return brands;
}

function detectBrowser(userAgent, secChUa, secChUaFullVersionList) {
    const brands = parseBrands(secChUa, secChUaFullVersionList);
    const brandText = brands.join(' ');
    if (/Brave/i.test(brandText)) return { name: 'Brave', confidence: 95, source: 'client-hints' };
    if (/Microsoft Edge/i.test(brandText)) return { name: 'Edge', confidence: 95, source: 'client-hints' };
    if (/Opera|Opera GX/i.test(brandText)) return { name: 'Opera', confidence: 95, source: 'client-hints' };
    if (/Vivaldi/i.test(brandText)) return { name: 'Vivaldi', confidence: 95, source: 'client-hints' };
    if (/DuckDuckGo/i.test(brandText)) return { name: 'DuckDuckGo', confidence: 95, source: 'client-hints' };
    if (/Google Chrome/i.test(brandText)) return { name: 'Chrome', confidence: 90, source: 'client-hints' };
    if (/Chromium/i.test(brandText)) return { name: 'Chromium', confidence: 82, source: 'client-hints' };

    for (const [name, pattern] of BROWSER_UA_PATTERNS) {
        if (pattern.test(userAgent)) {
            const isGenericSafari = name === 'Safari'
                && /Chrome\/|Chromium\/|OPR\/|Edg\/|SamsungBrowser\/|YaBrowser\/|UCBrowser\//.test(userAgent);
            if (!isGenericSafari) return { name, confidence: name === 'Chrome' ? 70 : 78, source: 'user-agent' };
        }
    }
    return { name: 'Browser', confidence: 10, source: 'unknown' };
}

function detectOs(userAgent, secChUaPlatform) {
    const platform = cleanHint(secChUaPlatform).toLowerCase();
    if (platform) {
        if (platform.includes('android')) return { name: 'Android', confidence: 92, source: 'client-hints' };
        if (platform.includes('chrome os')) return { name: 'Chrome OS', confidence: 92, source: 'client-hints' };
        if (platform.includes('windows')) return { name: 'Windows', confidence: 90, source: 'client-hints' };
        if (platform.includes('mac')) return { name: 'Mac', confidence: 90, source: 'client-hints' };
        if (platform.includes('ios')) return { name: 'iOS', confidence: 90, source: 'client-hints' };
        if (platform.includes('linux')) return { name: detectLinuxDistro(userAgent) || 'Linux', confidence: 86, source: 'client-hints' };
    }

    if (/CrOS/i.test(userAgent)) return { name: 'Chrome OS', confidence: 88, source: 'user-agent' };
    if (/Android/i.test(userAgent)) return { name: 'Android', confidence: 86, source: 'user-agent' };
    if (/iPad/i.test(userAgent)) return { name: 'iPad', confidence: 86, source: 'user-agent' };
    if (/iPhone/i.test(userAgent)) return { name: 'iPhone', confidence: 86, source: 'user-agent' };
    if (/Windows NT 11/i.test(userAgent)) return { name: 'Windows 11', confidence: 82, source: 'user-agent' };
    if (/Windows NT 10/i.test(userAgent)) return { name: 'Windows 10', confidence: 82, source: 'user-agent' };
    if (/Windows/i.test(userAgent)) return { name: 'Windows', confidence: 78, source: 'user-agent' };
    if (/Mac OS X|Macintosh/i.test(userAgent)) return { name: 'Mac', confidence: 78, source: 'user-agent' };

    const distro = detectLinuxDistro(userAgent);
    if (distro) return { name: distro, confidence: 80, source: 'user-agent' };
    if (/Linux|X11/i.test(userAgent)) return { name: 'Linux', confidence: 70, source: 'user-agent' };
    return { name: 'Dispozitiv', confidence: 5, source: 'unknown' };
}

function detectLinuxDistro(userAgent) {
    for (const [name, pattern] of LINUX_DISTROS) {
        if (pattern.test(userAgent)) return name;
    }
    return '';
}

function cleanAndroidModel(value) {
    return String(value || '')
        .replace(/\bBuild\/.*$/i, '')
        .replace(/\bwv\b/i, '')
        .replace(/\s+/g, ' ')
        .replace(/[()]/g, '')
        .trim()
        .slice(0, 48);
}

function detectAndroidModel(userAgent) {
    const match = /\(([^)]*Android[^)]*)\)/i.exec(userAgent);
    if (!match) return '';
    const parts = match[1].split(';').map(p => cleanAndroidModel(p)).filter(Boolean);
    const androidIndex = parts.findIndex(p => /^Android\b/i.test(p));
    const candidates = parts.slice(androidIndex + 1)
        .filter(p => !/^(mobile|tablet|wv|linux|en[-_][a-z]+)$/i.test(p));
    const rawModel = candidates[0] || '';
    if (!rawModel) return '';
    for (const [vendor, pattern] of ANDROID_VENDOR_PATTERNS) {
        if (pattern.test(rawModel)) {
            if (rawModel.toLowerCase().startsWith(vendor.toLowerCase())) {
                return rawModel.replace(/^motorola/i, 'Motorola');
            }
            if (vendor === 'Google Pixel' && /^pixel\b/i.test(rawModel)) return rawModel.replace(/^Pixel/i, 'Google Pixel');
            return `${vendor} ${rawModel}`.replace(/\s+/g, ' ').trim();
        }
    }
    return rawModel;
}

function detectDeviceType(userAgent, secChUaMobile, osName) {
    const mobileHint = cleanHint(secChUaMobile);
    if (mobileHint === '?1') return 'mobile';
    if (/iPad|Tablet|PlayBook|Silk/i.test(userAgent)) return 'tablet';
    if (/Mobi|iPhone|iPod|Android.*Mobile|Opera Mini|IEMobile|Windows Phone/i.test(userAgent)) return 'mobile';
    if (/Android/i.test(userAgent) && !/Mobile/i.test(userAgent)) return 'tablet';
    if (osName === 'iPad') return 'tablet';
    return 'desktop';
}

function detectDeviceInfo(userAgent, {
    secChUa,
    secChUaFullVersionList,
    secChUaPlatform,
    secChUaMobile,
} = {}) {
    const ua = String(userAgent || '');
    if (!ua) {
        return {
            name: 'Dispozitiv necunoscut',
            os: 'Dispozitiv',
            browser: 'Browser',
            deviceLabel: 'Dispozitiv',
            deviceType: 'unknown',
            confidence: 0,
        };
    }

    const os = detectOs(ua, secChUaPlatform);
    const browser = detectBrowser(ua, secChUa, secChUaFullVersionList);
    const androidModel = os.name === 'Android' ? detectAndroidModel(ua) : '';
    const deviceType = detectDeviceType(ua, secChUaMobile, os.name);
    const deviceLabel = androidModel || os.name;
    const confidence = os.confidence + browser.confidence + (androidModel ? 12 : 0);

    return {
        name: `${deviceLabel} (${browser.name})`,
        os: os.name,
        browser: browser.name,
        deviceLabel,
        deviceType,
        androidModel: androidModel || null,
        browserSource: browser.source,
        osSource: os.source,
        confidence,
    };
}

function detectDeviceName(userAgent, secChUa, secChUaFullVersionList, secChUaPlatform, secChUaMobile) {
    return detectDeviceInfo(userAgent, {
        secChUa,
        secChUaFullVersionList,
        secChUaPlatform,
        secChUaMobile,
    }).name;
}

function shouldAutoUpdateDeviceName(device, detectedInfo) {
    if (!device || device.userNamed || !detectedInfo || detectedInfo.name === 'Dispozitiv necunoscut') return false;
    if (!device.name || device.name === 'Dispozitiv necunoscut') return true;
    if (device.name === detectedInfo.name) return false;

    const oldScore = Number(device.detectionScore) || 0;
    const newScore = Number(detectedInfo.confidence) || 0;
    const oldBrowser = /\(([^)]+)\)$/.exec(device.name || '')?.[1] || '';
    const genericOldBrowser = ['Browser', 'Chrome', 'Chromium', 'necunoscut'].includes(oldBrowser);
    const specificNewBrowser = !['Browser', 'Chrome', 'Chromium'].includes(detectedInfo.browser);
    const oldDevice = String(device.name).replace(/\s+\([^)]+\)$/, '');
    const hasBetterDeviceLabel = ['Dispozitiv', 'Android', 'Linux'].includes(oldDevice) && detectedInfo.deviceLabel !== oldDevice;

    return (oldScore > 0 && newScore > oldScore) || (genericOldBrowser && specificNewBrowser) || hasBetterDeviceLabel;
}

// Core api
function upsertDevice(existingToken, {
    ip,
    userAgent,
    secChUa,
    secChUaFullVersionList,
    secChUaPlatform,
    secChUaMobile,
    authMethod,
    passkeyCredId
} = {}) {
    const devices = readDevices();
    let device = existingToken ? devices.find(d => d.token === existingToken) : null;
    const detectedInfo = detectDeviceInfo(userAgent, {
        secChUa,
        secChUaFullVersionList,
        secChUaPlatform,
        secChUaMobile,
    });
    const detectedName = detectedInfo.name;
    const nowMs = Date.now();
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
        if (detectedName && shouldAutoUpdateDeviceName(device, detectedInfo)) {
            device.name = detectedName;
        }
        device.info = detectedInfo;
        device.detectionScore = Math.max(Number(device.detectionScore) || 0, detectedInfo.confidence || 0);
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
            info:        detectedInfo,
            detectionScore: detectedInfo.confidence || 0,
            userNamed:   false,
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
    device.userNamed = true;
    saveDevices(devices);
    return true;
}

function revokeDevice(token) {
    if (!token) return null;
    const devices = readDevices();
    const idx     = devices.findIndex(d => d.token === token);
    if (idx === -1) return null;
    const [removed] = devices.splice(idx, 1);
    saveDevices(devices);
    return removed; // return so caller can also delete the linked passkey
}

function getDevice(token) {
    if (!token) return null;
    return readDevices().find(d => d.token === token) || null;
}

function getAllDevices() {
    return readDevices().sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));
}

// Cookie helper

function setDeviceCookie(res, token, isProduction) {
    res.cookie(DEVICE_COOKIE, token, {
        httpOnly: true,
        secure:   isProduction,
        sameSite: 'strict',
        maxAge:   DEVICE_COOKIE_MAX_AGE,
        path:     '/',
    });
}


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
    detectDeviceInfo,
    DEVICE_COOKIE,
};
