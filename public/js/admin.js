let allProducts = [];
let wsConnected = false;
let conditionalAbortController = null;

const toBase64Url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
const b64urlToBuffer = b64url => { if (!b64url) return null; const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/'); const padded = b64.padEnd(b64.length + (4 - b64.length % 4) % 4, '='); return Uint8Array.from(atob(padded), c => c.charCodeAt(0)); };

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

const socket = typeof io !== 'undefined' ? io() : null;

if (socket) {
    socket.on('connect', () => {
        wsConnected = true;
        console.log('[WS] Connected:', socket.id);
    });
    socket.on('disconnect', () => {
        wsConnected = false;
        console.log('[WS] Disconnected');
    });
    socket.on('connect_error', e => {
        console.error('[WS] Connection error:', e.message);
    });

    socket.on('new_order', order => {
        notificationSound();
        toast(`Comanda noua: ${order.id} — ${order.customer?.name || 'Client'} — ${order.total} MDL`, 'success');
        if (typeof loadOrders === 'function') loadOrders();
        if (typeof loadDashboard === 'function') loadDashboard();
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
                _knownDeviceTokens = new Set(d.passkeys.map(p => p.credentialID));
            }
        })
        .catch(() => {});
} else {
    console.warn('[WS] Socket.io not loaded — skipping WebSocket connection');
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

if (socket) {
    socket.on('connect', registerDeviceSocket);

    // Server fires this when the current device is revoked by another session.
    socket.on('force_logout', () => {
        toast('Dispozitiv revocat. Se deconectează...', 'error');
        setTimeout(() => {
            fetch('/api/admops/logout', { method: 'POST', credentials: 'include' })
                .finally(() => { window.location.href = '/admin'; });
        }, 1500);
    });
}

// ── Volume control — injected into the settings page ─────────────────────────
function renderVolumeControl() {
    if (document.getElementById('sound-vol-section')) return; // already rendered
    const page = document.getElementById('page-settings');
    if (!page) return;

    const saved = getSoundVolume();
    const pct   = Math.round(saved * 100);

    const section = document.createElement('div');
    section.id = 'sound-vol-section';
    section.className = 'settings-collapse';
    section.innerHTML = `
        <button id="vol-toggle-btn" class="settings-collapse-toggle">
            <span>⚙ Volum notificări</span>
            <span id="vol-toggle-arrow" class="settings-collapse-arrow">▼</span>
        </button>
        <div class="settings-collapse-body" id="vol-body-wrap">
          <div class="settings-collapse-body-inner">
            <div style="display:flex;align-items:center;gap:10px;margin:12px 0 10px;">
                <span style="font-size:0.95rem;opacity:0.5;">🔈</span>
                <input id="sound-vol-slider" type="range" min="0" max="100" value="${pct}"
                    style="flex:1;accent-color:var(--p);cursor:pointer;">
                <span style="font-size:0.95rem;opacity:0.9;">🔊</span>
                <span id="vol-label" style="font-size:0.82rem;color:var(--p);font-weight:600;min-width:32px;text-align:right;">${pct}%</span>
            </div>
            <div style="display:flex;justify-content:flex-end;">
                <button id="vol-test-btn" style="background:none;border:1px solid var(--border);color:var(--sub);border-radius:6px;padding:3px 12px;font-size:0.78rem;cursor:pointer;">▶ Test</button>
            </div>
          </div>
        </div>`;

    // Append at the very bottom of the settings page
    page.appendChild(section);

    document.getElementById('vol-toggle-btn').addEventListener('click', () => {
        const wrap = document.getElementById('sound-vol-section');
        if (!wrap) return;
        const isOpen = wrap.classList.toggle('open');
        if (!isOpen) {
            // allow transition to finish before fully collapsing padding
            setTimeout(() => {
                if (!wrap.classList.contains('open')) {
                    const inner = wrap.querySelector('.settings-collapse-body-inner');
                    if (inner) inner.scrollTop = 0;
                }
            }, 280);
        }
    });

    document.getElementById('sound-vol-slider').addEventListener('input', e => {
        const val = parseInt(e.target.value) / 100;
        localStorage.setItem('admin_sound_vol', val.toFixed(2));
        document.getElementById('vol-label').textContent = e.target.value + '%';
    });

    document.getElementById('vol-test-btn').addEventListener('click', () => {
        playSound('NewOrderSound.mp3');
    });
}

async function initAdmin() {
    const loader = document.getElementById('loader');
    try {
        const r = await fetch('/api/admops/orders', { credentials: 'include' });
        if (r.status === 401) { showLoginScreen(); }
        else { showAdmin(); }
    } catch { showLoginScreen(); }
    finally {
        if (loader) { loader.classList.add('hidden'); setTimeout(() => loader.remove(), 520); }
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
    if (res.status === 401) { showLoginScreen(); throw new Error('Unauthorized'); }
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
    const ua = navigator.userAgent;

    // ── OS from UA (reliable everywhere) ─────────────────────────────────────
    let os = 'Dispozitiv';
    if (/Windows/.test(ua))                   os = 'Windows';
    else if (/iPhone/.test(ua))               os = 'iPhone';
    else if (/iPad/.test(ua))                 os = 'iPad';
    else if (/Android/.test(ua))              os = 'Android';
    else if (/Mac OS X/.test(ua))             os = 'Mac';
    else if (/Linux/.test(ua))                os = 'Linux';

    // ── Browser via userAgentData (Chromium-based browsers) ──────────────────
    if (navigator.userAgentData) {
        try {
            // getHighEntropyValues gives us the real brand list incl. Brave
            const hints = await navigator.userAgentData.getHighEntropyValues(['platform', 'brands']);
            const brands = (hints.brands || navigator.userAgentData.brands || [])
                .map(b => b.brand.toLowerCase());

            // Override OS with the platform hint when available (more reliable than UA)
            const platform = (hints.platform || navigator.userAgentData.platform || '').toLowerCase();
            if (platform) {
                if (/win/.test(platform))     os = 'Windows';
                else if (/mac/.test(platform))os = 'Mac';
                else if (/linux/.test(platform) && !/android/.test(platform)) os = 'Linux';
                else if (/android/.test(platform)) os = 'Android';
            }

            if (brands.some(b => b.includes('brave')))           return `${os} (Brave)`;
            if (brands.some(b => b.includes('microsoft edge')))  return `${os} (Edge)`;
            if (brands.some(b => b.includes('opera')))           return `${os} (Opera)`;
            if (brands.some(b => b.includes('google chrome') || b.includes('chromium')))
                                                                  return `${os} (Chrome)`;
        } catch (e) { /* fall through */ }
    }

    // ── UA string fallback (Firefox, Safari, iOS browsers, older Chromium) ───
    let browser = 'Browser';
    if (/Edg\/|EdgA\/|EdgiOS\//.test(ua))   browser = 'Edge';
    else if (/OPR\/|Opera\/|OPiOS\//.test(ua)) browser = 'Opera';
    else if (/SamsungBrowser\//.test(ua))     browser = 'Samsung Internet';
    else if (/CriOS\//.test(ua))              browser = 'Chrome';   // Chrome on iOS
    else if (/FxiOS\//.test(ua))              browser = 'Firefox';  // Firefox on iOS
    else if (/Firefox\//.test(ua))            browser = 'Firefox';
    else if (/Chrome\//.test(ua))             browser = 'Chrome';
    else if (/Safari\//.test(ua))             browser = 'Safari';

    return `${os} (${browser})`;
}

async function doRegisterPasskey() {
    const btn = document.getElementById('add-passkey-btn');
    if(btn) { btn.disabled = true; btn.textContent = 'Se inregistreaza...'; }
    try {
        const optsRes = await fetch('/api/admops/webauthn/register-options', { credentials: 'include' });
        const opts = await optsRes.json();
        if (!opts.challenge) throw new Error(opts.error || 'Eroare generare optiuni.');
        
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
        const transports = credential.response && credential.response.getTransports ? credential.response.getTransports() : ['internal'];
        const deviceName = await detectClientDeviceName();
        const credJSON = {
            id: credential.id,
            rawId: toBase64Url(credential.rawId),
            type: credential.type,
            response: {
                attestationObject: toBase64Url(credential.response.attestationObject),
                clientDataJSON: toBase64Url(credential.response.clientDataJSON)
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
            toast('Passkey inregistrat cu succes pe acest dispozitiv!', 'success');
            location.reload();
        } else {
            throw new Error(verifyData.error || 'Inregistrare esuata.');
        }
    } catch (e) {
        if (e.name === 'InvalidStateError') {
            localStorage.setItem('passkeyRegisteredHere', 'true');
            toast('Passkey deja înregistrat pe acest dispozitiv!', 'success');
            checkCurrentDevicePasskey();
        } else if (e.name === 'NotAllowedError') {
            toast('Inregistrare anulata.', 'error');
        } else {
            toast(e.message || 'Eroare passkey.', 'error');
        }
    } finally {
        if(btn) { btn.disabled = false; btn.textContent = '+ Adaugă Passkey'; }
    }
}

function doLogout() {
    fetch('/api/admops/logout', { method: 'POST', credentials: 'include' }).then(() => location.reload());
}

function showAdmin() {
    document.getElementById('login-screen').classList.remove('visible');
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-screen').classList.add('visible');
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
    if (page==='dashboard') loadDashboard();
    if (page==='orders')    loadOrders();
    if (page==='products')  loadProducts();
    if (page==='telemetry') loadTelemetry();
    if (page==='settings')  { renderVolumeControl(); loadPasskeysList(); checkCurrentDevicePasskey(); }
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

function loadTelemetry() {
    const syncCard = document.querySelector('#page-telemetry .telemetry-card:nth-child(3) .telemetry-value');
    if (syncCard) {
        syncCard.textContent = new Date().toLocaleString('ro-RO', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}
function catBadge(cat) {
    const c = cat||'General';
    return `<span class="badge b-${esc(c)}">${esc(c)}</span>`;
}
function renderOrderCard(o) {
    const items = (o.cart||[]).map(i=>`${esc(i.name)} ×${esc(i.qty)}`).join(', ');
    return `<div class="ocard">
    <div class="ocard-top"><div class="ocard-name">${esc(o.customer?.name||'—')}</div><div class="ocard-total">${esc(o.total)} MDL</div></div>
    <div class="ocard-meta">${esc(o.customer?.phone||'')}${o.customer?.address?' · '+esc(o.customer.address):''}<br>${items}<br>${fmtDate(o.timestamp)}</div>
    <div class="ocard-id">${esc(o.id)}</div>
  </div>`;
}

async function loadDashboard() {
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
        const empty=`<tr><td colspan="5" style="text-align:center;padding:26px;color:var(--sub);">Nicio comandă încă.</td></tr>`;
        document.getElementById('dash-tbody').innerHTML = recent.length===0 ? empty : recent.map(o=>`<tr>
          <td><span class="oid">${esc(o.id)}</span></td>
          <td>${esc(o.customer?.name||'—')}</td>
          <td>${esc(o.customer?.phone||'—')}</td>
          <td class="ototal">${esc(o.total)} MDL</td>
          <td>${fmtDate(o.timestamp)}</td>
        </tr>`).join('');
        const dc=document.getElementById('dash-cards');
        dc.innerHTML=recent.length===0?`<div class="empty">Nicio comandă încă.</div>`:recent.map(renderOrderCard).join('');
    } catch(e){console.error(e);}
}

async function loadOrders() {
    const tbody=document.getElementById('orders-tbody');
    const cards=document.getElementById('orders-cards');
    tbody.innerHTML=`<tr><td colspan="6" style="text-align:center;padding:26px;color:var(--sub);">Se încarcă...</td></tr>`;
    cards.innerHTML=`<div class="empty">Se încarcă...</div>`;
    try {
        const d=await api('/api/admops/orders');
        const orders=[...(d.orders||[])].reverse();
        if (!orders.length) { tbody.innerHTML=`<tr><td colspan="6" style="text-align:center;padding:26px;color:var(--sub);">Nicio comandă.</td></tr>`; cards.innerHTML=`<div class="empty">Nicio comandă.</div>`; return; }
        tbody.innerHTML=orders.map(o=>{ const items=(o.cart||[]).map(i=>`${esc(i.name)} ×${esc(i.qty)}`).join(', '); return `<tr>
        <td><span class="oid">${esc(o.id)}</span></td>
        <td><strong>${esc(o.customer?.name||'—')}</strong><br><small style="color:var(--sub);">${esc(o.customer?.address||'')}</small></td>
        <td>${esc(o.customer?.phone||'—')}<br><small style="color:var(--sub);">${esc(o.customer?.email||'')}</small></td>
        <td><div class="oitems">${items}</div></td>
        <td class="ototal">${esc(o.total)} MDL</td>
        <td>${fmtDate(o.timestamp)}</td>
      </tr>`; }).join('');
        cards.innerHTML=orders.map(renderOrderCard).join('');
    } catch { tbody.innerHTML=`<tr><td colspan="6" style="text-align:center;padding:26px;color:var(--red);">Eroare.</td></tr>`; }
}

async function loadProducts() {
    try { const d=await api('/api/admops/products'); allProducts=d.products||[]; renderProducts(); } catch(e){console.error(e);}
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
    const res = await fetch('/api/admops/passkeys', { credentials: 'include' });
    const data = await res.json();
    const container = document.getElementById('passkeys-container');
    const listDiv   = document.getElementById('passkeys-list');
    if (!data.success || !data.passkeys.length) {
        if (listDiv) listDiv.style.display = 'none';
        return;
    }
    if (listDiv) listDiv.style.display = 'block';

    container.innerHTML = data.passkeys.map(p => {
        const methodIcons = [];
        if (p.authMethods?.includes('passkey'))  methodIcons.push('<span style="font-size:0.72rem;background:var(--p);color:#fff;padding:1px 7px;border-radius:20px;">Passkey</span>');
        if (p.authMethods?.includes('password')) methodIcons.push('<span style="font-size:0.72rem;background:var(--border);color:var(--text);padding:1px 7px;border-radius:20px;">Parolă</span>');
        const currentBadge = p.isCurrentDevice
            ? '<span style="font-size:0.7rem;color:var(--p);margin-left:6px;">● Curent</span>'
            : '';
        const lastSeenStr = p.lastSeen
            ? new Date(p.lastSeen).toLocaleString('ro-RO', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })
            : '—';
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:13px 0;border-bottom:1px solid var(--border);cursor:pointer;" onclick="openDeviceModal('${esc(p.credentialID)}')">
            <div>
                <div style="font-weight:500;">${esc(p.deviceName)}${currentBadge}</div>
                <div style="font-size:0.78rem;color:var(--sub);margin-top:3px;">Ultima activitate: ${lastSeenStr}</div>
                <div style="display:flex;gap:5px;margin-top:5px;">${methodIcons.join('')}</div>
            </div>
            <span style="color:var(--sub);font-size:1.1rem;">›</span>
        </div>`;
    }).join('');
}

let currentDeviceCredId = null;

function openDeviceModal(deviceToken) {
    currentDeviceCredId = deviceToken;

    // Fetch devices list + this device's activity in parallel
    const devRes = fetch('/api/admops/passkeys', { credentials: 'include' }).then(r => r.json());
    const actRes = fetch(`/api/admops/activity?credId=${encodeURIComponent(deviceToken)}&limit=20`, { credentials: 'include' }).then(r => r.json());

    Promise.all([devRes, actRes]).then(([data, actData]) => {
        if (!data.success) return;
        const p = data.passkeys.find(x => x.credentialID === deviceToken);
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

        const modalBodyHtml = `
            <div style="display:grid;gap:0;">
                <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);">
                    <span style="color:var(--sub);">Dispozitiv</span>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <span style="font-weight:500;" id="device-name-display">${esc(p.deviceName)}${currentBadge}</span>
                        <button onclick="startRenamePasskey('${esc(deviceToken)}')" style="background:none;border:1px solid var(--border);cursor:pointer;color:var(--p);font-size:0.72rem;padding:2px 8px;border-radius:4px;">Redenumește</button>
                    </div>
                </div>
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

accentBtn.addEventListener('click', () => {
    if (isAccentPickerOpen) {
        accentPicker.classList.remove('open');
        isAccentPickerOpen = false;
        return;
    }
    const current = getComputedStyle(document.documentElement).getPropertyValue('--p').trim();
    setSwatchSelection(current);
    pendingAccent = current;
    accentPicker.classList.add('open');
    isAccentPickerOpen = true;
});

accentCancelBtn.addEventListener('click', () => {
    accentPicker.classList.remove('open');
    isAccentPickerOpen = false;
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
        accentPicker.classList.remove('open');
        isAccentPickerOpen = false;
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

document.getElementById('export-csv-btn').addEventListener('click', exportOrdersCSV);

document.getElementById('logout-btn').addEventListener('click', doLogout);
document.getElementById('login-btn').addEventListener('click', doLogin);
document.getElementById('passkey-btn').addEventListener('click', doPasskey);
document.getElementById('p').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

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
