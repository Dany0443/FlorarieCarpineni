let preloadedModels = new Set();
let isModalTransitioning = false;
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

let cart = JSON.parse(localStorage.getItem('flowerCart')) || [];
let currentCategory = 'all';

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
        if (data.success && Array.isArray(data.products) && data.products.length > 0) {
            allProducts = data.products;
        } else {
            allProducts = [...productsData];
        }
    } catch {
        allProducts = [...productsData];
    }

    if(productContainer) {
        renderProducts('all');
    }

    updateCartUI();
    setupScrollAnimations();

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

if(menuBtn && closeMenuBtn) {
    menuBtn.addEventListener('click', () => mobileMenu.classList.add('active'));
    closeMenuBtn.addEventListener('click', () => mobileMenu.classList.remove('active'));

    document.querySelectorAll('.mobile-menu a').forEach(link => {
        link.addEventListener('click', () => mobileMenu.classList.remove('active'));
    });
}

function renderProducts(category) {
    if(!productContainer) return;

    if(currentCategory === category && productContainer.children.length > 0) {
        return;
    }
    currentCategory = category;

    const fragment = document.createDocumentFragment();

    const filtered = category === 'all'
        ? allProducts
        : allProducts.filter(p => p.category === category);

    filtered.forEach(product => {
        const inCartItem = cart.find(item => item.id === product.id);
        const btnText = inCartItem ? `${t('in_cart')} (${inCartItem.qty}) +` : t('add_to_cart');
        const btnClass = inCartItem ? "add-btn in-cart" : "add-btn";

        const card = document.createElement('div');
        card.classList.add('card');

        card.innerHTML = `
            <div class="card-img-wrapper" onclick="openModal(${product.id})">
                <img src="${product.image}" alt="${product.name}" loading="lazy" decoding="async">
            </div>
            <div class="card-info">
                <h3 class="card-title" onclick="openModal(${product.id})">${product.name}</h3>
                <div class="card-price">${product.price} MDL</div>
                <div class="btn-group">
                     <button class="${btnClass}" id="btn-${product.id}" onclick="addToCart(${product.id})">
                        ${btnText}
                     </button>
                </div>
            </div>
        `;

        fragment.appendChild(card);
    });

    productContainer.innerHTML = '';
    productContainer.appendChild(fragment);

    setupScrollAnimations();
}

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        renderProducts(e.target.dataset.filter);
    });
});

function openModal(id) {
    const product = allProducts.find(p => p.id === id);
    if(!product || !modal) return;

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

    if (product.model3d) {
        const btn3d = document.createElement('button');
        btn3d.className = 'btn-3d';
        btn3d.innerHTML = t('modal_3d');
        btn3d.onclick = () => open3DModal(product.model3d);
        document.querySelector('.modal-text-block')?.appendChild(btn3d);
    }

    const inCartItem = cart.find(item => item.id === product.id);
    modalAddBtn.innerText = inCartItem ? `${t('modal_add_more')} (${inCartItem.qty})` : t('modal_add');

    modalAddBtn.onclick = () => {
        addToCart(id);
        closeModal();
    };

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    if(!modal) return;
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

function resetViewer() {
    modelViewer.classList.remove('loaded');
    modelViewer.removeAttribute('src');
    modelViewer.removeAttribute('alt');
    modelViewer.removeAttribute('ios-src');
    try { modelViewer.src = ''; } catch (_) {}
}

function aplicaCalitate() {
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
    if (!modal3D || !modelViewer || isModalTransitioning) return;

    isModalTransitioning = true;
    const modelWrapper = document.querySelector('.model-wrapper');

    resetViewer();
    aplicaCalitate();

    modal3D.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    requestAnimationFrame(() => {
        modal3D.classList.add('active');

        let incarcatTimeout;
        let incercari = 0;

        function incarcaModel() {
            modelViewer.setAttribute('src', modelPath);
            modelViewer.setAttribute('alt', '3D Flower');

            const limitaMs = DISPOZITIV_SLAB ? 12000 : PE_MOBIL ? 8000 : 5000;

            incarcatTimeout = setTimeout(() => {
                incercari++;
                if (incercari <= 2) {
                    modelViewer.removeAttribute('src');
                    setTimeout(incarcaModel, 300);
                } else {
                    modelWrapper?.classList.remove('loading');
                    modelViewer.classList.add('loaded');
                    isModalTransitioning = false;
                }
            }, limitaMs);
        }

        esteInCache(modelPath).then(cached => {
            if (cached) {
                modelWrapper?.classList.remove('loading');
            } else {
                modelWrapper?.classList.add('loading');
            }
        });

        modelViewer.addEventListener('load', () => {
            clearTimeout(incarcatTimeout);
            modelWrapper?.classList.remove('loading');
            modelViewer.classList.add('loaded');
            isModalTransitioning = false;
            if (!PE_MOBIL) cacheazaModel(modelPath);
        }, { once: true });

        modelViewer.addEventListener('error', () => {
            clearTimeout(incarcatTimeout);
            incercari++;
            if (incercari <= 2) {
                modelViewer.removeAttribute('src');
                setTimeout(incarcaModel, 500);
            } else {
                modelWrapper?.classList.remove('loading');
                isModalTransitioning = false;
            }
        }, { once: true });

        incarcaModel();
    });
}

function close3DModal() {
    if (!modal3D || !modelViewer) return;

    const modelWrapper = document.querySelector('.model-wrapper');
    modal3D.classList.remove('active');

    setTimeout(() => {
        modal3D.style.display = 'none';
        document.body.style.overflow = '';
        modelWrapper?.classList.remove('loading');
        resetViewer();
        isModalTransitioning = false;
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
        showNotification(t('notif_more', { name: product.name, qty: existingItem.qty }));
    } else {
        cart.push({ ...product, qty: 1 });
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

    if(cart.length === 0) {
        cartItemsContainer.innerHTML = `<p style="text-align:center; padding:20px; color:var(--text-muted);">${t('cart_empty')}</p>`;
        if(cartTotalEl) cartTotalEl.innerText = "0 MDL";
        if(cartCountEl) cartCountEl.innerText = "0";
        return;
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
                <p style="font-size:0.9rem; margin-top:5px; color:#666;">${item.price * item.qty} MDL</p>
            </div>
            <button type="button" onclick="removeFromCart(${item.id})" class="remove-btn" aria-label="Elimina din cos">&times;</button>
        `;
        fragment.appendChild(itemEl);
    });

    cartItemsContainer.innerHTML = '';
    cartItemsContainer.appendChild(fragment);

    if(cartTotalEl) cartTotalEl.innerText = total + " MDL";
    if(cartCountEl) cartCountEl.innerText = count;
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
            showNotification(t('notif_empty'));
        } else {
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
    if(scrollObserver) {
        scrollObserver.disconnect();
    }

    scrollObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                scrollObserver.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '50px'
    });

    document.querySelectorAll('.card').forEach(card => {
        scrollObserver.observe(card);
    });
}

window.onLangChange = function() {
    const cat = currentCategory;
    currentCategory = null;
    renderProducts(cat);
    updateCartUI();
};