let preloadedModels = new Set();
let isModalTransitioning = false;

// SELECTORS
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

// MODAL SELECTORS 
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

// initss
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const loader = document.getElementById('loader');
        if(loader) {
            loader.classList.add('hidden');

            setTimeout(() => loader.remove(), 500);
        }
    }, 800); 

    // Render products
    if(productContainer) {
        renderProducts('all');
    }
    
    updateCartUI();
    setupScrollAnimations();
    
    // some preloading for performanta mai buna
    if (window.requestIdleCallback) {
        requestIdleCallback(() => preload3DModels(), { timeout: 3000 });
    } else {
        setTimeout(preload3DModels, 2000);
    }
});

// 3D Models function
function preload3DModels() {
    const modelsToPreload = productsData
        .filter(p => p.model3d)
        .map(p => p.model3d);
    
    modelsToPreload.forEach(modelPath => {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.as = 'fetch';
        link.href = modelPath;
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
        preloadedModels.add(modelPath);
    });
    
    console.log(`Preloaded ${modelsToPreload.length} 3D models for instant viewing`);
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
        ? productsData 
        : productsData.filter(p => p.category === category);

    filtered.forEach(product => {
        const inCartItem = cart.find(item => item.id === product.id);
        const btnText = inCartItem ? `În Coș (${inCartItem.qty}) +` : "Adaugă în coș";
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

// Modal logic
function openModal(id) {
    const product = productsData.find(p => p.id === id);
    if(!product || !modal) return;

    modalImg.src = product.image;
    modalImg.alt = product.name;
    modalTitle.innerText = product.name;
    modalPrice.innerText = product.price + " MDL";
    
    modalFamily.innerHTML = `<strong>Familie:</strong> ${product.family || 'Nespecificat'}`;
    modalDesc.innerHTML = `<strong>Descriere:</strong> ${product.desc}`;
    modalCare.innerHTML = `<strong>Îngrijire:</strong> ${product.care || 'Udare moderată.'}`;
    modalNote.innerHTML = `<em>Nota: ${product.note || '-'}</em>`;
    
    const existing3dBtn = document.querySelector('.btn-3d');
    if(existing3dBtn) existing3dBtn.remove();


    if (product.model3d) {
        const btn3d = document.createElement('button');
        btn3d.className = 'btn-3d';
        btn3d.innerHTML = `Vezi în 3D (360°)`;
        btn3d.onclick = () => open3DModal(product.model3d);
        document.querySelector('.modal-text-block')?.appendChild(btn3d);
    }

    // Update cart button text
    const inCartItem = cart.find(item => item.id === product.id);
    modalAddBtn.innerText = inCartItem ? `Mai adaugă unu (${inCartItem.qty})` : "Adaugă în coș";
    
    modalAddBtn.onclick = () => {
        addToCart(id);
        closeModal();
    };

    modal.classList.add('active');
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    if(!modal) return;
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

// 3d Logic
function open3DModal(modelPath) {
    if(!modal3D || !modelViewer || isModalTransitioning) return;
    
    isModalTransitioning = true;
    const modelWrapper = document.querySelector('.model-wrapper');
    
    // Cleanup complet
    modelViewer.classList.remove('loaded');
    modelViewer.removeAttribute('src');
    modelViewer.removeAttribute('alt');
    modelViewer.removeAttribute('ios-src');
    modelViewer.src = '';
    
    if(modelViewer.model) {
        modelViewer.model = null;
    }
    
    // Delay pentru cleanup WebGL
    setTimeout(() => {
        modelWrapper?.classList.add('loading');
        
        modal3D.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        requestAnimationFrame(() => {
            modal3D.classList.add('active');
            
            setTimeout(() => {
                modelViewer.setAttribute('src', modelPath);
                modelViewer.setAttribute('alt', '3D Flower Model');
                
                const onLoad = () => {
                    modelWrapper?.classList.remove('loading');
                    modelViewer.classList.add('loaded');
                    isModalTransitioning = false;
                };
                
                modelViewer.addEventListener('load', onLoad, { once: true });
                
                setTimeout(() => {
                    if(isModalTransitioning) {
                        modelWrapper?.classList.remove('loading');
                        modelViewer.classList.add('loaded');
                        isModalTransitioning = false;
                    }
                }, 3000);
            }, 200);
        });
    }, 100);
}

function close3DModal() {
    if(!modal3D || !modelViewer) return;
    
    const modelWrapper = document.querySelector('.model-wrapper');
    
    modal3D.classList.remove('active');
    
    setTimeout(() => {
        modal3D.style.display = 'none';
        document.body.style.overflow = '';
        
        modelWrapper?.classList.remove('loading');
        modelViewer.classList.remove('loaded');
        modelViewer.removeAttribute('src');
        modelViewer.removeAttribute('alt');
        modelViewer.removeAttribute('ios-src');
        modelViewer.src = '';
        
        if(modelViewer.model) {
            modelViewer.model = null;
        }
        
        isModalTransitioning = false;
    }, 300);
}

if(modalClose) modalClose.addEventListener('click', closeModal);
if(close3D) close3D.addEventListener('click', close3DModal);

// Click outside modal to close
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

// ESC key to close modals
document.addEventListener('keydown', (e) => {
    if(e.key === 'Escape') {
        if(modal?.classList.contains('active')) closeModal();
        if(modal3D?.classList.contains('active')) close3DModal();
    }
});

// CART LOGIC 
function addToCart(id) {
    const product = productsData.find(p => p.id === id);
    if(!product) return;
    
    const existingItem = cart.find(item => item.id === id);

    if (existingItem) {
        existingItem.qty++;
        showNotification(`Ai mai pus o ${product.name}! (${existingItem.qty})`);
    } else {
        cart.push({ ...product, qty: 1 });
        showNotification(`Am adăugat "${product.name}" în coș!`);
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
    showNotification("Produs eliminat din coș");
}

// Only update buttons that need updating
function refreshProductButtons() {
    if(!productContainer) return;
    
    productsData.forEach(product => {
        const btn = document.getElementById(`btn-${product.id}`);
        if(!btn) return;
        
        const inCartItem = cart.find(item => item.id === product.id);
        if(inCartItem) {
            btn.innerText = `În Coș (${inCartItem.qty}) +`;
            btn.classList.add('in-cart');
        } else {
            btn.innerText = "Adaugă în coș";
            btn.classList.remove('in-cart');
        }
    });
}

function saveCart() {
    try {
        localStorage.setItem('flowerCart', JSON.stringify(cart));
    } catch(e) {
        console.error('Failed to save cart:', e);
        showNotification("Eroare la salvarea coșului");
    }
}

function updateCartUI() {
    if(!cartItemsContainer) return;
    
    let total = 0;
    let count = 0;

    if(cart.length === 0) {
        cartItemsContainer.innerHTML = '<p style="text-align:center; padding:20px; color:#999;">Coșul este gol.</p>';
        if(cartTotalEl) cartTotalEl.innerText = "0 MDL";
        if(cartCountEl) cartCountEl.innerText = "0";
        return;
    }

    // Use DocumentFragment for better performance
    const fragment = document.createDocumentFragment();

    cart.forEach(item => {
        total += item.price * item.qty;
        count += item.qty;

        const itemEl = document.createElement('div');
        itemEl.classList.add('cart-item');
        itemEl.innerHTML = `
            <img src="${item.image}" alt="${item.name}" loading="lazy">
            <div style="flex:1;">
                <h4>${item.name}</h4>
                <div class="qty-controls">
                    <button class="qty-btn" onclick="decreaseQty(${item.id})" aria-label="Scade cantitatea">-</button>
                    <span>${item.qty} buc</span>
                    <button class="qty-btn" onclick="addToCart(${item.id})" aria-label="Crește cantitatea">+</button>
                </div>
                <p style="font-size:0.9rem; margin-top:5px; color:#666;">${item.price * item.qty} MDL</p>
            </div>
            <button onclick="removeFromCart(${item.id})" class="remove-btn" aria-label="Elimină din coș">&times;</button>
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
    document.body.style.overflow = 'hidden';
});

function closeCartDrawer() {
    cartDrawer?.classList.remove('active');
    cartOverlay?.classList.remove('active');
    document.body.style.overflow = '';
}

if(closeCartBtn) closeCartBtn.addEventListener('click', closeCartDrawer);
if(cartOverlay) cartOverlay.addEventListener('click', closeCartDrawer);

// Checkout Redirect
if(checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
        if (cart.length === 0) {
            showNotification("Coșul este gol! Adaugă ceva frumos.");
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
    // Disconnect old observer to prevent memory leaks
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
