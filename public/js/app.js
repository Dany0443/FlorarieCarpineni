/**
 * LuciUI - Project Enhancements Module
 * Handles: Real Progress Loader, Scroll Reveals, Smart Header, Bottom Sheet, and View Transitions
 */
const LuciUI = (function(window, document) {
    'use strict';

    let _scrollObserver = null;

    /**
     * Loader with real asset progress
     */
    function initLoader() {
        const loader = document.getElementById('loader');
        if (!loader) return;

        const dismissLoader = () => {
            const loader = document.getElementById('loader');
            if (loader) {
                loader.classList.add('hidden');
                setTimeout(() => loader.remove(), 520);
            }
        };

        const waitForImages = () => {
            const imgs = Array.from(document.querySelectorAll('img'));
            return Promise.all(imgs.map(img => {
                if (img.complete) return Promise.resolve();
                return new Promise(resolve => {
                    img.addEventListener('load', resolve, { once: true });
                    img.addEventListener('error', resolve, { once: true });
                });
            }));
        };

        const waitForModels = () => {
            const viewers = Array.from(document.querySelectorAll('model-viewer'));
            return Promise.all(viewers.map(v => new Promise(resolve => {
                v.addEventListener('load', resolve, { once: true });
                v.addEventListener('error', resolve, { once: true });
                setTimeout(resolve, 3000); // Max wait
            })));
        };

        const domReady = new Promise(resolve => {
            if (document.readyState !== 'loading') resolve();
            else document.addEventListener('DOMContentLoaded', resolve, { once: true });
        });

        const windowLoad = new Promise(resolve => {
            if (document.readyState === 'complete') resolve();
            else window.addEventListener('load', resolve, { once: true });
        });

        Promise.all([domReady, windowLoad, waitForImages(), waitForModels()])
            .finally(() => {
                dismissLoader();
            });
    }

    /**
     * Scroll Reveal Animations
     */
    function initScrollReveal() {
        if (_scrollObserver) _scrollObserver.disconnect();

        _scrollObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                const el = entry.target;
                const delay = Number(el.dataset.revealDelay || 0);
                setTimeout(() => {
                    el.classList.add('is-visible', 'visible');
                    // Reset dynamic delay after reveal so later style changes (ex: theme)
                    // are not artificially delayed.
                    el.style.transitionDelay = '0ms';
                    _scrollObserver.unobserve(el);
                }, delay);
            });
        }, { threshold: 0.06, rootMargin: '0px 0px -48px 0px' });

        document.querySelectorAll('.info-section h2, .section-header h2, .services-header h2, .info-card, .service-card, .card').forEach((el, i) => {
            if (el.classList.contains('reveal') || el.classList.contains('reveal-heading')) {
                if (!el.classList.contains('is-visible') && !el.classList.contains('visible')) {
                    const isCard = el.classList.contains('card');
                    const baseDelay = isCard ? (i % 4) * 70 : (i % 3) * 45;
                    const randomJitter = isCard ? Math.floor(Math.random() * 140) : Math.floor(Math.random() * 50);
                    const revealDelay = Math.min(baseDelay + randomJitter, 420);
                    el.dataset.revealDelay = String(revealDelay);
                    el.style.transitionDelay = `${revealDelay}ms`;
                }
                _scrollObserver.observe(el);
                return;
            }
            el.classList.add(el.tagName === 'H2' ? 'reveal-heading' : 'reveal');
            const isCard = el.classList.contains('card');
            const baseDelay = isCard ? (i % 4) * 70 : (i % 3) * 45;
            const randomJitter = isCard ? Math.floor(Math.random() * 140) : Math.floor(Math.random() * 50);
            const revealDelay = Math.min(baseDelay + randomJitter, 420);
            el.dataset.revealDelay = String(revealDelay);
            el.style.transitionDelay = `${revealDelay}ms`;
            _scrollObserver.observe(el);
        });

        return _scrollObserver;
    }

    /**
     * Smart Header (Hide on scroll down, show on up)
     */
    function initSmartHeader() {
        const navbar = document.querySelector('.navbar');
        if (!navbar) return;

        let lastScrollY = window.scrollY;
        let ticking = false;

        const updateHeader = () => {
            const scrollY = window.scrollY;
            const delta = scrollY - lastScrollY;

            if (scrollY < 100) {
                navbar.classList.remove('nav-hidden');
            } else if (delta > 10) {
                navbar.classList.add('nav-hidden');
            } else if (delta < -15) {
                navbar.classList.remove('nav-hidden');
            }

            lastScrollY = scrollY;
            ticking = false;
        };

        window.addEventListener('scroll', () => {
            if (!ticking) {
                window.requestAnimationFrame(updateHeader);
                ticking = true;
            }
        }, { passive: true });
    }

    /**
     * Bottom Sheet for Mobile Settings
     */
    function initBottomSheet() {
        if (window.innerWidth > 1024) return;

        const backdrop = document.createElement('div');
        backdrop.className = 'lb-sheet-backdrop';
        document.body.appendChild(backdrop);

        const sheet = document.createElement('div');
        sheet.className = 'lb-bottom-sheet lb-sheet';
        sheet.innerHTML = `
            <div class="lb-sheet-handle"></div>
            <div class="lb-sheet-title">Limbă & Temă</div>
            <div class="lang-group">
                <button class="lang-btn" data-lang="ro">RO</button>
                <button class="lang-btn" data-lang="en">EN</button>
                <button class="lang-btn" data-lang="ru">RU</button>
            </div>
            <div class="lb-sheet-theme-row">
                <span class="lb-sheet-theme-label" data-i18n="theme_dark" data-i18n-attr="textContent"></span>
                <button class="theme-pill" id="sheet-theme-pill"></button>
            </div>`;
        document.body.appendChild(sheet);

        const trigger = document.createElement('button');
        trigger.className = 'lb-sheet-trigger';
        trigger.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
        document.body.appendChild(trigger);

        const openSheet = () => {
            sheet.classList.add('open');
            backdrop.style.display = 'block';
            requestAnimationFrame(() => backdrop.classList.add('open'));
            document.body.style.overflow = 'hidden';
            syncSheet();
        };

        const closeSheet = () => {
            sheet.classList.remove('open');
            backdrop.classList.remove('open');
            setTimeout(() => {
                backdrop.style.display = 'none';
                document.body.style.overflow = '';
            }, 300);
        };

        const syncSheet = () => {
            const currentLang = (typeof detectLang === 'function' ? detectLang() : localStorage.getItem('lb_lang')) || 'ro';
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            sheet.querySelectorAll('.lang-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.lang === currentLang);
            });
            const pill = sheet.querySelector('.theme-pill');
            pill.classList.toggle('active', isDark);
            pill.setAttribute('data-active', isDark ? 'true' : 'false');
            const label = sheet.querySelector('.lb-sheet-theme-label');
            if (typeof t === 'function') {
                label.textContent = t(isDark ? 'theme_dark' : 'theme_light');
            }
        };

        trigger.addEventListener('click', openSheet);
        backdrop.addEventListener('click', closeSheet);
        
        sheet.querySelectorAll('.lang-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (typeof window.setLang === 'function') {
                    LuciUI.withViewTransition(() => window.setLang(btn.dataset.lang));
                }
                setTimeout(closeSheet, 150);
            });
        });

        sheet.querySelector('.theme-pill').addEventListener('click', () => {
            if (typeof window.applyTheme === 'function') {
                const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
                LuciUI.withViewTransition(() => window.applyTheme(isDark ? 'light' : 'dark'));
                syncSheet();
            }
        });

        // Swipe down to close
        let touchY = 0;
        sheet.addEventListener('touchstart', e => touchY = e.touches[0].clientY, { passive: true });
        sheet.addEventListener('touchend', e => {
            if (e.changedTouches[0].clientY - touchY > 50) closeSheet();
        }, { passive: true });
    }

    /**
     * View Transition Wrapper
     */
    let _vtBusy = false;
    function withViewTransition(callback) {
        if (document.startViewTransition) {
            if (_vtBusy) {
                // A transition is already running — skip the animation, just run the update
                callback();
                return;
            }
            _vtBusy = true;
            const t = document.startViewTransition(callback);
            t.finished.finally(() => { _vtBusy = false; });
            return t;
        }
        callback();
    }

    function init() {
        initLoader();
        initSmartHeader();
        initScrollReveal();
        initBottomSheet();
    }

    return {
        init,
        refreshReveal: initScrollReveal,
        withViewTransition,
        get observer() { return _scrollObserver; }
    };
})(window, document);

document.addEventListener('DOMContentLoaded', () => LuciUI.init());

let preloadedModels = new Set();
let allProducts = [];

// setari minime daca e pe dispozitiv slab
const PE_MOBIL = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && window.innerWidth < 1024);

const DISPOZITIV_SLAB = PE_MOBIL && (
    (navigator.hardwareConcurrency || 4) < 4 ||
    (navigator.deviceMemory || 4) < 2
);

const CACHE_MODELE = 'lb-modele-3d-v1';
const modeleCached = new Set();

const mobileMenu = document.querySelector('.mobile-menu');
const menuBtn = document.getElementById('menu-btn');
const closeMenuBtn = document.querySelector('.close-menu');
const productContainer = document.getElementById('products-container');
const cartDrawer = document.querySelector('.cart-drawer');
const cartOverlay = document.querySelector('.cart-overlay');
const cartBtn = document.getElementById('cart-btn');
const closeCartBtn = document.querySelector('.close-cart');
const cartItemsContainer = document.querySelector('.cart-items');
const cartTotalEl = document.getElementById('cart-total');
const cartCountEl = document.getElementById('cart-count');
const checkoutBtn = document.getElementById('checkout-btn');

const modal = document.getElementById('product-modal');
const modalImg = modal?.querySelector('.modal-img');
const modalTitle = modal?.querySelector('.modal-title');
const modalPrice = modal?.querySelector('.modal-price');
const modalAddBtn = modal?.querySelector('.modal-add-btn');
const modalClose = modal?.querySelector('.modal-close');
const modalFamily = document.getElementById('modal-family');
const modalDesc = document.getElementById('modal-desc');
const modalCare = document.getElementById('modal-care');
const modalNote = document.getElementById('modal-note');

const modal3D = document.getElementById('modal-3d');
const close3D = document.getElementById('close-3d');
const modelViewer = document.getElementById('flower-viewer');

// ── FPS tracking for 3D modal ──────────────────────────────
let _fpsRafId    = null;
let _fpsActive   = false;
let _fpsFrames   = 0;    // frames counted while visible
let _fpsMs       = 0;    // accumulated visible milliseconds
let _fpsPrevNow  = null; // previous rAF timestamp

function _startFpsMeasure() {
    if (_fpsRafId) { cancelAnimationFrame(_fpsRafId); _fpsRafId = null; }
    _fpsActive  = true;
    _fpsFrames  = 0;
    _fpsMs      = 0;
    _fpsPrevNow = null;

    function frame(now) {
        if (!_fpsActive) return;
        if (_fpsPrevNow !== null && !document.hidden) {
            const dt = now - _fpsPrevNow;
            // Ignore gaps > 200ms (tab was hidden / throttled)
            if (dt > 0 && dt < 200) {
                _fpsFrames++;
                _fpsMs += dt;
            }
        }
        _fpsPrevNow = now;
        _fpsRafId = requestAnimationFrame(frame);
    }
    _fpsRafId = requestAnimationFrame(frame);
}

function _stopFpsMeasureAndSend(deviceType) {
    _fpsActive = false;
    if (_fpsRafId) { cancelAnimationFrame(_fpsRafId); _fpsRafId = null; }

    // Need at least 1 s of real visible time and 20 frames
    if (_fpsMs < 1000 || _fpsFrames < 20) {
        console.log('[FPS] Not enough data:', _fpsFrames, 'frames in', _fpsMs, 'ms');
        return;
    }

    const avgFps = Math.round((_fpsFrames / _fpsMs) * 1000 * 10) / 10;
    console.log('[FPS] Sending:', avgFps, 'fps,', _fpsFrames, 'frames,', Math.round(_fpsMs), 'ms, device:', deviceType);

    trackTelemetry('model_fps', {
        deviceType,
        avgFps,
        samples: _fpsFrames
    });
}

let cart = JSON.parse(localStorage.getItem('flowerCart')) || [];
let currentCategory = 'all';

function trackTelemetry(event, data) {
    try {
        if (window.Telemetry && typeof window.Telemetry.track === 'function') {
            window.Telemetry.track(event, data || {});
        }
    } catch (_) {}
}

document.addEventListener('DOMContentLoaded', async () => {
    setTimeout(() => {
        const loader = document.getElementById('loader');
        if(loader) {
            loader.classList.add('hidden');
            setTimeout(() => loader.remove(), 500);
        }
    }, 800);

    // tragem produsele proaspete de pe server
    try {
        const res  = await fetch('/api/products');
        const data = await res.json();
        if (data && data.success && Array.isArray(data.products) && data.products.length > 0) {
            allProducts = data.products;
        } else {
            allProducts = typeof productsData !== 'undefined' ? [...productsData] : [];
        }
    } catch (err) {
        console.warn('API Error, falling back to local data:', err);
        allProducts = typeof productsData !== 'undefined' ? [...productsData] : [];
    }

    if(productContainer) {
        renderProducts('all');
    }

    const imageUrls = allProducts.map(p => p.image).filter(Boolean);
    imageUrls.forEach((url, i) => {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = url;
        if (i < 4) link.setAttribute('fetchpriority', 'high');
        document.head.appendChild(link);
    });

    // Also warm the service worker cache for offline/return visits
    if ('serviceWorker' in navigator) {
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!refreshing) {
                refreshing = true;
                window.location.reload();
            }
        });

        navigator.serviceWorker.register('/sw.js').then(reg => {
            console.log('SW inregistrat cu succes:', reg.scope);
            const sendPreload = (sw) => {
                if (sw) sw.postMessage({ type: 'PRELOAD_IMAGES', urls: imageUrls });
            };
            if (navigator.serviceWorker.controller) {
                sendPreload(navigator.serviceWorker.controller);
            } else {
                navigator.serviceWorker.ready.then(r => sendPreload(r.active));
            }
        }).catch(err => console.log('Eroare SW:', err));

        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then(perm => {
                if (perm === 'granted') subscribePush();
            }).catch(() => {});
        } else if (Notification.permission === 'granted') {
            subscribePush();
        }
    }

    async function subscribePush() {
        try {
            const keyRes = await fetch('/api/vapid-key');
            const keyData = await keyRes.json();
            if (!keyData.publicKey) return;
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(keyData.publicKey)
            });
            await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sub.toJSON())
            });
        } catch (e) { console.warn('Push sub failed:', e); }
    }

    function urlBase64ToUint8Array(base64) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
        let bits = 0, val = 0, output = [];
        for (const c of base64) {
            bits += 6; val = (val << 6) | chars.indexOf(c);
            if (bits >= 8) { output.push((val >> (bits - 8)) & 0xFF); bits -= 8; }
        }
        return new Uint8Array(output);
    }

    updateCartUI();
    // setupScrollAnimations(); // Replaced by LuciUI.refreshReveal()
    initToggles();
    LuciUI.refreshReveal();

    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('product');
    if (productId) {
        setTimeout(() => openModal(parseInt(productId, 10)), 300);
    }

    if (window.requestIdleCallback) {
        requestIdleCallback(() => preload3DModels(), { timeout: 3000 });
    } else {
        setTimeout(preload3DModels, 2000);
    }
});

// pastram in cache sa se miste oleaca mai repede
async function cacheazaModel(url) {
    if (modeleCached.has(url)) return;
    modeleCached.add(url);
    try {
        const cache = await caches.open(CACHE_MODELE);
        const exista = await cache.match(url);
        if (exista) return;
        const resp = await fetch(url, { mode: 'cors', credentials: 'same-origin' });
        if (resp.ok) await cache.put(url, resp);
    } catch (_) {
        modeleCached.delete(url);
    }
}

function preload3DModels() {
    if (PE_MOBIL) return;

    const modele = allProducts.filter(p => p.model3d).map(p => p.model3d);
    if (!modele.length) return;

    if ('caches' in window) {
        modele.forEach((url, i) => {
            setTimeout(() => cacheazaModel(url), i * 800);
        });
    }
}

function initToggles() {
    const langSelectors = [document.getElementById('lang-selector'), document.getElementById('lang-selector-mobile')].filter(Boolean);
    const themeToggles = [document.getElementById('theme-toggle'), document.getElementById('theme-toggle-mobile')].filter(Boolean);

    // Initial Theme Apply (redundant but safe after head script)
    const savedTheme = localStorage.getItem('lb_theme') || 
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Language Selector Logic (3 Languages)
    const updateLangUI = (lang) => {
        langSelectors.forEach(selector => {
            selector.setAttribute('data-lang', lang);
            selector.querySelectorAll('.lang-option').forEach(opt => {
                opt.classList.toggle('active', opt.dataset.lang === lang);
            });
        });
        
        // Sync with any standard lang-btns that might exist
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === lang);
        });

        // Re-render products to update their text if they exist
        if (typeof renderProducts === 'function' && allProducts.length > 0) {
            renderProducts(currentCategory);
        }
    };

    // Hook into global lang change
    const originalOnLangChange = window.onLangChange;
    window.onLangChange = (lang) => {
        updateLangUI(lang);
        if (typeof originalOnLangChange === 'function') originalOnLangChange(lang);
    };

    // Use detectLang from i18n if available, otherwise fallback
    const currentLang = typeof detectLang === 'function' ? detectLang() : (localStorage.getItem('lb_lang') || 'ro');
    
    // We MUST call setLang here to ensure ALL text gets translated on load
    if (typeof setLang === 'function') {
        setLang(currentLang);
    } else {
        updateLangUI(currentLang);
    }

    langSelectors.forEach(selector => {
        selector.querySelectorAll('.lang-option').forEach(option => {
            option.addEventListener('click', () => {
                const lang = option.dataset.lang;
                if (typeof setLang === 'function') {
                    LuciUI.withViewTransition(() => setLang(lang));
                } else {
                    LuciUI.withViewTransition(() => {
                        localStorage.setItem('lb_lang', lang);
                        document.documentElement.lang = lang;
                        updateLangUI(lang);
                    });
                }
            });
        });
    });

    // Theme Toggle Logic
    const updateThemeUI = (isDark) => {
        themeToggles.forEach(toggle => {
            toggle.setAttribute('data-active', isDark);
        });
        
        // Sync with any theme-pills (like in bottom sheet)
        document.querySelectorAll('.theme-pill').forEach(pill => {
            pill.classList.toggle('active', isDark);
        });
    };

    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    updateThemeUI(currentTheme === 'dark');

    themeToggles.forEach(toggle => {
        toggle.addEventListener('click', () => {
            const isDark = toggle.getAttribute('data-active') === 'true';
            const newTheme = isDark ? 'light' : 'dark';
            
            if (typeof applyTheme === 'function') {
                LuciUI.withViewTransition(() => applyTheme(newTheme));
            } else {
                LuciUI.withViewTransition(() => {
                    document.documentElement.setAttribute('data-theme', newTheme);
                    localStorage.setItem('lb_theme', newTheme);
                });
            }
            updateThemeUI(!isDark);
        });
    });

    // Handle standard lang-btns if they exist elsewhere
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const lang = btn.dataset.lang;
            if (typeof setLang === 'function') {
                LuciUI.withViewTransition(() => setLang(lang));
            }
        });
    });
}

if(menuBtn && closeMenuBtn) {
    menuBtn.addEventListener('click', () => mobileMenu.classList.add('active'));
    closeMenuBtn.addEventListener('click', () => mobileMenu.classList.remove('active'));

    document.querySelectorAll('.mobile-menu a').forEach(link => {
        link.addEventListener('click', () => mobileMenu.classList.remove('active'));
    });
}

function buildCardElement(product, cart) {
    const inCartItem = cart ? cart.find(i => i.id === product.id) : null;
    const btnText = inCartItem ? `${window.t?.('in_cart') ?? 'În Coș'} (${inCartItem.qty}) +` : (window.t?.('add_to_cart') ?? 'Adaugă în coș');
    const btnClass = inCartItem ? 'add-btn in-cart' : 'add-btn';

    const card = document.createElement('div');
    card.className = 'card reveal'; 

    card.innerHTML = `
  <div class="card-img-wrapper" onclick="openModal(${product.id}, true)">
    <img alt="${product.name}" loading="lazy" decoding="async">
  </div>
  <div class="card-info">
    <h3 class="card-title" onclick="openModal(${product.id}, true)">${product.name}</h3>
    <div class="card-price">${product.price} MDL</div>
    <div class="btn-group">
      <button class="${btnClass}" id="btn-${product.id}" onclick="addToCart(${product.id})">
        ${btnText}
      </button>
    </div>
  </div>`;

    const img = card.querySelector('img');
    img.src = product.image;

    return card;
}

function renderProducts(category) {
    if(!productContainer) return;

    const hasRealCards = productContainer.querySelector('.card') !== null;
    if(currentCategory === category && hasRealCards) {
        return;
    }
    currentCategory = category;

    const filtered = category === 'all'
        ? allProducts
        : allProducts.filter(p => p.category === category);

    if(filtered.length === 0) {
        productContainer.innerHTML = `
            <div style="grid-column:1/-1; text-align:center; padding:3rem 1rem; color:var(--text-muted);">
                <p style="font-size:1.1rem; margin-bottom:0.5rem;">Nu am găsit produse în această categorie.</p>
                <p style="font-size:0.9rem;">Încearcă o altă categorie sau revino mai târziu.</p>
            </div>`;
        return;
    }

    const fragment = document.createDocumentFragment();

    filtered.forEach(product => {
        const card = buildCardElement(product, cart);
        fragment.appendChild(card);
    });

    productContainer.innerHTML = '';
    productContainer.appendChild(fragment);

    LuciUI.refreshReveal();
}

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        trackTelemetry('click', { label: `filter:${e.target.dataset.filter || 'all'}` });
        renderProducts(e.target.dataset.filter);
    });
});

function openModal(id, fromUserGesture) {
    const product = allProducts.find(p => p.id === id);
    if(!product || !modal) return;
    if (fromUserGesture) {
        trackTelemetry('product_view', { productId: String(product.id), productName: product.name, price: Number(product.price) || 0 });
    }

    modalImg.src = product.image;
    modalImg.alt = product.name;
    modalTitle.innerText = product.name;
    modalPrice.innerText = product.price + " MDL";

    modalFamily.innerHTML = `<strong>${t('modal_family')}</strong> ${product.family || '—'}`;
    modalDesc.innerHTML = `<strong>${t('modal_desc')}</strong> ${product.desc}`;
    modalCare.innerHTML = `<strong>${t('modal_care')}</strong> ${product.care || '—'}`;
    modalNote.innerHTML = `<em>${t('modal_note')} ${product.note || '—'}</em>`;

    const existing3dBtn = document.querySelector('.btn-3d');
    if(existing3dBtn) existing3dBtn.remove();
    const existingShareBtn = document.querySelector('.btn-share');
    if(existingShareBtn) existingShareBtn.remove();

    if (product.model3d) {
        const btn3d = document.createElement('button');
        btn3d.className = 'btn-3d';
        btn3d.innerHTML = t('modal_3d');
        btn3d.onclick = () => open3DModal(product.model3d);
        document.querySelector('.modal-text-block')?.appendChild(btn3d);
    }

    const shareBtn = document.createElement('button');
    shareBtn.className = 'btn-share';
    shareBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`;
    shareBtn.onclick = () => {
        const shareUrl = `${window.location.origin}/?product=${product.id}`;

        if (navigator.share) {
            navigator.share({
                title: product.name,
                text: `${product.name} - ${product.price} MDL`,
                url: shareUrl
            }).catch(() => {
                navigator.clipboard?.writeText(shareUrl);
                showNotification(t('notif_link_copied'));
            });
        } else {
            navigator.clipboard?.writeText(shareUrl);
            showNotification(t('notif_link_copied'));
        }
    };
    document.querySelector('.modal-actions-row')?.appendChild(shareBtn);

    const inCartItem = cart.find(item => item.id === product.id);
    modalAddBtn.innerText = inCartItem ? `${t('modal_add_more')} (${inCartItem.qty})` : t('modal_add');

    modalAddBtn.onclick = () => {
        addToCart(id);
        closeModal();
    };

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    const shareUrl = new URL(window.location.href);
    shareUrl.searchParams.set('product', product.id);
    window.history.replaceState({}, '', shareUrl);
}

function closeModal() {
    if(!modal) return;
    modal.classList.remove('active');
    document.body.style.overflow = '';

    const url = new URL(window.location.href);
    if (url.searchParams.has('product')) {
        url.searchParams.delete('product');
        window.history.replaceState({}, '', url);
    }
}

function resetViewer() {
    modelViewer.style.transition = 'none';
    modelViewer.style.opacity = '0';

    modelViewer.removeAttribute('src');
    modelViewer.removeAttribute('alt');
    modelViewer.removeAttribute('ios-src');
    try { modelViewer.src = ''; } catch (_) {}
}

function aplicaCalitate() {
    // camera-controls must always be set — required for touch interaction on mobile
    modelViewer.setAttribute('camera-controls', '');

    if (DISPOZITIV_SLAB) {
        modelViewer.setAttribute('shadow-intensity', '0');
        modelViewer.removeAttribute('auto-rotate');
        modelViewer.setAttribute('interaction-prompt', 'none');
    } else if (PE_MOBIL) {
        modelViewer.setAttribute('shadow-intensity', '0.5');
        modelViewer.setAttribute('auto-rotate', '');
        modelViewer.setAttribute('interaction-prompt', 'none');
        modelViewer.setAttribute('auto-rotate-delay', '1000');
    } else {
        modelViewer.setAttribute('shadow-intensity', '1.5');
        modelViewer.setAttribute('shadow-softness', '0.8');
        modelViewer.setAttribute('auto-rotate', '');
        modelViewer.setAttribute('auto-rotate-delay', '500');
        modelViewer.setAttribute('rotation-per-second', '20deg');
        modelViewer.setAttribute('interaction-prompt', 'none');
        modelViewer.setAttribute('environment-image', 'neutral');
        modelViewer.setAttribute('exposure', '1.1');
        modelViewer.setAttribute('tone-mapping', 'commerce');
        modelViewer.setAttribute('camera-orbit', '0deg 75deg 105%');
        modelViewer.setAttribute('min-camera-orbit', 'auto 0deg auto');
        modelViewer.setAttribute('max-camera-orbit', 'auto 180deg auto');
    }
}

async function esteInCache(url) {
    if (!('caches' in window)) return false;
    try {
        const cache = await caches.open(CACHE_MODELE);
        return !!(await cache.match(url));
    } catch (_) { return false; }
}

function open3DModal(modelPath) {
    if (!modal3D || !modelViewer) return;
    const product = allProducts.find(p => p.model3d === modelPath);
    const loadStartedAt = Date.now();
    const deviceType = PE_MOBIL ? 'mobile' : 'desktop';
    trackTelemetry('model_load_start', {
        productId: product ? String(product.id) : 'unknown',
        productName: product ? product.name : 'Unknown',
        deviceType
    });

    const modelWrapper = document.querySelector('.model-wrapper');

    resetViewer();
    aplicaCalitate();

    document.body.style.overflow = 'hidden';
    modal3D.classList.add('active');
    modelWrapper?.classList.add('loading');

    let attempts = 0;
    let timeoutId;

    function tryLoad() {
        attempts++;
        modelViewer.setAttribute('src', modelPath);
        modelViewer.setAttribute('alt', '3D Flower');

        // Do NOT restore opacity here — keep it at 0 until load fires.
        // Restoring early is what causes the old model to flash through.

        const limitaMs = DISPOZITIV_SLAB ? 15000 : PE_MOBIL ? 10000 : 6000;

        timeoutId = setTimeout(() => {
            if (attempts < 3) {
                modelViewer.removeAttribute('src');
                setTimeout(tryLoad, 400);
            } else {
                // Timed out after all retries — show whatever is there
                modelViewer.style.transition = 'opacity 0.2s ease';
                modelViewer.style.opacity = '1';
                modelWrapper?.classList.remove('loading');
            }
        }, limitaMs);
    }

    modelViewer.addEventListener('load', () => {
        clearTimeout(timeoutId);
        modelWrapper?.classList.remove('loading');
        trackTelemetry('model_load_end', {
            productId: product ? String(product.id) : 'unknown',
            productName: product ? product.name : 'Unknown',
            deviceType,
            durationMs: Date.now() - loadStartedAt
        });
        // Start FPS measurement now that model is rendered and animating
        _startFpsMeasure();
        // Fade in only now — new model is fully rendered
        modelViewer.style.transition = 'opacity 0.2s ease';
        modelViewer.style.opacity = '1';
        if (!PE_MOBIL) cacheazaModel(modelPath);
    }, { once: true });

    modelViewer.addEventListener('error', () => {
        clearTimeout(timeoutId);
        if (attempts < 3) {
            modelViewer.removeAttribute('src');
            setTimeout(tryLoad, 500);
        } else {
            trackTelemetry('model_error', {
                productId: product ? String(product.id) : 'unknown',
                productName: product ? product.name : 'Unknown',
                deviceType
            });
            modelWrapper?.classList.remove('loading');
        }
    }, { once: true });

    tryLoad();
}

function close3DModal() {
    if (!modal3D || !modelViewer) return;

    // Send FPS measurement before tearing down
    const deviceType = PE_MOBIL ? 'mobile' : 'desktop';
    _stopFpsMeasureAndSend(deviceType);

    const modelWrapper = document.querySelector('.model-wrapper');
    modal3D.classList.remove('active');

    setTimeout(() => {
        document.body.style.overflow = '';
        modelWrapper?.classList.remove('loading');
        resetViewer();
    }, 300);
}

if(modalClose) modalClose.addEventListener('click', closeModal);
if(close3D) close3D.addEventListener('click', close3DModal);

if(modal) {
    modal.addEventListener('click', (e) => {
        if(e.target === modal) closeModal();
    });
}
if(modal3D) {
    modal3D.addEventListener('click', (e) => {
        if(e.target === modal3D) close3DModal();
    });
}

document.addEventListener('keydown', (e) => {
    if(e.key === 'Escape') {
        if(modal?.classList.contains('active')) closeModal();
        if(modal3D?.classList.contains('active')) close3DModal();
    }
});

function addToCart(id) {
    const product = allProducts.find(p => p.id === id);
    if(!product) return;

    const existingItem = cart.find(item => item.id === id);

    if (existingItem) {
        existingItem.qty++;
        trackTelemetry('cart_add', { productId: String(product.id), productName: product.name, qty: existingItem.qty });
        showNotification(t('notif_more', { name: product.name, qty: existingItem.qty }));
    } else {
        cart.push({ ...product, qty: 1 });
        trackTelemetry('cart_add', { productId: String(product.id), productName: product.name, qty: 1 });
        showNotification(t('notif_added', { name: product.name }));
    }

    saveCart();
    updateCartUI();
    refreshProductButtons();
}

function decreaseQty(id) {
    const existingItem = cart.find(item => item.id === id);

    if (existingItem) {
        existingItem.qty--;
        if (existingItem.qty <= 0) {
            removeFromCart(id);
            return;
        }
    }

    saveCart();
    updateCartUI();
    refreshProductButtons();
}

function removeFromCart(id) {
    cart = cart.filter(item => item.id !== id);
    saveCart();
    updateCartUI();
    refreshProductButtons();
    showNotification(t('notif_removed'));
}

function refreshProductButtons() {
    if(!productContainer) return;

    allProducts.forEach(product => {
        const btn = document.getElementById(`btn-${product.id}`);
        if(!btn) return;

        const inCartItem = cart.find(item => item.id === product.id);
        if(inCartItem) {
            btn.innerText = `${t('in_cart')} (${inCartItem.qty}) +`;
            btn.classList.add('in-cart');
        } else {
            btn.innerText = t('add_to_cart');
            btn.classList.remove('in-cart');
        }
    });
}

function saveCart() {
    try {
        localStorage.setItem('flowerCart', JSON.stringify(cart));
    } catch(e) {
        showNotification(t('notif_cart_err'));
    }
}

function updateCartUI() {
    if(!cartItemsContainer) return;

    let total = 0;
    let count = 0;

    const checkoutBtnEl = document.querySelector('.checkout-btn');

    if(cart.length === 0) {
        cartItemsContainer.innerHTML = `<p style="text-align:center; padding:20px; color:var(--text-muted);">${t('cart_empty')}</p>`;
        if(cartTotalEl) cartTotalEl.innerText = "0 MDL";
        if(cartCountEl) { cartCountEl.innerText = "0"; cartCountEl.dataset.count = "0"; }
        if(checkoutBtnEl) {
            checkoutBtnEl.dataset.i18n = 'cart_see_products';
            checkoutBtnEl.textContent = t('cart_see_products');
        }
        return;
    }

    if(checkoutBtnEl) {
        checkoutBtnEl.dataset.i18n = 'cart_checkout';
        checkoutBtnEl.textContent = t('cart_checkout');
    }

    const fragment = document.createDocumentFragment();

    cart.forEach(item => {
        total += item.price * item.qty;
        count += item.qty;

        const itemEl = document.createElement('div');
        itemEl.classList.add('cart-item');
        itemEl.innerHTML = `
            <img src="${item.image}" alt="${item.name}" width="60" height="60" loading="lazy" decoding="async">
            <div style="flex:1;">
                <h4>${item.name}</h4>
                <div class="qty-controls">
                    <button type="button" class="qty-btn" onclick="decreaseQty(${item.id})" aria-label="Scade cantitatea">-</button>
                    <span>${item.qty} buc</span>
                    <button type="button" class="qty-btn" onclick="addToCart(${item.id})" aria-label="Creste cantitatea">+</button>
                </div>
                <p style="font-size:0.9rem; margin-top:5px; color:var(--text-muted);">${item.price * item.qty} MDL</p>
            </div>
            <button type="button" onclick="removeFromCart(${item.id})" class="remove-btn" aria-label="Elimina din cos">&times;</button>
        `;
        fragment.appendChild(itemEl);
    });

    cartItemsContainer.innerHTML = '';
    cartItemsContainer.appendChild(fragment);

    if(cartTotalEl) cartTotalEl.innerText = total + " MDL";
    if(cartCountEl) { cartCountEl.innerText = count; cartCountEl.dataset.count = count; }
}

if(cartBtn) cartBtn.addEventListener('click', () => {
    cartDrawer?.classList.add('active');
    cartOverlay?.classList.add('active');
    document.body.classList.add('cart-open');
    document.body.style.overflow = 'hidden';
});

function closeCartDrawer() {
    cartDrawer?.classList.remove('active');
    cartOverlay?.classList.remove('active');
    document.body.classList.remove('cart-open');
    document.body.style.overflow = '';
}

if(closeCartBtn) closeCartBtn.addEventListener('click', closeCartDrawer);
if(cartOverlay) cartOverlay.addEventListener('click', closeCartDrawer);

if(checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
        if (cart.length === 0) {
            closeCartDrawer();
            document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth' });
        } else {
            trackTelemetry('checkout_attempt', {
                cartItems: cart.length,
                totalQty: cart.reduce((sum, item) => sum + Number(item.qty || 0), 0),
                totalValue: cart.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.qty) || 0)), 0)
            });
            window.location.href = '/checkout';
        }
    });
}

let toastQueue = [];
let isShowingToast = false;

function showNotification(message) {
    toastQueue.push(message);
    if(!isShowingToast) {
        displayNextToast();
    }
}

function displayNextToast() {
    if(toastQueue.length === 0) {
        isShowingToast = false;
        return;
    }

    isShowingToast = true;
    const message = toastQueue.shift();

    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.innerText = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        setTimeout(() => toast.classList.add('show'), 10);
    });

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
            displayNextToast();
        }, 300);
    }, 2500);
}

let scrollObserver = null;

function setupScrollAnimations() {
    if(scrollObserver) scrollObserver.disconnect();

    scrollObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                const delay = parseInt(entry.target.dataset.animDelay || 0, 10);
                setTimeout(() => {
                    entry.target.classList.add('is-visible');
                    // Remove will-change after animation to free GPU memory
                    setTimeout(() => {
                        entry.target.style.willChange = 'auto';
                    }, 600);
                }, delay);
                scrollObserver.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.05,
        rootMargin: '0px 0px -40px 0px'
    });

    document.querySelectorAll('.card, .reveal, .reveal-heading').forEach((el, i) => {
        el.dataset.animDelay = Math.min(i % 4, 3) * 80;
        scrollObserver.observe(el);
    });

    document.querySelectorAll('.info-card:not(.is-visible), .service-card:not(.is-visible)').forEach((el, i) => {
        if (!el.classList.contains('anim-ready')) {
            el.classList.add('anim-ready');
            el.dataset.animDelay = i * 100;
            scrollObserver.observe(el);
        }
    });
}

window.onLangChange = function() {
    const cat = currentCategory;
    currentCategory = null;
    renderProducts(cat);
    updateCartUI();
};

// Hero CTA button
const heroCta = document.getElementById('hero-cta-btn');
if(heroCta) {
    heroCta.addEventListener('click', () => {
        document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth' });
    });
}

// Initialize cart count badge visibility on page load
if(cartCountEl) {
    cartCountEl.dataset.count = cart.length === 0 ? '0' : cartCountEl.innerText || '0';
}