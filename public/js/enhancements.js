;
(function(window, document) {
    'use strict';

    function initTrueLoader() {
        const loader = document.getElementById('loader');
        if (!loader) return;

        const barFill = loader.querySelector('.loader-bar-fill');
        if (barFill) {

            barFill.style.animation = 'none';
            barFill.style.transition = 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
            barFill.style.width = '10%';
        }

        function setProgress(pct) {
            if (barFill) barFill.style.width = Math.min(100, pct) + '%';
        }

        function dismissLoader() {
            setProgress(100);

            setTimeout(() => {
                loader.classList.add('hidden');

                setTimeout(() => loader.remove(), 520);
            }, 160);
        }

        function waitForImages() {
            const imgs = Array.from(document.querySelectorAll('img'));
            if (imgs.length === 0) return Promise.resolve();

            const decodePromises = imgs.map(img => {
                if (img.complete && img.naturalWidth > 0) return Promise.resolve();

                if (typeof img.decode === 'function') {
                    return img.decode().catch(() => Promise.resolve()); 

                }
                return new Promise(resolve => {
                    img.addEventListener('load', resolve, {
                        once: true
                    });
                    img.addEventListener('error', resolve, {
                        once: true
                    });
                });
            });

            return Promise.all(decodePromises);
        }

        function waitForModels() {
            const viewers = Array.from(document.querySelectorAll('model-viewer'));
            if (viewers.length === 0) return Promise.resolve();

            const modelPromises = viewers.map(v =>
                new Promise(resolve => {

                    v.addEventListener('load', resolve, {
                        once: true
                    });
                    v.addEventListener('error', resolve, {
                        once: true
                    });

                    setTimeout(resolve, 4000);
                })
            );

            return Promise.all(modelPromises);
        }

        const domReady = new Promise(resolve => {
            if (document.readyState !== 'loading') resolve();
            else document.addEventListener('DOMContentLoaded', resolve, {
                once: true
            });
        });

        const windowLoad = new Promise(resolve => {
            if (document.readyState === 'complete') resolve();
            else window.addEventListener('load', resolve, {
                once: true
            });
        });

        let progressTimer = null;
        let fakeProgress = 10;
        progressTimer = setInterval(() => {
            fakeProgress = Math.min(fakeProgress + (90 - fakeProgress) * 0.08, 88);
            setProgress(fakeProgress);
        }, 80);

        domReady.then(() => setProgress(30));

        Promise.all([domReady, windowLoad, waitForImages(), waitForModels()])
            .finally(() => {
                clearInterval(progressTimer);
                dismissLoader();
            });
    }

    function buildCardElement(product, cart) {
        const inCartItem = cart ? cart.find(i => i.id === product.id) : null;
        const btnText = inCartItem ? `${window.t?.('in_cart') ?? 'În Coș'} (${inCartItem.qty}) +` : (window.t?.('add_to_cart') ?? 'Adaugă în coș');
        const btnClass = inCartItem ? 'add-btn in-cart' : 'add-btn';

        const card = document.createElement('div');
        card.className = 'card'; 

        card.innerHTML = `
      <div class="card-img-wrapper" onclick="openModal(${product.id})">
        <img alt="${product.name}" loading="lazy" decoding="async">
      </div>
      <div class="card-info">
        <h3 class="card-title" onclick="openModal(${product.id})">${product.name}</h3>
        <div class="card-price">${product.price} MDL</div>
        <div class="btn-group">
          <button class="${btnClass}" id="btn-${product.id}" onclick="addToCart(${product.id})">
            ${btnText}
          </button>
        </div>
      </div>`;

        const img = card.querySelector('img');

        const imgPromise = typeof img.decode === 'function' ?
            new Promise(resolve => {
                img.src = product.image;
                img.decode()
                    .then(resolve)
                    .catch(resolve); 

            }) :
            new Promise(resolve => {
                img.src = product.image;
                img.addEventListener('load', resolve, {
                    once: true
                });
                img.addEventListener('error', resolve, {
                    once: true
                });
            });

        return {
            card,
            imgPromise
        };
    }

    function renderCardsWithDecode(products, container, cart) {
        if (!container || !products.length) return;

        const fragment = document.createDocumentFragment();
        const cards = [];

        products.forEach(product => {
            const {
                card,
                imgPromise
            } = buildCardElement(product, cart);
            fragment.appendChild(card);
            cards.push({
                card,
                imgPromise
            });
        });

        container.innerHTML = '';
        container.appendChild(fragment);

        cards.forEach(({
            card,
            imgPromise
        }) => {
            imgPromise.then(() => {

                if (window.LuciUI && window.LuciUI._scrollObserver) {
                    window.LuciUI._scrollObserver.observe(card);
                }
            });
        });
    }

    let _scrollObserver = null;

    function initScrollReveal() {
        if (_scrollObserver) {
            _scrollObserver.disconnect();
        }

        _scrollObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;

                const el = entry.target;
                const delay = parseFloat(el.style.getPropertyValue('--stagger-i') || el.dataset.animDelay || 0);
                const msDelay = el.style.getPropertyValue('--stagger-i') ?
                    0 

                    :
                    delay;

                setTimeout(() => {
                    el.classList.add('is-visible', 'visible'); 

                    const dur = 650 + msDelay;
                    setTimeout(() => {
                        el.style.willChange = 'auto';
                    }, dur);
                }, msDelay);

                _scrollObserver.unobserve(el);
            });
        }, {
            threshold: 0.06,
            rootMargin: '0px 0px -48px 0px'
        });

        document.querySelectorAll(
            '.info-section h2, .section-header h2, .services-header h2, ' +
            '.page-title:not(.page-title--no-reveal)'
        ).forEach(el => {
            el.classList.add('reveal-heading');
            _scrollObserver.observe(el);
        });

        document.querySelectorAll('.reveal:not(.is-visible)').forEach(el => {
            _scrollObserver.observe(el);
        });

        document.querySelectorAll('.card:not(.is-visible)').forEach((card, i) => {
            const staggerIndex = i % 4; 

            card.style.setProperty('--stagger-i', staggerIndex);
            card.dataset.animDelay = staggerIndex * 80;
            _scrollObserver.observe(card);
        });

        document.querySelectorAll(
            '.info-card:not(.is-visible), .service-card:not(.is-visible)'
        ).forEach((el, i) => {
            el.classList.add('reveal');
            el.style.setProperty('--stagger-i', i % 3);
            _scrollObserver.observe(el);
        });

        return _scrollObserver;
    }

    function initSmartHeader() {
        const navbar = document.querySelector('.navbar');
        if (!navbar) return;

        let lastScrollY = window.scrollY;
        let ticking = false;
        let headerHidden = false;

        const HIDE_THRESHOLD = navbar.offsetHeight + 20;
        const REVEAL_DELTA = 8; 

        function onScroll() {
            if (!ticking) {
                window.requestAnimationFrame(updateHeader);
                ticking = true;
            }
        }

        function updateHeader() {
            const scrollY = window.scrollY;
            const delta = scrollY - lastScrollY;

            if (scrollY < HIDE_THRESHOLD) {

                navbar.classList.remove('nav-hidden');
                navbar.classList.add('nav-visible');
                headerHidden = false;
            } else if (delta > 6 && !headerHidden) {

                navbar.classList.add('nav-hidden');
                navbar.classList.remove('nav-visible');
                headerHidden = true;
            } else if (delta < -REVEAL_DELTA && headerHidden) {

                navbar.classList.remove('nav-hidden');
                navbar.classList.add('nav-visible');
                headerHidden = false;
            }

            lastScrollY = scrollY;
            ticking = false;
        }

        window.addEventListener('scroll', onScroll, {
            passive: true
        });

        const hero = document.querySelector('.hero');
        if (hero && !hero.querySelector('.hero-gradient-overlay')) {
            const overlay = document.createElement('div');
            overlay.className = 'hero-gradient-overlay';

            hero.insertBefore(overlay, hero.firstChild);
        }
    }

    function initBottomSheet() {

        if (window.innerWidth > 768) return;

        if (document.querySelector('.lb-bottom-sheet')) return;

        const backdrop = document.createElement('div');
        backdrop.className = 'lb-sheet-backdrop';
        document.body.appendChild(backdrop);

        const sheet = document.createElement('div');
        sheet.className = 'lb-bottom-sheet lb-sheet';
        sheet.setAttribute('role', 'dialog');
        sheet.setAttribute('aria-modal', 'true');
        sheet.setAttribute('aria-label', 'Setări limbă și temă');
        sheet.innerHTML = `
      <div class="lb-sheet-handle"></div>
      <div class="lb-sheet-title">Limbă & Temă</div>
      <div class="lang-group">
        <button class="lang-btn" data-lang="ro">RO</button>
        <button class="lang-btn" data-lang="en">EN</button>
        <button class="lang-btn" data-lang="ru">RU</button>
      </div>
      <div class="lb-sheet-theme-row">
        <span class="lb-sheet-theme-label">
          <span class="theme-icon-light">☀️</span>
          <span class="theme-icon-dark">🌙</span>
          Temă întunecată
        </span>
        <button class="theme-pill" id="sheet-theme-pill" aria-label="Comută tema"></button>
      </div>`;
        document.body.appendChild(sheet);

        const trigger = document.createElement('button');
        trigger.className = 'lb-sheet-trigger';
        trigger.setAttribute('aria-label', 'Deschide setările');
        trigger.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a
               1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A
               1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83
               l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09
               A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83
               l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09
               a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83
               l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09
               a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>`;
        document.body.appendChild(trigger);

        let isOpen = false;

        function openSheet() {
            isOpen = true;
            sheet.classList.add('open');
            backdrop.style.display = 'block';
            requestAnimationFrame(() => backdrop.classList.add('open'));
            document.body.style.overflow = 'hidden';
            syncSheetLang();
        }

        function closeSheet() {
            isOpen = false;
            sheet.classList.remove('open');
            backdrop.classList.remove('open');
            setTimeout(() => {
                backdrop.style.display = 'none';
                document.body.style.overflow = '';
            }, 320);
        }

        trigger.addEventListener('click', () => isOpen ? closeSheet() : openSheet());
        backdrop.addEventListener('click', closeSheet);

        let touchStartY = 0;
        sheet.addEventListener('touchstart', e => {
            touchStartY = e.touches[0].clientY;
        }, {
            passive: true
        });
        sheet.addEventListener('touchend', e => {
            const dy = e.changedTouches[0].clientY - touchStartY;
            if (dy > 60) closeSheet();
        }, {
            passive: true
        });

        sheet.querySelectorAll('.lang-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (typeof window.setLang === 'function') {
                    wrapWithViewTransition(() => window.setLang(btn.dataset.lang));
                }
                syncSheetLang();
                setTimeout(closeSheet, 180);
            });
        });

        function syncSheetLang() {
            const current = window.__lang || 'ro';
            sheet.querySelectorAll('.lang-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.lang === current);
            });
        }

        const themePill = document.getElementById('sheet-theme-pill');
        if (themePill) {
            themePill.addEventListener('click', () => {
                const current = document.documentElement.getAttribute('data-theme') || 'light';
                wrapWithViewTransition(() => {
                    if (typeof window.toggleTheme === 'function') {
                        window.toggleTheme();
                    } else {

                        const next = current === 'dark' ? 'light' : 'dark';
                        document.documentElement.setAttribute('data-theme', next);
                        localStorage.setItem('lb_theme', next);
                    }
                });
            });
        }

        syncSheetLang();

        window.LuciUI = window.LuciUI || {};
        window.LuciUI.closeSheet = closeSheet;
    }

    function wrapWithViewTransition(callback) {
        if (typeof document.startViewTransition === 'function') {
            document.startViewTransition(() => {
                callback();

                return new Promise(resolve => requestAnimationFrame(resolve));
            });
        } else {
            callback();
        }
    }

    function patchI18nWithTransitions() {
        const originalSetLang = window.setLang;
        if (typeof originalSetLang !== 'function') return;

        window.setLang = function patchedSetLang(lang) {
            if (lang === window.__lang) return; 

            wrapWithViewTransition(() => originalSetLang(lang));
        };
    }

    function patchThemeWithTransitions() {
        const originalApplyTheme = window.applyTheme;
        if (typeof originalApplyTheme !== 'function') return;

        window.applyTheme = function patchedApplyTheme(theme) {
            const current = document.documentElement.getAttribute('data-theme');
            if (theme === current) return; 

            wrapWithViewTransition(() => originalApplyTheme(theme));
        };

        const originalToggleTheme = window.toggleTheme;
        if (typeof originalToggleTheme === 'function') {
            window.toggleTheme = function patchedToggleTheme() {
                const current = document.documentElement.getAttribute('data-theme') || 'light';
                wrapWithViewTransition(() => originalApplyTheme(current === 'dark' ? 'light' : 'dark'));
            };
        }
    }

    function init() {
        initTrueLoader();
        initSmartHeader();

        initScrollReveal();

        initBottomSheet();

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                patchI18nWithTransitions();
                patchThemeWithTransitions();
            });
        } else {

            requestAnimationFrame(() => {
                patchI18nWithTransitions();
                patchThemeWithTransitions();
            });
        }
    }

    window.LuciUI = window.LuciUI || {};
    Object.assign(window.LuciUI, {

        renderCardsWithDecode,

        refreshScrollReveal: initScrollReveal,

        withViewTransition: wrapWithViewTransition,

        get _scrollObserver() {
            return _scrollObserver;
        }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

}(window, document));
