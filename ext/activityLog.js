const fs = require('fs');
const path = require('path');
<<<<<<< HEAD

const FILE_ACTIVITY = path.join(__dirname, 'data', 'activity.json');
=======
const secureStore = require('./secureStore');

const FILE_ACTIVITY = path.join(__dirname, '..', 'data', 'activity.json');
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)

const ACTION_LABELS = {
    login:           'Autentificare reușită',
    login_failed:    'Autentificare eșuată',
    product_create:  'Produs creat',
    product_update:  'Produs actualizat',
    product_delete:  'Produs șters',
    product_toggle:  'Produs arătat/ascuns',
    passkey_deleted: 'Passkey șters',
    passkey_renamed: 'Passkey redenumit',
    order_status:    'Status comandă schimbat',
};

function ensureDataDir() {
    const dir = path.dirname(FILE_ACTIVITY);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readActivity() {
    ensureDataDir();
<<<<<<< HEAD
    try { return JSON.parse(fs.readFileSync(FILE_ACTIVITY, 'utf-8')); }
    catch { return {}; }
=======
    return secureStore.readJson(FILE_ACTIVITY, {});
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
}

function saveActivity(data) {
    ensureDataDir();
<<<<<<< HEAD
    fs.writeFileSync(FILE_ACTIVITY, JSON.stringify(data, null, 2));
=======
    secureStore.writeJson(FILE_ACTIVITY, data);
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
}

function logActivity(credId, action, details = {}) {
    const id = credId || 'password';
    const activity = readActivity();
    if (!activity[id]) activity[id] = [];
    activity[id].unshift({
        action,
        label: ACTION_LABELS[action] || action,
        details,
        timestamp: new Date().toISOString(),
        ip: details.ip || null
    });
    if (activity[id].length > 100) activity[id] = activity[id].slice(0, 100);
    saveActivity(activity);
}

function getActivity(credId, limit = 50) {
    const id = credId || 'password';
    const activity = readActivity();
    return (activity[id] || []).slice(0, limit);
}

function getAllActivity(limit = 200) {
    const activity = readActivity();
    const all = [];
    for (const credId of Object.keys(activity)) {
        for (const entry of activity[credId]) {
            all.push({ ...entry, credId });
        }
    }
    return all
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, limit);
}

function clearActivity(credId) {
    if (!credId) return false;
    const activity = readActivity();
    if (!activity[credId]) return false;
    delete activity[credId];
    saveActivity(activity);
    return true;
}

function getSummary(credId) {
    const entries = getActivity(credId, 100);
    const logins = entries.filter(e => e.action === 'login');
    return {
        totalLogins:  logins.length,
        lastLogin:    logins[0]?.timestamp || null,
        lastIp:       logins[0]?.ip || null,
        totalActions: entries.length,
    };
}

<<<<<<< HEAD
module.exports = { logActivity, getActivity, getAllActivity, clearActivity, getSummary, ACTION_LABELS };
=======
module.exports = { logActivity, getActivity, getAllActivity, clearActivity, getSummary, ACTION_LABELS };
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
