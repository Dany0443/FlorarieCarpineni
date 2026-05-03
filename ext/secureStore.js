const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PREFIX = 'LBENC:1:';
const AAD = Buffer.from('luci-boutique-json-v1');

let cachedKey = null;

function ensureDir(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function decodeKey(raw) {
    const value = String(raw || '').trim();
    if (!value) return null;

    const candidates = [];
    try { candidates.push(Buffer.from(value, 'base64url')); } catch (_) {}
    try { candidates.push(Buffer.from(value, 'base64')); } catch (_) {}
    if (/^[a-f0-9]{64}$/i.test(value)) {
        try { candidates.push(Buffer.from(value, 'hex')); } catch (_) {}
    }

    const exact = candidates.find(buf => buf.length === 32);
    if (exact) return exact;

    return crypto.createHash('sha256').update(value).digest();
}

function getKey() {
    if (cachedKey) return cachedKey;
    const raw = process.env.DATA_ENCRYPTION_KEY || process.env.FILE_ENCRYPTION_KEY || '';
    cachedKey = decodeKey(raw);
    return cachedKey;
}

function isEncryptedText(raw) {
    return String(raw || '').startsWith(PREFIX);
}

function encryptJson(data) {
    const key = getKey();
    if (!key) {
        return JSON.stringify(data, null, 2);
    }

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(AAD);
    const plain = Buffer.from(JSON.stringify(data), 'utf8');
    const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
    const tag = cipher.getAuthTag();

    return PREFIX + JSON.stringify({
        alg: 'aes-256-gcm',
        iv: iv.toString('base64url'),
        tag: tag.toString('base64url'),
        data: encrypted.toString('base64url')
    });
}

function decryptJson(raw) {
    const text = String(raw || '').trim();
    if (!isEncryptedText(text)) return JSON.parse(text);

    const payload = JSON.parse(text.slice(PREFIX.length));
    if (payload.alg !== 'aes-256-gcm') throw new Error('Unsupported encrypted file format.');

    const key = getKey();
    if (!key) throw new Error('DATA_ENCRYPTION_KEY is missing.');

    const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        key,
        Buffer.from(payload.iv, 'base64url')
    );
    decipher.setAAD(AAD);
    decipher.setAuthTag(Buffer.from(payload.tag, 'base64url'));
    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(payload.data, 'base64url')),
        decipher.final()
    ]);
    return JSON.parse(decrypted.toString('utf8'));
}

function readJson(filePath, fallback) {
    ensureDir(filePath);
    try {
        if (!fs.existsSync(filePath)) return fallback;
        const raw = fs.readFileSync(filePath, 'utf8').trim();
        if (!raw) return fallback;
        return decryptJson(raw);
    } catch {
        return fallback;
    }
}

function writeJson(filePath, data) {
    ensureDir(filePath);
    fs.writeFileSync(filePath, encryptJson(data), 'utf8');
}

function migrateJsonFile(filePath, fallback) {
    ensureDir(filePath);
    if (!fs.existsSync(filePath)) {
        writeJson(filePath, fallback);
        return { changed: true, created: true };
    }

    const raw = fs.readFileSync(filePath, 'utf8').trim();
    if (isEncryptedText(raw)) return { changed: false, encrypted: true };

    const data = raw ? JSON.parse(raw) : fallback;
    writeJson(filePath, data);
    return { changed: true, encrypted: true };
}

function encryptionEnabled() {
    return Boolean(getKey());
}

module.exports = {
    readJson,
    writeJson,
    migrateJsonFile,
    encryptionEnabled,
    isEncryptedText
};
