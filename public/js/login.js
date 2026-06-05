const toBase64Url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
const b64urlToBuffer = b64url => { if (!b64url) return null; const b64 = b64url.replace(/-/g,'+').replace(/_/g,'/'); const padded = b64.padEnd(b64.length + (4 - b64.length % 4) % 4, '='); return Uint8Array.from(atob(padded), c => c.charCodeAt(0)); };
let conditionalAbortController = null;

async function checkAuthMethods(){
  try { const d = await fetch('/api/admops/auth-methods', { credentials:'include' }).then(r=>r.json()); return d.methods || ['password']; }
  catch { return ['password']; }
}

function showError(msg){
  const errEl = document.getElementById('login-err');
  errEl.textContent = msg;
  errEl.style.display = 'block';
}

async function doLogin(){
  const username = document.getElementById('u').value.trim();
  const password = document.getElementById('p').value;
  const rememberMe = !!document.getElementById('remember-me-check').checked;
  const btn = document.getElementById('login-btn');
  if (!username || !password) return showError('Completeaza toate campurile.');
  btn.disabled = true; btn.textContent = '...';
  try {
    const res = await fetch('/api/admops/login', {
      method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include',
      body: JSON.stringify({ username, password, rememberMe })
    });
    const d = await res.json();
    if (d.success) location.href = '/admops';
    else showError(d.error || 'Eroare login.');
  } catch {
    showError('Server indisponibil.');
  } finally {
    btn.disabled = false; btn.textContent = 'Intra';
  }
}

async function submitPasskeyCredential(credential) {
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
    method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include',
    body: JSON.stringify({ credential: credJSON })
  });
  const verifyData = await verifyRes.json();
  if (verifyData.success) location.href='/admops';
  else showError(verifyData.error || 'Autentificare esuata.');
}

async function doPasskey(){
  if (conditionalAbortController) {
    conditionalAbortController.abort();
    conditionalAbortController = null;
  }
  const btn = document.getElementById('passkey-btn');
  btn.disabled = true; btn.textContent = 'Se asteapta passkey...';
  try {
    const optsRes = await fetch('/api/admops/webauthn/auth-options', { credentials:'include' });
    const opts = await optsRes.json();
    if (!opts.challenge) throw new Error(opts.error || 'Nu pot genera optiunile WebAuthn.');
    const authOpts = {
      challenge: b64urlToBuffer(opts.challenge),
      rpId: opts.rpId,
      allowCredentials: (opts.allowCredentials || []).map(c => ({ ...c, id: b64urlToBuffer(c.id) })),
      userVerification: opts.userVerification || 'preferred',
      timeout: opts.timeout
    };
    const credential = await navigator.credentials.get({ publicKey: authOpts });
    await submitPasskeyCredential(credential);
  } catch (e) {
    showError(e.name === 'NotAllowedError' ? 'Ai anulat cererea. Incearca din nou.' : (e.message || 'Eroare passkey.'));
  } finally {
    btn.disabled = false; btn.textContent = 'Intra cu Passkey';
  }
}

function setInitialTheme(){
  const dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
}

async function init(){
  setInitialTheme();

  document.getElementById('login-form').addEventListener('submit', e => {
    e.preventDefault();
    doLogin();
  });
  document.getElementById('passkey-btn').addEventListener('click', doPasskey);

  const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  if (mq && typeof mq.addEventListener === 'function') {
    mq.addEventListener('change', e => {
      document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
    });
  }

  const methods = await checkAuthMethods();
  const hasPasskey = methods.includes('passkey') && window.PublicKeyCredential;
  const passkeyHint = document.getElementById('passkey-hint');
  if (hasPasskey) {
    document.getElementById('passkey-btn').style.display = 'flex';
    document.getElementById('login-divider').style.display = 'flex';
    if (passkeyHint) passkeyHint.style.display = 'none';
  } else if (passkeyHint) {
    passkeyHint.style.display = 'block';
  }
  if (hasPasskey && window.PublicKeyCredential && await PublicKeyCredential.isConditionalMediationAvailable()) {
    try {
      const optsRes = await fetch('/api/admops/webauthn/auth-options', { credentials:'include' });
      const opts = await optsRes.json();
      if (opts.challenge) {
        conditionalAbortController = new AbortController();
        const credential = await navigator.credentials.get({
          publicKey: {
            challenge: b64urlToBuffer(opts.challenge),
            rpId: opts.rpId,
            allowCredentials: (opts.allowCredentials || []).map(c => ({ ...c, id: b64urlToBuffer(c.id) })),
            userVerification: opts.userVerification || 'preferred',
            timeout: opts.timeout
          },
          mediation: 'conditional',
          signal: conditionalAbortController.signal
        });
        if (credential) await submitPasskeyCredential(credential);
      }
    } catch (e) {
      if (e.name !== 'AbortError') console.log('Conditional passkey skipped:', e.message);
    }
  }
}

init();
