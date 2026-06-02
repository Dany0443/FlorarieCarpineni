let allProducts = [];
let conditionalAbortController = null;
let telemetryReloadTimer = null;
let telemetryLoading = false;
let telemetryOverviewCache = null;
let dashboardLoading = false;
let dashboardReloadQueued = false;
const ADMIN_SOCKET_PATH = '/api/socket.io';

const toBase64Url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
const b64urlToBuffer = b64url => { if (!b64url) return null; const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/'); const padded = b64.padEnd(b64.length + (4 - b64.length % 4) % 4, '='); return Uint8Array.from(atob(padded), c => c.charCodeAt(0)); };
const urlBase64ToUint8Array = b64urlToBuffer;

function getSoundVolume() {
    const v = parseFloat(localStorage.getItem('admin_sound_vol'));
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.05;
}

function playSound(filename) {
    try {
        const audio = new Audio(`/assets/sounds/${filename}`);
        audio.volume = getSoundVolume();
        audio.play().catch(() => {}); // silently fail if autoplay blocked
    } catch (e) {}
}

// Keep legacy alias in case anything else calls it
const notificationSound = () => playSound('NewOrderSound.mp3');

let socket = null;

function bindSocketHandlers() {
    if (!socket) return;

    socket.on('connect', () => {
        console.log('[WS] Connected:', socket.id);
        scheduleTelemetryReload(250);
    });
    socket.on('disconnect', () => {
        console.log('[WS] Disconnected');
    });
    socket.on('connect_error', e => {
        console.warn('[WS] Connection error:', e.message);
    });

    socket.on('new_order', order => {
        notificationSound();
        toast(`Comanda noua: ${order.id} — ${order.customer?.name || 'Client'} — ${order.total} MDL`, 'success');
        if (typeof loadOrders === 'function') loadOrders();
        if (typeof loadDashboard === 'function' && isDashboardPageOpen()) loadDashboard({ showLoading: false });
    });
    socket.on('order_deleted', () => {
        if (typeof loadOrders === 'function') loadOrders();
        if (typeof loadDashboard === 'function' && isDashboardPageOpen()) loadDashboard({ showLoading: false });
    });
    socket.on('telemetry_ingest', payload => {
        scheduleTelemetryReload(220);
    });
    socket.on('telemetry_settings_update', payload => {
        if (payload && payload.settings && typeof payload.settings === 'object') {
            telemetrySettingsState = payload.settings;
            renderTelemetryToggle();
        }
        scheduleTelemetryReload(250);
    });

    // Server pushes updated device list whenever a new login happens on any device
    let _knownDeviceTokens = new Set();
    socket.on('devices_update', (devices) => {
        // Detect genuinely new devices (tokens we haven't seen before)
        if (_knownDeviceTokens.size > 0 && Array.isArray(devices)) {
            for (const d of devices) {
                if (!_knownDeviceTokens.has(d.token)) {
                    toast(`Dispozitiv nou conectat: ${d.name}`, 'success');
                    playSound('NewConnectedDevice.mp3');
                    break;
                }
            }
        }
        // Update known set
        if (Array.isArray(devices)) {
            _knownDeviceTokens = new Set(devices.map(d => d.token));
        }

        // Refresh list if settings page is currently visible
        const settingsPage = document.getElementById('page-settings');
        if (settingsPage && settingsPage.classList.contains('active')) {
            if (typeof loadPasskeysList === 'function') loadPasskeysList();
        }
    });

    // Seed known tokens on connect so the first update knows what's "new"
    fetch('/api/admops/passkeys', { credentials: 'include' })
        .then(r => r.json())
        .then(d => {
            if (d.success && Array.isArray(d.passkeys)) {
                _knownDeviceTokens = new Set(d.passkeys.map(p => p.deviceToken || p.credentialID));
            }
        })
        .catch(() => {});

    socket.on('connect', registerDeviceSocket);

    // Server fires this when the current device is revoked by another session.
    socket.on('force_logout', () => {
        toast('Dispozitiv revocat. Se deconectează...', 'error');
        setTimeout(() => {
            fetch('/api/admops/logout', { method: 'POST', credentials: 'include' })
                .finally(() => { window.location.href = '/login'; });
        }, 1500);
    });
}

async function maybeInitSocket() {
    try {
        const response = await fetch(`${ADMIN_SOCKET_PATH}/socket.io.js`, {
            credentials: 'include',
            cache: 'no-store'
        });
        if (!response.ok) {
            console.info('[WS] Socket endpoint unavailable.');
            return;
        }

        const contentType = (response.headers.get('content-type') || '').toLowerCase();
        if (!contentType.includes('javascript')) {
            console.info('[WS] Socket client script skipped (unexpected content type).');
            return;
        }

        const scriptText = await response.text();
        const blobUrl = URL.createObjectURL(new Blob([scriptText], { type: 'text/javascript' }));
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = blobUrl;
            script.async = true;
            script.onload = () => {
                URL.revokeObjectURL(blobUrl);
                resolve();
            };
            script.onerror = () => {
                URL.revokeObjectURL(blobUrl);
                reject(new Error('Socket loader failed'));
            };
            document.head.appendChild(script);
        });

        if (typeof window.io !== 'function') {
            console.info('[WS] Socket client missing io() global.');
            return;
        }

        socket = window.io({ path: ADMIN_SOCKET_PATH, withCredentials: true });
        bindSocketHandlers();
    } catch (err) {
        console.info('[WS] Realtime disabled for this session.');
    }
}

// ── Register this device with the server so it can be instantly kicked ────────
// Called after connect (and reconnect) so the room mapping survives WS restarts.
async function registerDeviceSocket() {
    if (!socket) return;
    try {
        const r = await fetch('/api/admops/my-device', { credentials: 'include' });
        const d = await r.json();
        if (d.success && d.device?.token) {
            socket.emit('register_device', d.device.token);
        }
    } catch (e) { /* not logged in yet — harmless */ }
}

// ── Volume control — injected into the settings page ─────────────────────────
function renderVolumeControl() {
    const slider = document.getElementById('sound-vol-slider');
    const label = document.getElementById('vol-label');
    const testBtn = document.getElementById('vol-test-btn');
    if (!slider || !label || !testBtn) return;
    const setSliderVisualFill = (pctValue) => {
        const safe = Math.max(0, Math.min(100, Number(pctValue) || 0));
        slider.style.setProperty('--slider-fill-pct', `${safe}%`);
    };

    const savedRaw = parseFloat(localStorage.getItem('admin_sound_vol'));
    const normalized = Number.isFinite(savedRaw) ? Math.max(0, Math.min(1, savedRaw)) : 0.05;
    if (!Number.isFinite(savedRaw)) {
        localStorage.setItem('admin_sound_vol', normalized.toFixed(2));
    }

    const pct = Math.round(normalized * 100);
    slider.value = String(pct);
    label.textContent = `${pct}%`;
    setSliderVisualFill(pct);

    if (slider.dataset.bound === '1') return;
    slider.dataset.bound = '1';

    slider.addEventListener('input', e => {
        const currentPct = parseInt(e.target.value, 10);
        const val = currentPct / 100;
        localStorage.setItem('admin_sound_vol', val.toFixed(2));
        label.textContent = `${currentPct}%`;
        setSliderVisualFill(currentPct);
    });

    testBtn.addEventListener('click', () => {
        playSound('NewOrderSound.mp3');
    });
}

function redirectToLogin() {
    window.location.href = '/login';
}

async function initAdmin() {
    const loader = document.getElementById('loader');
    try {
        const r = await fetch('/api/admops/orders', { credentials: 'include' });
        if (r.status === 401) { redirectToLogin(); }
        else {
            showAdmin();
            maybeInitSocket();
            initAdminPushNotifications();
        }
    } catch { redirectToLogin(); }
    finally {
        if (loader) { loader.classList.add('hidden'); setTimeout(() => loader.remove(), 520); }
    }
}

async function initAdminPushNotifications() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
    if (Notification.permission === 'denied') return;

    try {
        const reg = await navigator.serviceWorker.register('/private/sw-admin.js', { scope: '/private/' });
        if (Notification.permission === 'default') {
            const perm = await Notification.requestPermission();
            if (perm !== 'granted') return;
        }

        const keyRes = await fetch('/api/admops/vapid-key', { credentials: 'include' });
        const keyData = await keyRes.json();
        if (!keyData.success || !keyData.publicKey) return;

        const existing = await reg.pushManager.getSubscription();
        const sub = existing || await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(keyData.publicKey)
        });

        await fetch('/api/push/subscribe', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sub.toJSON())
        });
        console.log('[Push] Admin notifications ready');
    } catch (e) {
        console.warn('[Push] Admin subscribe failed:', e);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdmin);
} else {
    initAdmin();
}

function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function toAbsoluteAssetUrl(rawUrl) {
    const v = String(rawUrl || '').trim();
    if (!v) return '';
    if (/^(https?:)?\/\//i.test(v) || v.startsWith('data:') || v.startsWith('blob:') || v.startsWith('/')) return v;
    return `/${v.replace(/^\.?\//, '')}`;
}

function toast(msg, type='') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = `toast ${type} show`;
    clearTimeout(el._t);
    el._t = setTimeout(() => el.className = 'toast', 3000);
}

async function api(path, opt = {}) {
    opt.headers = { ...opt.headers, 'Content-Type': 'application/json' };
    const res = await fetch(path, opt);
    if (res.status === 401) { redirectToLogin(); throw new Error('Unauthorized'); }
    return res.json();
}

async function checkAuthMethods() {
    try {
        const d = await fetch('/api/admops/auth-methods').then(r => r.json());
        return d.methods || ['password'];
    } catch { return ['password']; }
}

function showLoginScreen() {
    document.getElementById('admin-screen').classList.remove('visible');
    document.getElementById('admin-screen').style.display = 'none';
    const ls = document.getElementById('login-screen');
    ls.style.display = 'flex';
    ls.classList.add('visible');
    renderLoginForm();
}

async function renderLoginForm() {
    const methods = await checkAuthMethods();
    const hasPasskey = methods.includes('passkey');
    const pwField = document.getElementById('pw-field');
    const passkeyBtn = document.getElementById('passkey-btn');
    const divider = document.getElementById('login-divider');
    pwField.style.display = 'block';
    passkeyBtn.style.display = hasPasskey ? 'flex' : 'none';
    divider.style.display = hasPasskey ? 'block' : 'none';

    // Conditional mediation: browser silently autofills passkey when user taps the username field
    // Uses its own options fetch so it doesn't share rate limit with explicit login attempts
    if (hasPasskey && window.PublicKeyCredential && await PublicKeyCredential.isConditionalMediationAvailable()) {
        try {
            const optsRes = await fetch('/api/admops/webauthn/auth-options', { credentials: 'include' });
            const opts = await optsRes.json();
            if (!opts.challenge) return;
            const authOpts = {
                challenge: b64urlToBuffer(opts.challenge),
                rpId: opts.rpId,
                allowCredentials: (opts.allowCredentials || []).map(c => ({ ...c, id: b64urlToBuffer(c.id) })),
                userVerification: opts.userVerification || 'preferred',
                timeout: opts.timeout
            };
            if (conditionalAbortController) conditionalAbortController.abort();
            conditionalAbortController = new AbortController();
            const credential = await navigator.credentials.get({
                publicKey: authOpts,
                mediation: 'conditional',
                signal: conditionalAbortController.signal
            });
            if (credential) await submitPasskeyCredential(credential);
        } catch (e) {
            if (e.name !== 'AbortError') console.log('Passkey autofill aborted or failed:', e.message);
        }
    }
}

async function doLogin() {
    const username = document.getElementById('u').value.trim();
    const password = document.getElementById('p').value;
    const rememberMeToggle = document.getElementById('remember-me-toggle');
    const rememberMe = rememberMeToggle ? rememberMeToggle.getAttribute('data-active') === 'true' : false;
    const errEl = document.getElementById('login-err');
    const btn = document.getElementById('login-btn');
    if (!username || !password) { errEl.textContent = 'Completează toate câmpurile.'; errEl.style.display = 'block'; return; }
    btn.textContent = '...'; btn.disabled = true;
    try {
        const res = await fetch('/api/admops/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, password, rememberMe })
        });
        const d = await res.json();
        if (d.success) { location.reload(); }
        else { errEl.textContent = d.error || 'Eroare.'; errEl.style.display = 'block'; }
    } catch {
        errEl.textContent = 'Server indisponibil.'; errEl.style.display = 'block';
    } finally { btn.textContent = 'Intră'; btn.disabled = false; }
}

async function doPasskey() {
    // Cancel any pending conditional autofill before starting explicit flow
    if (conditionalAbortController) { conditionalAbortController.abort(); conditionalAbortController = null; }
    const errEl = document.getElementById('login-err');
    const btn = document.getElementById('passkey-btn');
    errEl.style.display = 'none';
    btn.disabled = true; btn.textContent = 'Se așteaptă passkey...';
    try {
        const optsRes = await fetch('/api/admops/webauthn/auth-options', { credentials: 'include' });
        const opts = await optsRes.json();
        if (!opts.challenge) throw new Error(opts.error || 'Nu pot genera opțiunile WebAuthn.');
        const authOpts = {
            challenge: b64urlToBuffer(opts.challenge),
            rpId: opts.rpId,
            allowCredentials: (opts.allowCredentials || []).map(c => ({ ...c, id: b64urlToBuffer(c.id) })),
            userVerification: opts.userVerification || 'preferred',
            timeout: opts.timeout
        };
        const credential = await navigator.credentials.get({ publicKey: authOpts });
        await submitPasskeyCredential(credential, errEl);
    } catch (e) {
        if (e.name === 'NotAllowedError') {
            errEl.textContent = 'Ai anulat cererea. Încearcă din nou sau folosește parola.';
        } else {
            errEl.textContent = e.message || 'Eroare passkey.';
        }
        errEl.style.display = 'block';
    } finally { btn.disabled = false; btn.textContent = 'Intră cu Passkey'; }
}

// Shared function: submits a resolved credential to verify-authentication
async function submitPasskeyCredential(credential, errEl) {
    const credJSON = {
        id: credential.id,
        rawId: toBase64Url(credential.rawId),
        type: credential.type,
        response: {
            authenticatorData: toBase64Url(credential.response.authenticatorData),
            clientDataJSON:    toBase64Url(credential.response.clientDataJSON),
            signature:         toBase64Url(credential.response.signature),
            userHandle: credential.response.userHandle ? toBase64Url(credential.response.userHandle) : null
        },
        clientExtensionResults: credential.getClientExtensionResults()
    };
    const verifyRes = await fetch('/api/admops/webauthn/verify-authentication', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ credential: credJSON })
    });
    const verifyData = await verifyRes.json();
    if (verifyData.success) {
        location.reload();
    } else if (errEl) {
        errEl.textContent = verifyData.error || 'Autentificare eșuată.';
        errEl.style.display = 'block';
    }
}

/**
 * Detect a human-readable device name on the client side.
 * Uses the modern navigator.userAgentData API first (Chromium 90+) — this exposes the real
 * brand list so Brave, Edge, and Opera are correctly identified even though their UA strings
 * are identical to Chrome.  Falls back to classic UA sniffing for Firefox and Safari.
 */
async function detectClientDeviceName() {
    const ua = navigator.userAgent || '';
    const platformRaw = navigator.platform || '';
    const linuxDistros = [
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
    const browserPatterns = [
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

    function linuxDistro() {
        for (const [name, pattern] of linuxDistros) {
            if (pattern.test(ua)) return name;
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

    function androidModel() {
        const match = /\(([^)]*Android[^)]*)\)/i.exec(ua);
        if (!match) return '';
        const parts = match[1].split(';').map(cleanAndroidModel).filter(Boolean);
        const androidIndex = parts.findIndex(p => /^Android\b/i.test(p));
        const candidates = parts.slice(androidIndex + 1)
            .filter(p => !/^(mobile|tablet|wv|linux|en[-_][a-z]+)$/i.test(p));
        const raw = candidates[0] || '';
        if (!raw) return '';
        if (/^(?:samsung\s+)?sm-|^gt-|^samsung\b/i.test(raw)) return raw.toLowerCase().startsWith('samsung') ? raw : `Samsung ${raw}`;
        if (/^pixel\b/i.test(raw)) return raw.replace(/^Pixel/i, 'Google Pixel');
        if (/^oneplus\b|^(?:kb|in|hd|gm|ne)\d{4}/i.test(raw)) return raw.toLowerCase().startsWith('oneplus') ? raw : `OnePlus ${raw}`;
        if (/^(?:mi|m210|m200|m190|redmi|poco)\b/i.test(raw)) return raw;
        if (/^(?:huawei|ane-|vog-|lya-|ele-|clt-|mar-|was-)/i.test(raw)) return raw.toLowerCase().startsWith('huawei') ? raw : `Huawei ${raw}`;
        if (/^honor\b|^(?:bnd-|jsn-|yal-)/i.test(raw)) return raw.toLowerCase().startsWith('honor') ? raw : `Honor ${raw}`;
        if (/^(?:oppo|cph|pch|pgm|pgt|peh|pfem|pffm)/i.test(raw)) return raw.toLowerCase().startsWith('oppo') ? raw : `OPPO ${raw}`;
        if (/^(?:realme|rmx)/i.test(raw)) return raw.toLowerCase().startsWith('realme') ? raw : `Realme ${raw}`;
        if (/^(?:moto|motorola|xt\d)/i.test(raw)) return raw.toLowerCase().startsWith('motorola') ? raw.replace(/^motorola/i, 'Motorola') : `Motorola ${raw}`;
        return raw;
    }

    function browserFromUa() {
        for (const [name, pattern] of browserPatterns) {
            if (!pattern.test(ua)) continue;
            if (name === 'Safari' && /Chrome\/|Chromium\/|OPR\/|Edg\/|SamsungBrowser\/|YaBrowser\/|UCBrowser\//.test(ua)) continue;
            return name;
        }
        return 'Browser';
    }

    let os = 'Dispozitiv';
    if (/CrOS/i.test(ua))                    os = 'Chrome OS';
    else if (/Android/i.test(ua))            os = 'Android';
    else if (/iPad/i.test(ua) || (platformRaw === 'MacIntel' && navigator.maxTouchPoints > 1)) os = 'iPad';
    else if (/iPhone/i.test(ua))             os = 'iPhone';
    else if (/Windows/.test(ua))             os = 'Windows';
    else if (/Mac OS X|Macintosh/i.test(ua)) os = 'Mac';
    else if (linuxDistro())                  os = linuxDistro();
    else if (/Linux|X11/i.test(ua))          os = 'Linux';

    let browser = 'Browser';

    // ── Browser via userAgentData (Chromium-based browsers) ──────────────────
    if (navigator.userAgentData) {
        try {
            const hints = await navigator.userAgentData.getHighEntropyValues(['platform', 'brands', 'mobile']);
            const brands = (hints.brands || navigator.userAgentData.brands || [])
                .map(b => b.brand.toLowerCase());

            const platform = (hints.platform || navigator.userAgentData.platform || '').toLowerCase();
            if (platform) {
                if (/android/.test(platform)) os = 'Android';
                else if (/chrome os/.test(platform)) os = 'Chrome OS';
                else if (/win/.test(platform)) os = 'Windows';
                else if (/ios/.test(platform)) os = os === 'iPad' ? 'iPad' : 'iPhone';
                else if (/mac/.test(platform) && os !== 'iPad') os = 'Mac';
                else if (/linux/.test(platform)) os = linuxDistro() || 'Linux';
            }

            if (brands.some(b => b.includes('brave'))) browser = 'Brave';
            else if (brands.some(b => b.includes('microsoft edge'))) browser = 'Edge';
            else if (brands.some(b => b.includes('opera'))) browser = 'Opera';
            else if (brands.some(b => b.includes('vivaldi'))) browser = 'Vivaldi';
            else if (brands.some(b => b.includes('duckduckgo'))) browser = 'DuckDuckGo';
            else if (brands.some(b => b.includes('google chrome'))) browser = 'Chrome';
            else if (brands.some(b => b.includes('chromium'))) browser = 'Chromium';
        } catch (e) { /* fall through */ }
    }

    // ── UA string fallback (Firefox, Safari, iOS browsers, older Chromium) ───
    if (browser === 'Browser' || browser === 'Chromium') browser = browserFromUa();

    return `${androidModel() || os} (${browser})`;
}

async function doRegisterPasskey() {
    const btn = document.getElementById('add-passkey-btn');

    // Three-attempt strategy for NotReadableError / UnknownError:
    //
    //  #1  Normal or pre-cleared: uv=preferred  ± excludeCredentials
    //       → if a passkey is already registered on this site we skip the exclude list
    //         immediately, because Chrome/Android throws NotReadableError (instead of
    //         the spec-correct InvalidStateError) when a matching ID is in the list.
    //  #2  Relax UV:              uv=discouraged + full excludeCredentials
    //       → fixes Android devices where the biometrics prompt blocks creation
    //  #3  Relax UV + clear list: uv=discouraged + empty excludeCredentials
    //       → last-resort combination
    //
    // The loop owns the button state so there is no finally-block race.

    // Pre-flight: find out whether this site already has passkeys registered.
    // If so, skip excludeCredentials from attempt 1 to avoid the Chrome/Android bug.
    let hasExistingCreds = false;
    try {
        const checkRes = await fetch('/api/admops/auth-methods');
        const checkData = await checkRes.json();
        hasExistingCreds = (checkData.methods || []).includes('passkey');
    } catch (_) { /* non-fatal — proceed conservatively */ }

    const ATTEMPTS = [
        { uv: null,          clearExclude: hasExistingCreds },  // skip exclude list if creds exist
        { uv: 'discouraged', clearExclude: false },
        { uv: 'discouraged', clearExclude: true  },
    ];

    if (btn) { btn.disabled = true; btn.textContent = 'Se înregistrează...'; }

    let lastError = null;

    for (let i = 0; i < ATTEMPTS.length; i++) {
        const { uv, clearExclude } = ATTEMPTS[i];

        try {
            const params = new URLSearchParams();
            if (uv)           params.set('uv', uv);
            if (clearExclude) params.set('clearExclude', '1');
            const qs = params.toString();
            const optsRes = await fetch('/api/admops/webauthn/register-options' + (qs ? '?' + qs : ''), { credentials: 'include' });
            const opts = await optsRes.json();
            if (!opts.challenge) throw new Error(opts.error || 'Eroare generare opțiuni.');

            const regOpts = {
                ...opts,
                challenge: b64urlToBuffer(opts.challenge),
                user: { ...opts.user, id: b64urlToBuffer(opts.user.id) }
            };
            if (regOpts.excludeCredentials) {
                regOpts.excludeCredentials = regOpts.excludeCredentials.map(c => ({
                    ...c,
                    id: b64urlToBuffer(c.id)
                }));
            }

            const credential = await navigator.credentials.create({ publicKey: regOpts });
            const transports = credential.response?.getTransports?.() ?? ['internal'];
            const deviceName = await detectClientDeviceName();
            const credJSON = {
                id: credential.id,
                rawId: toBase64Url(credential.rawId),
                type: credential.type,
                response: {
                    attestationObject: toBase64Url(credential.response.attestationObject),
                    clientDataJSON:    toBase64Url(credential.response.clientDataJSON)
                },
                transports,
                deviceName
            };

            const verifyRes = await fetch('/api/admops/webauthn/verify-registration', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ credential: credJSON })
            });
            const verifyData = await verifyRes.json();
            if (verifyData.success) {
                localStorage.setItem('passkeyRegisteredHere', 'true');
                toast('Passkey înregistrat cu succes pe acest dispozitiv!', 'success');
                location.reload();
                return; // done
            }
            throw new Error(verifyData.error || 'Înregistrare eșuată.');

        } catch (e) {
            lastError = e;
            console.error(`Passkey registration attempt ${i + 1}/${ATTEMPTS.length} failed:`, {
                name: e.name, message: e.message
            });

            // Non-retryable errors: bail out immediately
            if (e.name === 'InvalidStateError') {
                localStorage.setItem('passkeyRegisteredHere', 'true');
                toast('Passkey deja înregistrat pe acest dispozitiv!', 'success');
                checkCurrentDevicePasskey();
                if (btn) { btn.disabled = false; btn.textContent = '+ Adaugă Passkey'; }
                return;
            }
            if (e.name === 'NotAllowedError') {
                toast('Înregistrare anulată.', 'error');
                if (btn) { btn.disabled = false; btn.textContent = '+ Adaugă Passkey'; }
                return;
            }

            // Retryable (NotReadableError / UnknownError): try next attempt
            const isRetryable = e.name === 'NotReadableError' || e.name === 'UnknownError';
            const hasMore = i < ATTEMPTS.length - 1;
            if (isRetryable && hasMore) {
                if (btn) btn.textContent = `Se reîncearcă... (${i + 2}/${ATTEMPTS.length})`;
                toast(`Încercare ${i + 1} eșuată, se reîncearcă cu setări alternative...`, '');
                await new Promise(r => setTimeout(r, 800));
                continue;
            }

            // All attempts exhausted — surface diagnostics
            if (isRetryable) {
                toast(
                    'Credential Manager inaccesibil după 3 încercări. ' +
                    'Verificați: 1) aveți PIN/amprentă activ pe dispozitiv, ' +
                    '2) pe Android, sunteți logat cu un cont Google. ' +
                    `(${e.name})`,
                    'error'
                );
            } else {
                toast(`${e.name || 'Error'}: ${e.message || 'Eroare passkey.'}`, 'error');
            }
        }
    }

    if (btn) { btn.disabled = false; btn.textContent = '+ Adaugă Passkey'; }
}

function doLogout() {
    fetch('/api/admops/logout', { method: 'POST', credentials: 'include' }).then(() => location.reload());
}

function showAdmin() {
    const loginScreen = document.getElementById('login-screen');
    if (loginScreen) {
        loginScreen.classList.remove('visible');
        loginScreen.style.display = 'none';
    }
    const adminScreen = document.getElementById('admin-screen');
    if (adminScreen) adminScreen.classList.add('visible');
    // Restore the page from URL on initial load
    const urlPage = new URLSearchParams(window.location.search).get('page');
    const validPages = ['dashboard', 'orders', 'products', 'telemetry', 'settings'];
    const startPage = validPages.includes(urlPage) ? urlPage : 'dashboard';
    navigate(startPage, false);
    loadProducts(); // preload so edit works from any tab
}

function navigate(page, pushState = true) {
    document.querySelectorAll('.nav-tab,.btab').forEach(t => t.classList.toggle('active', t.dataset.page===page));
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id===`page-${page}`));
    if (pushState) history.pushState({ page }, '', `?page=${page}`);
    if (page==='dashboard') loadDashboard({ showLoading: true });
    if (page==='orders')    loadOrders();
    if (page==='products')  loadProducts();
    if (page==='telemetry') loadTelemetry();
    if (page==='settings')  { renderVolumeControl(); loadPasskeysList(); checkCurrentDevicePasskey(); loadTelemetry(); }
}
document.querySelectorAll('.nav-tab,.btab').forEach(t => t.addEventListener('click', ()=>navigate(t.dataset.page)));

// Handle browser back/forward buttons
window.addEventListener('popstate', e => {
    if (e.state?.page) navigate(e.state.page, false);
});

function fmtDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('ro-RO')+' '+d.toLocaleTimeString('ro-RO',{hour:'2-digit',minute:'2-digit'});
}

let telemetrySettingsState = null;
let _tm2Chart = null;
let telemetryHydrated = false;

function isTelemetryPageOpen() {
    const telemetryPage = document.getElementById('page-telemetry');
    return Boolean(telemetryPage && telemetryPage.classList.contains('active'));
}

function isDashboardPageOpen() {
    const dashboardPage = document.getElementById('page-dashboard');
    return Boolean(dashboardPage && dashboardPage.classList.contains('active'));
}

function scheduleTelemetryReload(delay = 0) {
    clearTimeout(telemetryReloadTimer);
    telemetryReloadTimer = setTimeout(() => {
        if (!isTelemetryPageOpen() && !isDashboardPageOpen()) return;
        if (telemetryLoading) {
            scheduleTelemetryReload(150);
            return;
        }
        loadTelemetry();
    }, Math.max(0, delay));
}

function tmDecode(str) {
    if (!str) return '';
    const ta = document.createElement('textarea');
    ta.innerHTML = String(str);
    return ta.value;
}

function fmtTelemetryNumber(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n.toLocaleString('ro-RO') : '—';
}
function fmtTelemetryPct(v) {
    const n = Number(v);
    return Number.isFinite(n) ? `${n.toFixed(1)}%` : '—';
}
function fmtTelemetryMs(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return '—';
    return n < 1000 ? `${Math.round(n)} ms` : `${(n / 1000).toFixed(2)} s`;
}

function renderTelemetryToggle() {
    const btn = document.getElementById('settings-telemetry-enable-btn');
    const btnText = document.getElementById('settings-telemetry-enable-label');
    const status = document.getElementById('settings-telemetry-status');
    if (!btn || !btnText || !status) return;

    if (telemetrySettingsState == null) {
        btn.disabled = true;
        btn.classList.remove('is-on');
        btn.setAttribute('aria-checked', 'false');
        btnText.textContent = '...';
        status.textContent = 'Se încarcă setările...';
        return;
    }

    const enabled = telemetrySettingsState.enabled !== false;
    btn.disabled = false;
    btn.classList.toggle('is-on', enabled);
    btn.setAttribute('aria-checked', enabled ? 'true' : 'false');
    btnText.textContent = enabled ? 'Activ' : 'Oprit';
    status.textContent = enabled
        ? 'Colectarea este activă.'
        : 'Colectarea este oprită. Evenimentele noi nu vor mai fi stocate.';
}

function tmBarList(items, { max: explicitMax, suffix = '', colorClass = '' } = {}) {
    if (!items || !items.length) return `<div class="tm2-empty">Fără date</div>`;
    const max = explicitMax ?? Math.max(...items.map(i => Number(i.value) || 0), 1);
    return `<div class="tm2-bar-list">${items.map(({ name, value }) => {
        const n   = Number(value) || 0;
        const pct = Math.round((n / max) * 100);
        const displayVal = suffix ? `${fmtTelemetryNumber(n)} ${suffix}` : fmtTelemetryNumber(n);
        return `
        <div class="tm2-bar-item">
          <div class="tm2-bar-item-row">
            <span class="tm2-bar-name" title="${esc(name)}">${esc(name)}</span>
            <span class="tm2-bar-num">${esc(displayVal)}</span>
          </div>
          <div class="tm2-bar-track">
            <div class="tm2-bar-fill ${colorClass}" style="width:${pct}%"></div>
          </div>
        </div>`;
    }).join('')}</div>`;
}

function tmStatRow(k, v) {
    return `<div class="tm2-stat-row"><span class="tm2-stat-k">${esc(k)}</span><span class="tm2-stat-v">${esc(String(v))}</span></div>`;
}

function tmSetHtml(id, html) {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.innerHTML !== html) el.innerHTML = html;
}

function telemetryTotalVisits(data) {
    const overview = data?.overview || {};
    if (Number.isFinite(Number(overview.totalVisits))) return Number(overview.totalVisits);
    const insights = data?.insights || {};
    if (Number.isFinite(Number(insights.pageViews))) return Number(insights.pageViews);
    const daily = Array.isArray(data?.dailySummary) ? data.dailySummary : [];
    return daily.reduce((sum, row) => sum + (Number(row?.visits) || 0), 0);
}

function tmFunnelStep(label, count, baseCount, barClass = '') {
    const pct    = baseCount > 0 ? Math.round((count / baseCount) * 100) : 0;
    const width  = baseCount > 0 ? pct : (count > 0 ? 100 : 0);
    return `
    <div class="tm2-funnel-step">
      <div class="tm2-funnel-label-row">
        <span class="tm2-funnel-name">${esc(label)}</span>
        <span class="tm2-funnel-count">${fmtTelemetryNumber(count)}</span>
      </div>
      <div class="tm2-funnel-bar-bg">
        <div class="tm2-funnel-bar ${barClass}" style="width:${width}%"></div>
      </div>
      ${baseCount > 0 ? `<span class="tm2-funnel-rate">${pct}% din vizualizări</span>` : ''}
    </div>`;
}

function tmVitalPill(name, value, samples) {
    if (value === null || value === undefined) {
        return `<div class="tm2-vital-pill tm2-na">
          <div class="tm2-vital-name">${esc(name)}</div>
          <div class="tm2-vital-val">—</div>
        </div>`;
    }
    let cls = 'tm2-good', display = '';
    if (name === 'LCP') {
        display = fmtTelemetryMs(value);
        cls = value < 2500 ? 'tm2-good' : value < 4000 ? 'tm2-ok' : 'tm2-bad';
    } else if (name === 'FCP') {
        display = fmtTelemetryMs(value);
        cls = value < 1800 ? 'tm2-good' : value < 3000 ? 'tm2-ok' : 'tm2-bad';
    } else if (name === 'CLS') {
        display = Number(value).toFixed(3);
        cls = value < 0.1 ? 'tm2-good' : value < 0.25 ? 'tm2-ok' : 'tm2-bad';
    }
    return `<div class="tm2-vital-pill ${cls}">
      <div class="tm2-vital-name">${esc(name)}</div>
      <div class="tm2-vital-val">${esc(display)}</div>
    </div>`;
}

function tmDonut(desktop, mobile, tablet = 0) {
    const total = desktop + mobile + tablet;
    if (!total) return '';
    const circ  = 2 * Math.PI * 22;

    const slices = [
        { val: desktop, color: 'var(--p)',    label: 'Desktop' },
        { val: mobile,  color: '#f59e0b',     label: 'Mobile' },
        { val: tablet,  color: '#22c55e',     label: 'Tabletă' },
    ].filter(s => s.val > 0);

    let offset = 0;
    const paths = slices.map(s => {
        const len   = (s.val / total) * circ;
        const dash  = `${len} ${circ - len}`;
        const path  = `<circle cx="30" cy="30" r="22" fill="none" stroke="${s.color}" stroke-width="10" stroke-dasharray="${dash}" stroke-dashoffset="${-offset}" />`;
        offset += len;
        return path;
    });

    const legend = slices.map(s => `
      <div class="tm2-donut-item">
        <span class="tm2-dot" style="background:${s.color}"></span>
        <span>${esc(s.label)}: <strong>${fmtTelemetryNumber(s.val)}</strong></span>
      </div>`).join('');

    return `<div class="tm2-donut-wrap">
      <div class="tm2-donut">
        <svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">${paths.join('')}</svg>
      </div>
      <div class="tm2-donut-legend">${legend}</div>
    </div>`;
}

function renderTm2Chart(dailySummary) {
    const canvas = document.getElementById('tm2-chart');
    const empty  = document.getElementById('tm2-chart-empty');
    if (!canvas) return;

    const rows = Array.isArray(dailySummary) ? dailySummary : [];
    if (!rows.length) {
        canvas.style.display = 'none';
        if (empty) empty.style.display = '';
        return;
    }
    if (empty) empty.style.display = 'none';
    canvas.style.display = '';

    const labels = rows.map(d => {
        const [, m, day] = d.date.split('-');
        return `${day}/${m}`;
    });
    const data = rows.map(d => d.visits || 0);

    const style  = getComputedStyle(document.documentElement);
    const accent = style.getPropertyValue('--p').trim() || '#aa0132';
    const sub    = style.getPropertyValue('--sub').trim() || '#999';
    const border = style.getPropertyValue('--border').trim() || '#ddd';

    if (typeof Chart === 'undefined') {
        canvas.style.display = 'none';
        if (empty) { empty.textContent = 'Chart.js missing — adauga script in head.'; empty.style.display = ''; }
        return;
    }

    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 220);
    gradient.addColorStop(0, accent + '44');
    gradient.addColorStop(1, accent + '00');

    if (_tm2Chart) {
        const ds = _tm2Chart.data.datasets[0];
        _tm2Chart.data.labels = labels;
        ds.data = data;
        ds.borderColor = accent;
        ds.backgroundColor = gradient;
        ds.pointBackgroundColor = accent;
        ds.pointHoverBackgroundColor = accent;
        ds.pointRadius = data.map(v => v > 0 ? 3 : 0);

        if (_tm2Chart.options?.scales?.x?.ticks) _tm2Chart.options.scales.x.ticks.color = sub;
        if (_tm2Chart.options?.scales?.y?.ticks) _tm2Chart.options.scales.y.ticks.color = sub;
        if (_tm2Chart.options?.scales?.y?.grid) _tm2Chart.options.scales.y.grid.color = border;

        _tm2Chart.update('none');
        return;
    }

    _tm2Chart = new Chart(canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                data,
                borderColor: accent,
                borderWidth: 2,
                backgroundColor: gradient,
                fill: true,
                tension: 0.4,
                pointRadius: data.map(v => v > 0 ? 3 : 0),
                pointBackgroundColor: accent,
                pointBorderColor: 'transparent',
                pointHoverRadius: 5,
                pointHoverBackgroundColor: accent,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 4,
            animation: { duration: 380, easing: 'easeOutQuad' },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.75)',
                    padding: 10,
                    cornerRadius: 8,
                    callbacks: {
                        title: ctx => ctx[0]?.label ?? '',
                        label: ctx => ` ${ctx.raw} vizite`
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: sub,
                        font: { size: 10 },
                        maxRotation: 0,
                        callback(val, idx) { return idx % 5 === 0 ? this.getLabelForValue(val) : ''; }
                    },
                    grid: { display: false },
                    border: { display: false }
                },
                y: {
                    beginAtZero: true,
                    ticks: { color: sub, font: { size: 10 }, precision: 0, maxTicksLimit: 4 },
                    grid: { color: border },
                    border: { display: false }
                }
            }
        }
    });
}

function telemetryPerfSummary(webVitals, insights) {
    const lcp = Number(webVitals?.lcp);
    const fcp = Number(webVitals?.fcp);
    const cls = Number(webVitals?.cls);
    const samples = webVitals?.samples || {};
    const probes = (Number(samples.lcp) || 0) + (Number(samples.fcp) || 0) + (Number(samples.cls) || 0);

    let score = 0;
    let checks = 0;

    if (Number.isFinite(lcp)) {
        checks++;
        score += lcp < 2500 ? 2 : (lcp < 4000 ? 1 : 0);
    }
    if (Number.isFinite(fcp)) {
        checks++;
        score += fcp < 1800 ? 2 : (fcp < 3000 ? 1 : 0);
    }
    if (Number.isFinite(cls)) {
        checks++;
        score += cls < 0.1 ? 2 : (cls < 0.25 ? 1 : 0);
    }

    let level = 'Date insuficiente';
    let levelClass = 'is-mid';
    let tip = 'Continuă colectarea datelor pentru un verdict stabil.';
    if (checks > 0) {
        const ratio = score / (checks * 2);
        if (ratio >= 0.75) {
            level = 'Experiență rapidă';
            levelClass = 'is-good';
            tip = 'Site-ul răspunde bine pe majoritatea dispozitivelor.';
        } else if (ratio >= 0.45) {
            level = 'Experiență bună';
            levelClass = 'is-mid';
            tip = 'Performanța este bună, dar există loc de optimizare.';
        } else {
            level = 'Necesită optimizare';
            levelClass = 'is-bad';
            tip = 'Merită optimizate imaginile și scripturile de încărcare.';
        }
    }

    const speedText = Number.isFinite(lcp) ? fmtTelemetryMs(lcp) : '—';
    const pageTime = fmtTelemetryMs(insights?.avgTimeOnPageMs);

    return `
      <div class="tm2-health-card ${levelClass}">
        <div class="tm2-health-top">
          <span class="tm2-health-badge">${esc(level)}</span>
          <span class="tm2-health-meta">${fmtTelemetryNumber(probes)} probe</span>
        </div>
        <p class="tm2-health-note">${esc(tip)}</p>
      </div>
      ${tmStatRow('Încărcare percepută', speedText)}
      ${tmStatRow('Timp mediu pe pagină', pageTime)}
      ${tmStatRow('Vizualizări produse', fmtTelemetryNumber(insights?.productViews))}
    `;
}

function renderTelemetryInsights(d) {
    const insights = d.insights || {};
    const webVitals = d.webVitals || {};
    const device = d.deviceBreakdown || {};
    const topProducts = d.topProducts || [];
    const countryBD = d.countryBreakdown || {};

    const countryItems = Object.entries(countryBD)
        .map(([k, v]) => ({ name: k === 'unknown' ? 'Necunoscut' : k, value: v }))
        .slice(0, 5);
    const osItems = Object.entries(device.os || {}).map(([k, v]) => ({ name: k, value: v }));
    const desktop = Number(device.desktop) || 0;
    const mobile = Number(device.mobile) || 0;
    const tablet = Number(device.tablet) || 0;

    tmSetHtml('tm2-audience-body', `
      ${tmDonut(desktop, mobile, tablet)}
      <div class="tm2-sec-label">Sesiuni</div>
      ${tmStatRow('Total sesiuni', fmtTelemetryNumber(insights.sessions))}
      ${tmStatRow('Active (24h)', fmtTelemetryNumber(insights.activeSessions24h))}
      ${tmStatRow('Vizite magazin', fmtTelemetryNumber(insights.storefrontViews))}
      ${tmStatRow('Vizite admin', fmtTelemetryNumber(insights.adminViews))}
      ${countryItems.length ? `<div class="tm2-sec-label">Țări top</div>${tmBarList(countryItems)}` : ''}
      ${osItems.length ? `<div class="tm2-sec-label">Sisteme de operare</div>${tmBarList(osItems)}` : ''}
    `);

    const prodItems = topProducts.slice(0, 8).map(p => ({
        name: p.name || p.id,
        value: Number(p.views) || 0
    }));
    const prodDetail = topProducts.slice(0, 5).map(p =>
        tmStatRow(p.name || p.id, `${fmtTelemetryNumber(p.views)} vizualizări`)
    ).join('');

    tmSetHtml(
        'tm2-products-body',
        prodItems.length
            ? `${tmBarList(prodItems)}<hr class="tm2-divider"><div class="tm2-sec-label">Detaliu vizualizări</div>${prodDetail}`
            : `<div class="tm2-empty">Niciun eveniment produs.</div>`
    );

    tmSetHtml('tm2-webperf-body', telemetryPerfSummary(webVitals, insights));
}

async function loadTelemetry() {
    if (telemetryLoading) return;
    const telemetryVisible = isTelemetryPageOpen();
    if (telemetrySettingsState == null) {
        renderTelemetryToggle();
    }
    telemetryLoading = true;

    try {
        const d = await api('/api/admops/telemetry/overview');
        if (!d.success) throw new Error(d.error || 'Telemetry unavailable');

        telemetryOverviewCache = d;
        telemetrySettingsState = d.settings || { enabled: true };
        renderTelemetryToggle();
        renderDashboardTelemetry(d);

        if (!telemetryVisible) return;

        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

        const enabled = telemetrySettingsState.enabled !== false;
        set('tm2-status', enabled ? 'Activ' : 'Oprit');
        document.getElementById('tm2-status')?.classList.toggle('c-green', enabled);
        set('tm2-visits-total', fmtTelemetryNumber(telemetryTotalVisits(d)));
        set('tm2-events-today',  fmtTelemetryNumber(d.overview?.eventsToday ?? 0));
        set('tm2-visits-today',  fmtTelemetryNumber(d.overview?.todayVisits ?? 0));
        set('tm2-sessions-live', fmtTelemetryNumber(d.insights?.activeSessions24h ?? 0));

        const syncEl = document.getElementById('tm2-last-sync-label');
        if (syncEl) {
            syncEl.textContent = d.overview?.lastSyncAt
                ? `Ultima sincronizare: ${new Date(d.overview.lastSyncAt).toLocaleString('ro-RO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
                : 'Ultima sincronizare: —';
        }

        renderTm2Chart(d.dailySummary || []);
        renderTelemetryInsights(d);
        telemetryHydrated = true;

    } catch (err) {
        console.error('[Telemetry]', err);
        if (telemetryVisible && !telemetryHydrated) {
            ['tm2-status', 'tm2-visits-total', 'tm2-events-today', 'tm2-visits-today', 'tm2-sessions-live']
                .forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '—'; });
            ['tm2-audience-body', 'tm2-webperf-body', 'tm2-products-body']
                .forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = '<div class="tm2-empty">Eroare la încărcarea datelor.</div>'; });
        }
    } finally {
        telemetryLoading = false;
    }
}

async function toggleTelemetryEnabled() {
    const buttons = [document.getElementById('settings-telemetry-enable-btn')].filter(Boolean);
    if (!buttons.length) return;
    if (telemetrySettingsState == null) return;
    const currentEnabled = !(telemetrySettingsState && telemetrySettingsState.enabled === false);
    buttons.forEach(btn => { btn.disabled = true; });
    try {
        const d = await api('/api/admops/telemetry/settings', {
            method: 'PUT',
            body: JSON.stringify({ enabled: !currentEnabled })
        });
        if (d.success) {
            telemetrySettingsState = d.settings;
            renderTelemetryToggle();
            toast(telemetrySettingsState.enabled === false ? 'Telemetry oprit.' : 'Telemetry activat.', 'success');
            scheduleTelemetryReload(0);
        } else {
            toast(d.error || 'Nu am putut actualiza telemetry.', 'error');
        }
    } catch {
        toast('Eroare la actualizarea telemetry.', 'error');
    } finally {
        buttons.forEach(btn => { btn.disabled = false; });
    }
}

function catBadge(cat) {
    const c = cat||'General';
    return `<span class="badge b-${esc(c)}">${esc(c)}</span>`;
}

function renderOrderCardFull(o) {
    const items = (o.cart||[]).map(i=>`${esc(i.name)} ×${esc(i.qty)}`).join(', ');
    return `<div class="ocard">
    <div class="ocard-top"><div class="ocard-name">${esc(o.customer?.name||'—')}</div><div class="ocard-total">${esc(o.total)} MDL</div></div>
    <div class="ocard-meta">${esc(o.customer?.phone||'')}${o.customer?.address?' · '+esc(o.customer.address):''}<br>${items}<br>${fmtDate(o.timestamp)}</div>
    <div class="ocard-id">${esc(o.id)}</div>
    <div style="margin-top:10px;display:flex;justify-content:flex-end;">
      <button class="btn-ghost" style="border-color:var(--red);color:var(--red);padding:6px 10px;font-size:0.78rem;" onclick="deleteOrder('${esc(o.id)}')">Șterge</button>
    </div>
  </div>`;
}

function renderDashboardOrderCard(o) {
    return `<div class="ocard ocard-dash">
      <div class="ocard-top">
        <div class="ocard-name">${esc(o.customer?.name || '—')}</div>
        <div class="ocard-total">${esc(o.total)} MDL</div>
      </div>
      <div class="ocard-meta">${esc(o.customer?.phone || 'Fără telefon')}<br>${fmtDate(o.timestamp)}</div>
      <div class="ocard-id">${esc(o.id)}</div>
    </div>`;
}

function animateDashboardReveal() {
    const page = document.getElementById('page-dashboard');
    if (!page) return;

    const targets = Array.from(page.querySelectorAll(
        '#dash-tbody tr, #dash-cards .ocard, #dash-cards .empty'
    ));
    if (!targets.length) return;

    targets.forEach((el, idx) => {
        el.style.setProperty('--dash-reveal-delay', `${Math.min(idx * 32, 320)}ms`);
        targets.forEach(el => el.classList.add('dash-reveal-item'));
    });
}

function setDashboardLoadingState() {
    const tbody = document.getElementById('dash-tbody');
    const cards = document.getElementById('dash-cards');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:26px;color:var(--sub);">Se încarcă...</td></tr>';
    }
    if (cards) {
        cards.innerHTML = '<div class="empty">Se încarcă...</div>';
    }
}

async function loadDashboard(options = {}) {
    const showLoading = options.showLoading !== false;
    if (!isDashboardPageOpen()) return;
    if (dashboardLoading) {
        dashboardReloadQueued = true;
        return;
    }
    dashboardLoading = true;
    dashboardReloadQueued = false;
    if (showLoading) setDashboardLoadingState();

    try {
        const [od,pd] = await Promise.all([api('/api/admops/orders'),api('/api/admops/products')]);
        const orders=od.orders||[], prods=pd.products||[];
        const rev=orders.reduce((s,o)=>s+(o.total||0),0);
        const avg=orders.length?Math.round(rev/orders.length):0;
        document.getElementById('s-orders').textContent=orders.length;
        document.getElementById('s-rev').textContent=rev.toLocaleString('ro-RO')+' MDL';
        document.getElementById('s-avg').textContent=avg+' MDL';
        document.getElementById('s-prod').textContent=prods.length;
        const recent=[...orders].reverse().slice(0,5);
        const empty=`<tr><td colspan="4" style="text-align:center;padding:26px;color:var(--sub);">Nicio comandă încă.</td></tr>`;
        document.getElementById('dash-tbody').innerHTML = recent.length===0 ? empty : recent.map(o=>`<tr>
          <td><span class="oid">${esc(o.id)}</span></td>
          <td><strong>${esc(o.customer?.name||'—')}</strong></td>
          <td class="ototal">${esc(o.total)} MDL</td>
          <td>${fmtDate(o.timestamp)}</td>
        </tr>`).join('');
        const dc=document.getElementById('dash-cards');
        dc.innerHTML=recent.length===0?`<div class="empty">Nicio comandă încă.</div>`:recent.map(renderDashboardOrderCard).join('');
        if (showLoading) animateDashboardReveal();
        await loadDashboardTelemetry({ animate: false });
    } catch(e){console.error(e);}
    finally {
        dashboardLoading = false;
        if (dashboardReloadQueued && isDashboardPageOpen()) {
            dashboardReloadQueued = false;
            loadDashboard({ showLoading: false });
        }
    }
}

function renderDashboardTelemetry(d) {
    const overview = d?.overview || {};
    const insights = d?.insights || {};

    const setVal = (id, value) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = value;
    };

    setVal('dash-tm-storefront-today', fmtTelemetryNumber(overview.eventsTodayStorefront ?? 0));
    setVal('dash-tm-unique-today', fmtTelemetryNumber(telemetryTotalVisits(d)));
    setVal('dash-tm-add-rate', fmtTelemetryPct(insights.addToCartRate));
    setVal('dash-tm-checkout-rate', fmtTelemetryPct(insights.checkoutConversionRate));

    const syncEl = document.getElementById('dash-tm-sync');
    if (syncEl) {
        syncEl.textContent = overview.lastSyncAt
            ? `Sincronizare: ${new Date(overview.lastSyncAt).toLocaleString('ro-RO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
            : 'Sincronizare: —';
    }
    const storefrontEl = document.getElementById('dash-tm-storefront');
    if (storefrontEl) {
        storefrontEl.textContent = `Viz. produse: ${fmtTelemetryNumber(insights.productViews ?? 0)} · Add în coș: ${fmtTelemetryNumber(insights.cartAdds ?? 0)}`;
    }
}

async function loadDashboardTelemetry(options = {}) {
    if (!isDashboardPageOpen()) return;
    const animate = options.animate !== false;
    try {
        const d = await api('/api/admops/telemetry/overview');
        if (!d.success) return;
        telemetryOverviewCache = d;
        telemetrySettingsState = d.settings || { enabled: true };
        renderTelemetryToggle();
        renderDashboardTelemetry(d);
        if (animate) animateDashboardReveal();
    } catch (err) {
        console.warn('[Dashboard telemetry]', err);
    }
}

async function loadOrders() {
    const tbody=document.getElementById('orders-tbody');
    const cards=document.getElementById('orders-cards');
    tbody.innerHTML=`<tr><td colspan="7" style="text-align:center;padding:26px;color:var(--sub);">Se încarcă...</td></tr>`;
    cards.innerHTML=`<div class="empty">Se încarcă...</div>`;
    try {
        const d=await api('/api/admops/orders');
        const orders=[...(d.orders||[])].reverse();
        if (!orders.length) { tbody.innerHTML=`<tr><td colspan="7" style="text-align:center;padding:26px;color:var(--sub);">Nicio comandă.</td></tr>`; cards.innerHTML=`<div class="empty">Nicio comandă.</div>`; return; }
        tbody.innerHTML=orders.map(o=>{ const items=(o.cart||[]).map(i=>`${esc(i.name)} ×${esc(i.qty)}`).join(', '); return `<tr>
        <td><span class="oid">${esc(o.id)}</span></td>
        <td><strong>${esc(o.customer?.name||'—')}</strong><br><small style="color:var(--sub);">${esc(o.customer?.address||'')}</small></td>
        <td>${esc(o.customer?.phone||'—')}<br><small style="color:var(--sub);">${esc(o.customer?.email||'')}</small></td>
        <td><div class="oitems">${items}</div></td>
        <td class="ototal">${esc(o.total)} MDL</td>
        <td>${fmtDate(o.timestamp)}</td>
        <td><button class="btn-ghost" style="border-color:var(--red);color:var(--red);padding:6px 10px;font-size:0.78rem;" onclick="deleteOrder('${esc(o.id)}')">Șterge</button></td>
      </tr>`; }).join('');
        cards.innerHTML=orders.map(renderOrderCardFull).join('');
    } catch { tbody.innerHTML=`<tr><td colspan="7" style="text-align:center;padding:26px;color:var(--red);">Eroare.</td></tr>`; }
}

async function loadProducts() {
    try {
        const d = await api('/api/admops/products');
        allProducts = (d.products || []).map(p => ({ ...p, image: toAbsoluteAssetUrl(p.image) }));
        renderProducts();
    } catch (e) { console.error(e); }
}

function renderProducts() {
    const grid=document.getElementById('prod-grid');
    const list=document.getElementById('prod-list');
    if (!allProducts.length) {
        const html=`<div class="empty">Niciun produs. Adaugă primul!</div>`;
        grid.innerHTML=`<div style="grid-column:1/-1;">${html}</div>`; list.innerHTML=html; return;
    }
    grid.innerHTML=allProducts.map(p=>`<div class="flower-card ${p.listed===false?'unlisted':''}" onclick="openEdit(${Number(p.id)})">
      <img class="card-img" src="${esc(p.image||'')}" alt="${esc(p.name)}" onerror="this.src='https://placehold.co/400x200/f7f4f1/aa0132?text=+'">
      <div class="card-body">
        <div class="card-name">${esc(p.name)}</div><div class="card-family">${esc(p.family||'')}</div>
        <div class="card-price">${esc(p.price)} MDL</div><div>${catBadge(p.category)}</div>
      </div>
    </div>`).join('');
    list.innerHTML=allProducts.map(p=>`<div class="prod-row ${p.listed===false?'unlisted':''}" onclick="openEdit(${Number(p.id)})">
      <img class="prod-thumb" src="${esc(p.image||'')}" alt="${esc(p.name)}" onerror="this.src='https://placehold.co/100x100/f7f4f1/aa0132?text=+'">
      <div class="prod-row-info"><div class="prod-row-name">${esc(p.name)}</div>
        <div class="prod-row-meta"><span class="prod-row-price">${esc(p.price)} MDL</span>${catBadge(p.category)}${p.listed===false?`<span class="prod-row-dim">Nelistat</span>`:''}</div>
      </div><span class="prod-chevron">›</span>
    </div>`).join('');
}

let uploadedFile=null;
const dropZone=document.getElementById('drop-zone');
const fileInput=document.getElementById('f-img-file');
const preview=document.getElementById('drop-preview');
function handleFile(file) {
    if (!file||!file.type.startsWith('image/')) { toast('Doar imagini acceptate.','error'); return; }
    if (file.size>5*1024*1024) { toast('Max 5MB.','error'); return; }
    uploadedFile=file;
    const r=new FileReader(); r.onload=e=>{preview.src=e.target.result;preview.classList.add('visible');}; r.readAsDataURL(file);
}
dropZone.addEventListener('dragover', e=>{e.preventDefault();dropZone.classList.add('drag-over');});
dropZone.addEventListener('dragleave',()=>dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop',e=>{e.preventDefault();dropZone.classList.remove('drag-over');handleFile(e.dataTransfer.files[0]);});
fileInput.addEventListener('change',()=>handleFile(fileInput.files[0]));

document.getElementById('add-btn').addEventListener('click', async ()=>{
    const name=document.getElementById('f-name').value.trim();
    const price=document.getElementById('f-price').value.trim();
    if (!name||!price) { toast('Nume și preț sunt obligatorii.','error'); return; }
    const btn=document.getElementById('add-btn');
    btn.textContent='Se adaugă...'; btn.disabled=true;
    try {
        let imagePath='';
        if (uploadedFile) {
            const fd=new FormData(); fd.append('image',uploadedFile);
            const up=await fetch('/api/admops/upload',{method:'POST',body:fd,credentials:'include'}).then(r=>r.json());
            if (up.success){imagePath=up.path;}else{toast('Eroare upload: '+up.error,'error');btn.textContent='Adaugă în catalog';btn.disabled=false;return;}
        }
        const d=await api('/api/admops/products',{method:'POST',body:JSON.stringify({
            name,price,category:document.getElementById('f-cat').value,
            family:document.getElementById('f-family').value.trim(),
            desc:document.getElementById('f-desc').value.trim(),
            care:document.getElementById('f-care').value.trim(),
            note:document.getElementById('f-note').value.trim(),
            image:imagePath
        })});
        if (d.success) {
            toast('Produs adăugat!','success');
            ['f-name','f-price','f-family','f-desc','f-care','f-note'].forEach(id=>document.getElementById(id).value='');
            preview.classList.remove('visible'); uploadedFile=null; fileInput.value='';
            loadProducts();
        } else toast(d.error,'error');
    } catch { toast('Eroare la adăugare.','error'); }
    btn.textContent='Adaugă în catalog'; btn.disabled=false;
});

let editFile=null;
const eDropZone=document.getElementById('e-drop-zone');
const eFileInput=document.getElementById('e-img-file');
const eThumb=document.getElementById('e-img-thumb');
function handleEditFile(file) {
    if (!file||!file.type.startsWith('image/')) { toast('Doar imagini acceptate.','error'); return; }
    if (file.size>5*1024*1024) { toast('Max 5MB.','error'); return; }
    editFile=file;
    const r=new FileReader(); r.onload=e=>{eThumb.src=e.target.result;eThumb.style.display='block';}; r.readAsDataURL(file);
}
eDropZone.addEventListener('dragover', e=>{e.preventDefault();eDropZone.classList.add('drag-over');});
eDropZone.addEventListener('dragleave',()=>eDropZone.classList.remove('drag-over'));
eDropZone.addEventListener('drop',e=>{e.preventDefault();eDropZone.classList.remove('drag-over');handleEditFile(e.dataTransfer.files[0]);});
eFileInput.addEventListener('change',()=>handleEditFile(eFileInput.files[0]));

function openEdit(id) {
    const p=allProducts.find(x=>x.id===id); if (!p) return;
    document.getElementById('e-id').value=p.id;
    document.getElementById('e-name').value=p.name;
    document.getElementById('e-price').value=p.price;
    document.getElementById('e-cat').value=p.category||'General';
    document.getElementById('e-family').value=p.family||'';
    document.getElementById('e-desc').value=p.desc||'';
    document.getElementById('e-care').value=p.care||'';
    document.getElementById('e-note').value=p.note||'';
    document.getElementById('e-toggle-list').textContent=p.listed===false?'Listează':'Delistează';
    if (p.image){eThumb.src=p.image;eThumb.style.display='block';}else{eThumb.style.display='none';}
    editFile=null; eFileInput.value='';
    document.getElementById('edit-overlay').classList.add('open');
    document.body.style.overflow='hidden';
}
function closeEdit() {
    document.getElementById('edit-overlay').classList.remove('open');
    document.body.style.overflow='';
}
document.getElementById('modal-close').addEventListener('click',closeEdit);
document.getElementById('edit-overlay').addEventListener('click',e=>{if(e.target===document.getElementById('edit-overlay'))closeEdit();});

document.getElementById('e-save').addEventListener('click', async ()=>{
    const id=Number(document.getElementById('e-id').value);
    const btn=document.getElementById('e-save');
    btn.textContent='Se salvează...'; btn.disabled=true;
    try {
        let imagePath;
        if (editFile) {
            const fd=new FormData(); fd.append('image',editFile);
            const up=await fetch('/api/admops/upload',{method:'POST',body:fd,credentials:'include'}).then(r=>r.json());
            if (up.success){imagePath=up.path;}else{toast('Eroare upload: '+up.error,'error');btn.textContent='Salvează';btn.disabled=false;return;}
        }
        const payload={
            name:document.getElementById('e-name').value.trim(),
            price:document.getElementById('e-price').value,
            category:document.getElementById('e-cat').value,
            family:document.getElementById('e-family').value.trim(),
            desc:document.getElementById('e-desc').value.trim(),
            care:document.getElementById('e-care').value.trim(),
            note:document.getElementById('e-note').value.trim(),
        };
        if (imagePath) payload.image=imagePath;
        if (!payload.name||!payload.price){toast('Nume și preț obligatorii.','error');btn.textContent='Salvează';btn.disabled=false;return;}
        const d=await api(`/api/admops/products/${id}`,{method:'PATCH',body:JSON.stringify(payload)});
        if (d.success){toast('Salvat!','success');closeEdit();loadProducts();}
        else toast(d.error,'error');
    } catch { toast('Eroare la salvare.','error'); }
    btn.textContent='Salvează'; btn.disabled=false;
});

document.getElementById('e-toggle-list').addEventListener('click', async ()=>{
    const id=Number(document.getElementById('e-id').value);
    try {
        const d=await api(`/api/admops/products/${id}/toggle`,{method:'PATCH'});
        if (d.success){toast(d.listed?'Listat.':'Delistat.','success');closeEdit();loadProducts();}
        else toast(d.error,'error');
    } catch { toast('Eroare.','error'); }
});

document.getElementById('e-delete').addEventListener('click', async ()=>{
    if (!confirm('Sigur vrei să ștergi acest produs?')) return;
    const id=Number(document.getElementById('e-id').value);
    try {
        const d=await api(`/api/admops/products/${id}`,{method:'DELETE'});
        if (d.success){toast('Produs șters.','success');closeEdit();loadProducts();}
        else toast(d.error,'error');
    } catch { toast('Eroare la ștergere.','error'); }
});

document.getElementById('dash-ref').addEventListener('click',  loadDashboard);
document.getElementById('orders-ref').addEventListener('click',loadOrders);
document.getElementById('prod-ref').addEventListener('click',  loadProducts);

setInterval(() => {
    if (document.hidden) return;
    if (!isTelemetryPageOpen() && !isDashboardPageOpen()) return;
    scheduleTelemetryReload(0);
}, 60000);

document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    scheduleTelemetryReload(120);
});
// ── Smooth <details> animation for ALL accordion panels ─────────────────
(function() {
    // Use a WeakMap to track ongoing animations
    const animMap = new WeakMap();

    document.querySelectorAll('details.tm3-details').forEach(el => {
        const summary = el.querySelector('summary');
        const body    = el.querySelector('.panel-body, .tm3-details-body-wrap');
        if (!summary || !body) return;

        summary.addEventListener('click', e => {
            // Don't animate if the click was on the inner dropdown button
            if (e.target.closest('.tm3-dd')) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            e.preventDefault(); // We control open/close manually

            // Cancel any running animation
            if (animMap.has(el)) { animMap.get(el).cancel(); }

            const isOpen   = el.hasAttribute('open');
            const startH   = body.scrollHeight;

            if (isOpen) {
                // Closing
                const anim = body.animate(
                    [{ maxHeight: startH + 'px', opacity: 1 },
                     { maxHeight: '0px',         opacity: 0 }],
                    { duration: 320, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' }
                );
                animMap.set(el, anim);
                anim.onfinish = () => { el.removeAttribute('open'); body.style.maxHeight = ''; body.style.opacity = ''; };
            } else {
                // Opening
                el.setAttribute('open', '');
                const openH = body.scrollHeight;
                const anim = body.animate(
                    [{ maxHeight: '0px',      opacity: 0 },
                     { maxHeight: openH + 'px', opacity: 1 }],
                    { duration: 360, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' }
                );
                animMap.set(el, anim);
                anim.onfinish = () => { body.style.maxHeight = ''; body.style.opacity = ''; };
            }
        });
    });
})();

// Settings - Theme toggle
function getPreferredTheme() {
    const saved = localStorage.getItem('admin_theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('admin_theme', theme);
    const wrapper = document.getElementById('theme-toggle-wrapper');
    if (wrapper) wrapper.setAttribute('data-active', theme === 'dark' ? 'true' : 'false');
}
document.addEventListener('DOMContentLoaded', () => {
    applyTheme(getPreferredTheme());
    const themeWrapper = document.getElementById('theme-toggle-wrapper');
    if (themeWrapper) {
        themeWrapper.addEventListener('click', () => {
            const isActive = themeWrapper.getAttribute('data-active') === 'true';
            applyTheme(isActive ? 'light' : 'dark');
        });
    }

    const rememberMeWrapper = document.getElementById('remember-me-toggle');
    if (rememberMeWrapper) {
        rememberMeWrapper.addEventListener('click', () => {
            const isActive = rememberMeWrapper.getAttribute('data-active') === 'true';
            rememberMeWrapper.setAttribute('data-active', isActive ? 'false' : 'true');
        });
    }
});
document.getElementById('add-passkey-btn').addEventListener('click', doRegisterPasskey);
document.getElementById('mobile-logout-btn').addEventListener('click', () => {
    fetch('/api/admops/logout', { method: 'POST', credentials: 'include' }).then(() => location.reload());
});

async function loadPasskeysList() {
    const container = document.getElementById('passkeys-container');
    const listDiv   = document.getElementById('passkeys-list');
    if (!container || !listDiv) return;

    listDiv.style.display = 'block';
    container.innerHTML = '<div class="settings-loading-text">Se încarcă dispozitivele...</div>';

    try {
        const res = await fetch('/api/admops/passkeys', { credentials: 'include' });
        const data = await res.json();

        if (!data.success) {
            container.innerHTML = '<div class="settings-loading-text is-error">Nu am putut încărca dispozitivele.</div>';
            return;
        }
        if (!data.passkeys.length) {
            container.innerHTML = '<div class="settings-loading-text">Nu există dispozitive conectate.</div>';
            return;
        }

        container.innerHTML = data.passkeys.map((p, idx) => {
            const methodIcons = [];
            if (p.authMethods?.includes('passkey'))  methodIcons.push('<span style="font-size:0.72rem;background:var(--p);color:#fff;padding:1px 7px;border-radius:20px;">Passkey</span>');
            if (p.authMethods?.includes('password')) methodIcons.push('<span style="font-size:0.72rem;background:var(--border);color:var(--text);padding:1px 7px;border-radius:20px;">Parolă</span>');
            const currentBadge = p.isCurrentDevice
                ? '<span style="font-size:0.7rem;color:var(--p);margin-left:6px;">● Curent</span>'
                : '';
            const lastSeenStr = p.lastSeen
                ? new Date(p.lastSeen).toLocaleString('ro-RO', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })
                : '—';
            return `<div class="settings-device-row" style="--row-delay:${Math.min(idx * 45, 260)}ms;display:flex;justify-content:space-between;align-items:center;padding:13px 0;border-bottom:1px solid var(--border);cursor:pointer;" onclick="openDeviceModal('${esc(p.deviceToken || p.credentialID)}')">
                <div>
                    <div style="font-weight:500;">${esc(p.deviceName)}${currentBadge}</div>
                    <div style="font-size:0.78rem;color:var(--sub);margin-top:3px;">Ultima activitate: ${lastSeenStr}</div>
                    <div style="display:flex;gap:5px;margin-top:5px;">${methodIcons.join('')}</div>
                </div>
                <span style="color:var(--sub);font-size:1.1rem;">›</span>
            </div>`;
        }).join('');
    } catch {
        container.innerHTML = '<div class="settings-loading-text is-error">Nu am putut încărca dispozitivele.</div>';
    }
}

let currentDeviceCredId = null;

function openDeviceModal(deviceToken) {
    currentDeviceCredId = deviceToken;

    // Fetch devices list + this device's activity in parallel
    const devRes = fetch('/api/admops/passkeys', { credentials: 'include' }).then(r => r.json());
    const actRes = fetch(`/api/admops/activity?credId=${encodeURIComponent(deviceToken)}&limit=20`, { credentials: 'include' }).then(r => r.json());

    Promise.all([devRes, actRes]).then(([data, actData]) => {
        if (!data.success) return;
        const p = data.passkeys.find(x => (x.deviceToken || x.credentialID) === deviceToken);
        if (!p) return;

        document.getElementById('device-modal-title').textContent = p.deviceName || 'Dispozitiv';

        // ── activity section ─────────────────────────────────────────────────
        const actionLabels = {
            login:           'Autentificare',
            product_create:  'Produs creat',
            product_update:  'Produs actualizat',
            product_delete:  'Produs șters',
            product_toggle:  'Produs arătat/ascuns',
            order_status:    'Status comandă schimbat',
            order_delete:    'Comandă ștearsă',
            passkey_deleted: 'Passkey șters',
            passkey_renamed: 'Dispozitiv redenumit',
        };
        const activity = actData.success ? actData.activity : [];
        const logins   = activity.filter(a => a.action === 'login');
        let activityHtml = '';
        if (activity.length > 0) {
            activityHtml = `
                <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border);">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                        <span style="font-weight:600;font-size:0.88rem;">Activitate recentă</span>
                        <span style="font-size:0.74rem;color:var(--sub);">${logins.length} autentificări</span>
                    </div>
                    <div style="max-height:180px;overflow-y:auto;">
                        ${activity.map(a => {
                            const label  = a.label || actionLabels[a.action] || a.action;
                            const detail = a.action === 'login'
                                ? (a.ip || '')
                                : (a.details?.productName || (a.details?.productId ? '#' + a.details.productId : '') || a.details?.newName || '');
                            return '<div style="display:grid;grid-template-columns:1fr auto auto;gap:6px;align-items:center;padding:5px 0;border-bottom:1px solid var(--border);font-size:0.81rem;">'
                                + `<span>${label}</span>`
                                + `<span style="color:var(--sub);font-size:0.76rem;">${detail}</span>`
                                + `<span style="color:var(--sub);font-size:0.72rem;white-space:nowrap;">${new Date(a.timestamp).toLocaleString('ro-RO',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span>`
                                + '</div>';
                        }).join('')}
                    </div>
                </div>`;
        } else {
            activityHtml = '<div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border);color:var(--sub);font-size:0.82rem;text-align:center;">Nicio activitate înregistrată.</div>';
        }

        // ── device info section ───────────────────────────────────────────────
        const methodBadges = (p.authMethods || []).map(m =>
            m === 'passkey'
                ? '<span style="font-size:0.75rem;background:var(--p);color:#fff;padding:2px 9px;border-radius:20px;">Passkey</span>'
                : '<span style="font-size:0.75rem;background:var(--border);color:var(--text);padding:2px 9px;border-radius:20px;">Parolă</span>'
        ).join(' ');

        const currentBadge = p.isCurrentDevice
            ? '<span style="font-size:0.72rem;color:var(--p);margin-left:6px;">(dispozitivul curent)</span>'
            : '';

        const lastSeenStr = p.lastSeen
            ? new Date(p.lastSeen).toLocaleString('ro-RO')
            : '—';

        const passkeyRow = p.passkeyCredId ? `
            <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);">
                <span style="color:var(--sub);">Passkey adăugat</span>
                <span style="font-weight:500;">${p.createdAt ? new Date(p.createdAt).toLocaleDateString('ro-RO') : '—'}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);">
                <span style="color:var(--sub);">Ultima utilizare passkey</span>
                <span style="font-weight:500;">${p.passkeyLastUsed ? new Date(p.passkeyLastUsed).toLocaleString('ro-RO') : 'Nu a fost folosit'}</span>
            </div>` : '';
        const info = p.deviceInfo || {};
        const deviceTypeLabels = { desktop: 'Desktop', mobile: 'Telefon', tablet: 'Tabletă', unknown: 'Necunoscut' };
        const deviceInfoRows = info.os || info.browser || info.deviceType ? `
                <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);">
                    <span style="color:var(--sub);">Platformă</span>
                    <span style="font-weight:500;">${esc(info.os || '—')}</span>
                </div>
                <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);">
                    <span style="color:var(--sub);">Browser detectat</span>
                    <span style="font-weight:500;">${esc(info.browser || '—')}</span>
                </div>
                <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);">
                    <span style="color:var(--sub);">Tip dispozitiv</span>
                    <span style="font-weight:500;">${esc(deviceTypeLabels[info.deviceType] || info.deviceType || '—')}</span>
                </div>` : '';

        const modalBodyHtml = `
            <div style="display:grid;gap:0;">
                <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);">
                    <span style="color:var(--sub);">Dispozitiv</span>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <span style="font-weight:500;" id="device-name-display">${esc(p.deviceName)}${currentBadge}</span>
                        <button onclick="startRenamePasskey('${esc(deviceToken)}')" style="background:none;border:1px solid var(--border);cursor:pointer;color:var(--p);font-size:0.72rem;padding:2px 8px;border-radius:4px;">Redenumește</button>
                    </div>
                </div>
                ${deviceInfoRows}
                <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);">
                    <span style="color:var(--sub);">Metode autentificare</span>
                    <span>${methodBadges}</span>
                </div>
                <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);">
                    <span style="color:var(--sub);">Prima conexiune</span>
                    <span style="font-weight:500;">${p.createdAt ? new Date(p.createdAt).toLocaleString('ro-RO') : '—'}</span>
                </div>
                <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);">
                    <span style="color:var(--sub);">Ultimă activitate</span>
                    <span style="font-weight:500;">${lastSeenStr}</span>
                </div>
                <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);">
                    <span style="color:var(--sub);">Ultimul IP</span>
                    <span style="font-weight:500;font-family:monospace;font-size:0.85rem;">${esc(p.lastIp || '—')}</span>
                </div>
                ${passkeyRow}
            </div>`;

        document.getElementById('device-modal-body').innerHTML = modalBodyHtml + activityHtml;

        // ── footer buttons ────────────────────────────────────────────────────
        const removePasskeyBtn = p.passkeyCredId
            ? `<button class="btn btn-p" style="background:var(--red,#dc3545);font-size:0.85rem;" onclick="removeDevicePasskey('${esc(deviceToken)}')">Șterge Passkey</button>`
            : '';

        // ⋯ dropdown — only shown for non-current devices (nothing useful for current device)
        const moreMenuBtn = !p.isCurrentDevice ? `
            <div class="device-more-wrap" id="device-more-wrap">
                <button id="device-more-btn" class="device-more-btn" onclick="toggleDeviceMenu(event)" aria-haspopup="menu" aria-expanded="false">
                    Opțiuni
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"></path></svg>
                </button>
                <div id="device-more-menu" class="device-more-menu" role="menu">
                    <button class="device-menu-item danger" onclick="forgetDevice('${esc(deviceToken)}')" role="menuitem">
                        <span>🗑</span> Uită dispozitivul
                    </button>
                </div>
            </div>` : '';

        document.getElementById('device-modal-footer').innerHTML = `
            <button class="btn btn-ghost" onclick="closeDeviceModal()">Închide</button>
            <div style="display:flex;gap:8px;margin-left:auto;">
                ${removePasskeyBtn}
                ${moreMenuBtn}
            </div>`;
        document.getElementById('device-modal-footer').style.cssText =
            'display:flex;align-items:center;gap:10px;padding:14px 20px 18px;border-top:1px solid var(--border);margin-top:4px;';

        _deviceMenuOpen = false;
        document.getElementById('device-modal-overlay').classList.add('open');
    });
}

function closeDeviceModal() {
    document.getElementById('device-modal-overlay').classList.remove('open');
    currentDeviceCredId = null;
    const menu = document.getElementById('device-more-menu');
    const btn = document.getElementById('device-more-btn');
    if (menu) menu.classList.remove('open');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    _deviceMenuOpen = false;
}

document.getElementById('device-modal-close').addEventListener('click', closeDeviceModal);
document.getElementById('device-modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('device-modal-overlay')) closeDeviceModal();
});


// Dropdown state
let _deviceMenuOpen = false;

function toggleDeviceMenu(e) {
    e.stopPropagation();
    const menu = document.getElementById('device-more-menu');
    const btn = document.getElementById('device-more-btn');
    if (!menu) return;
    _deviceMenuOpen = !_deviceMenuOpen;
    menu.classList.toggle('open', _deviceMenuOpen);
    if (btn) btn.setAttribute('aria-expanded', _deviceMenuOpen ? 'true' : 'false');
}

// Close dropdown when clicking anywhere outside it
document.addEventListener('click', (e) => {
    if (!_deviceMenuOpen) return;
    const wrap = document.getElementById('device-more-wrap');
    if (wrap && !wrap.contains(e.target)) {
        const menu = document.getElementById('device-more-menu');
        const btn = document.getElementById('device-more-btn');
        if (menu) menu.classList.remove('open');
        if (btn) btn.setAttribute('aria-expanded', 'false');
        _deviceMenuOpen = false;
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !_deviceMenuOpen) return;
    const menu = document.getElementById('device-more-menu');
    const btn = document.getElementById('device-more-btn');
    if (menu) menu.classList.remove('open');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    _deviceMenuOpen = false;
});

/** Fully forget a device — removes the device record, its passkey, and all activity logs. */
async function forgetDevice(deviceToken) {
    _deviceMenuOpen = false;
    const menu = document.getElementById('device-more-menu');
    const btn = document.getElementById('device-more-btn');
    if (menu) menu.classList.remove('open');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    if (!confirm('Uiți complet acest dispozitiv?\nSe vor șterge toate parolele, passkey-urile și istoricul de autentificare asociate.')) return;
    closeDeviceModal();
    const res  = await fetch(`/api/admops/devices/${encodeURIComponent(deviceToken)}`, { method: 'DELETE', credentials: 'include' });
    const data = await res.json();
    if (data.success) { toast('Dispozitiv uitat.', 'success'); loadPasskeysList(); }
    else toast(data.error || 'Eroare.', 'error');
}

async function startRenamePasskey(deviceToken) {
    const display = document.getElementById('device-name-display');
    const current = display ? display.textContent.replace('(dispozitivul curent)', '').trim() : '';
    const newName = prompt('Redenumește dispozitivul:', current);
    if (!newName || newName.trim() === current) return;
    const res = await fetch(`/api/admops/devices/${encodeURIComponent(deviceToken)}/rename`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newName.trim() })
    });
    const data = await res.json();
    if (data.success) {
        if (display) display.textContent = newName.trim();
        document.getElementById('device-modal-title').textContent = newName.trim();
        toast('Dispozitiv redenumit.', 'success');
        loadPasskeysList();
    } else {
        toast(data.error || 'Eroare la redenumire.', 'error');
    }
}

/** Remove only the passkey from a device — device record stays, can still use password. */
async function removeDevicePasskey(deviceToken) {
    if (!confirm('Ștergi passkey-ul de pe acest dispozitiv?\nDispozitivul va rămâne înregistrat și poate fi folosit cu parolă.')) return;
    closeDeviceModal();
    const res  = await fetch(`/api/admops/devices/${encodeURIComponent(deviceToken)}/passkey`, { method: 'DELETE', credentials: 'include' });
    const data = await res.json();
    if (data.success) { toast('Passkey șters.'); loadPasskeysList(); }
    else toast(data.error || 'Eroare.', 'error');
}

/** Fully revoke a device — removes device record and its passkey. Cannot revoke current device. */
async function revokeDevice(deviceToken) {
    if (!confirm('Revocare completă a dispozitivului?\nAcesta va fi deconectat și NU va mai putea accesa panoul.')) return;
    closeDeviceModal();
    const res  = await fetch(`/api/admops/devices/${encodeURIComponent(deviceToken)}`, { method: 'DELETE', credentials: 'include' });
    const data = await res.json();
    if (data.success) { toast('Dispozitiv revocat.', 'success'); loadPasskeysList(); }
    else toast(data.error || 'Eroare.', 'error');
}

async function deleteOrder(orderId) {
    if (!orderId) return;
    if (!confirm(`Ștergi comanda ${orderId}?\nAcțiunea este permanentă.`)) return;
    try {
        const res = await fetch(`/api/admops/orders/${encodeURIComponent(orderId)}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        const data = await res.json();
        if (data.success) {
            toast('Comandă ștearsă.', 'success');
            loadOrders();
            loadDashboard();
        } else {
            toast(data.error || 'Nu am putut șterge comanda.', 'error');
        }
    } catch (e) {
        toast('Eroare la ștergere comandă.', 'error');
    }
}

// Legacy alias kept in case any other code still calls deletePasskey(credId)
async function deletePasskey(credId) { await removeDevicePasskey(credId); }

async function checkCurrentDevicePasskey() {
    const addBtn = document.getElementById('add-passkey-btn');
    if (!addBtn) return;
    try {
        const res  = await fetch('/api/admops/my-device', { credentials: 'include' });
        const data = await res.json();
        if (!data.success || !data.device) return;

        if (data.device.passkeyCredId) {
            // This device already has a passkey registered
            addBtn.textContent = '✓ Passkey adăugat';
            addBtn.disabled    = true;
            addBtn.style.opacity = '0.7';
        }
        // Clear the old localStorage flag — server is now the source of truth
        localStorage.removeItem('passkeyRegisteredHere');
    } catch (e) {
        // fallback: use old localStorage check
        if (localStorage.getItem('passkeyRegisteredHere') === 'true') {
            addBtn.textContent = '✓ Passkey adăugat';
            addBtn.disabled    = true;
            addBtn.style.opacity = '0.7';
        }
    }
}

// Accent color picker
let pendingAccent = null;
let isAccentPickerOpen = false;
const accentPicker = document.getElementById('accent-picker');
const accentBtn = document.getElementById('accent-color-btn');
const accentApplyBtn = document.getElementById('accent-apply-btn');
const accentCancelBtn = document.getElementById('accent-cancel-btn');
const accentSwatches = document.querySelectorAll('.accent-swatch');

function applyAccentColor(color, darkColor, animate) {
    if (animate) {
        const overlay = document.getElementById('accent-fade-overlay');
        overlay.classList.add('active');
        setTimeout(() => {
            document.documentElement.style.setProperty('--p', color);
            document.documentElement.style.setProperty('--p-dark', darkColor || color);
            document.documentElement.style.setProperty('--p-glow', color + '1a');
            document.querySelectorAll('.accent-preview').forEach(el => {
                el.style.background = color;
            });
            setTimeout(() => {
                overlay.classList.remove('active');
            }, 60);
        }, 180);
    } else {
        document.documentElement.style.setProperty('--p', color);
        document.documentElement.style.setProperty('--p-dark', darkColor || color);
        document.documentElement.style.setProperty('--p-glow', color + '1a');
        document.querySelectorAll('.accent-preview').forEach(el => {
            el.style.background = color;
        });
    }
    localStorage.setItem('admin_accent', JSON.stringify({ color, dark: darkColor }));
}

function restoreAccentColor() {
    const saved = localStorage.getItem('admin_accent');
    if (saved) {
        try {
            const { color, dark } = JSON.parse(saved);
            applyAccentColor(color, dark, false);
            return true;
        } catch { return false; }
    }
    return false;
}

restoreAccentColor();

function setSwatchSelection(color) {
    accentSwatches.forEach(s => {
        s.classList.toggle('selected', s.dataset.color === color);
    });
}

setSwatchSelection(getComputedStyle(document.documentElement).getPropertyValue('--p').trim());

function openAccentPicker() {
    if (!accentPicker) return;
    accentPicker.classList.add('open');
    isAccentPickerOpen = true;
}

function closeAccentPicker() {
    if (!accentPicker) return;
    accentPicker.classList.remove('open');
    isAccentPickerOpen = false;
}

accentBtn.addEventListener('click', () => {
    if (isAccentPickerOpen) {
        closeAccentPicker();
        return;
    }
    const current = getComputedStyle(document.documentElement).getPropertyValue('--p').trim();
    setSwatchSelection(current);
    pendingAccent = current;
    openAccentPicker();
});

accentCancelBtn.addEventListener('click', () => {
    closeAccentPicker();
    pendingAccent = null;
});

accentSwatches.forEach(swatch => {
    swatch.addEventListener('click', () => {
        setSwatchSelection(swatch.dataset.color);
        pendingAccent = swatch.dataset.color;
    });
});

accentApplyBtn.addEventListener('click', () => {
    if (pendingAccent) {
        const swatch = document.querySelector(`.accent-swatch[data-color="${pendingAccent}"]`);
        if (swatch) {
            applyAccentColor(swatch.dataset.color, swatch.dataset.dark, true);
        }
        closeAccentPicker();
        pendingAccent = null;
    }
});

function exportOrdersCSV() {
    const btn = document.getElementById('export-csv-btn');
    btn.disabled = true;
    btn.textContent = 'Se pregătește...';
    api('/api/admops/orders').then(d => {
        const orders = d.orders || [];
        if (!orders.length) {
            toast('Nicio comandă de exportat.', 'error');
            btn.disabled = false;
            btn.textContent = 'Descarcă CSV';
            return;
        }
        const headers = ['ID', 'Data', 'Nume Client', 'Telefon', 'Email', 'Adresă', 'Produse', 'Total (MDL)', 'Status'];
        const rows = orders.map(o => [
            o.id,
            new Date(o.timestamp).toLocaleString('ro-RO'),
            o.customer?.name || '',
            o.customer?.phone || '',
            o.customer?.email || '',
            o.customer?.address || '',
            (o.cart || []).map(i => `${i.name} x${i.qty}`).join(' | '),
            o.total,
            o.status || 'n/a'
        ]);
        const csvContent = [headers, ...rows].map(row =>
            row.map(cell => {
                const str = String(cell ?? '');
                return str.includes(',') || str.includes('"') || str.includes('\n')
                    ? `"${str.replace(/"/g, '""')}"`
                    : str;
            }).join(',')
        ).join('\n');
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const date = new Date().toISOString().slice(0, 10);
        link.href = url;
        link.download = `comenzi_luci_${date}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast(`${orders.length} comenzi exportate!`, 'success');
        btn.disabled = false;
        btn.textContent = 'Descarcă CSV';
    }).catch(() => {
        toast('Eroare la export.', 'error');
        btn.disabled = false;
        btn.textContent = 'Descarcă CSV';
    });
}

document.getElementById('export-csv-btn')?.addEventListener('click', exportOrdersCSV);
document.getElementById('settings-telemetry-enable-btn')?.addEventListener('click', toggleTelemetryEnabled);
document.getElementById('dash-open-telemetry')?.addEventListener('click', () => navigate('telemetry'));

document.getElementById('logout-btn')?.addEventListener('click', doLogout);
document.getElementById('login-btn')?.addEventListener('click', doLogin);
document.getElementById('passkey-btn')?.addEventListener('click', doPasskey);
document.getElementById('p')?.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

// Theme toggle — same pattern as index.html
const adminThemeToggle = document.getElementById('theme-toggle');
if (adminThemeToggle) {
    const initTheme = localStorage.getItem('admin_theme') ||
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', initTheme);
    adminThemeToggle.setAttribute('data-active', initTheme === 'dark' ? 'true' : 'false');

    adminThemeToggle.addEventListener('click', () => {
        const isDark = adminThemeToggle.getAttribute('data-active') === 'true';
        const newTheme = isDark ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('admin_theme', newTheme);
        adminThemeToggle.setAttribute('data-active', isDark ? 'false' : 'true');
    });
}
