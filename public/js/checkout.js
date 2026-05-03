document.addEventListener('DOMContentLoaded', () => {
    function trackTelemetry(event, data) {
        try {
            if (window.Telemetry && typeof window.Telemetry.track === 'function') {
                window.Telemetry.track(event, data || {});
            }
        } catch (_) {}
    }

    const cart = JSON.parse(localStorage.getItem('flowerCart')) || [];
    if (cart.length === 0) {
        window.location.replace('/');
        return;
    }

<<<<<<< HEAD
=======
<<<<<<< Updated upstream
        function sanitizeText(str, maxLen) {
            return String(str).trim().replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').slice(0, maxLen);
=======
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
    const total = parseFloat(cart.reduce((acc, item) => acc + (item.price * item.qty), 0).toFixed(2));
    document.getElementById('checkout-total').innerText = total + ' MDL';

    const loader = document.getElementById('loader');
    if (loader) loader.classList.add('hidden');

    // ── i18n helper that never throws ────────────────────────────────────────
    // Wraps window.t() so a missing key never crashes the catch block and
    // leaves the button permanently stuck in "Se trimite..." state.
    function safeT(key, fallback) {
        try { return (window.t && window.t(key)) || fallback; }
        catch { return fallback; }
    }

<<<<<<< HEAD
=======
    let nativePayLabel = safeT('btn_native_pay', 'Plateste rapid');

    function getNativePayProfile() {
        const ua = navigator.userAgent || '';
        const platform = navigator.platform || '';
        const isAndroid = /Android/i.test(ua);
        const isIOS = /iPhone|iPad|iPod/i.test(ua) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const isMac = /Mac/i.test(platform) && !isIOS;
        const hasApplePay = typeof window.ApplePaySession !== 'undefined';

        if ((isIOS || isMac) && hasApplePay) {
            return { method: 'apple_pay', label: 'Apple Pay' };
        }
        if (isAndroid) {
            return { method: 'gpay', label: 'GPay' };
        }
        return { method: 'native_pay', label: safeT('btn_native_pay', 'Plateste rapid') };
    }

    function setNativePayLabel(button, profile) {
        nativePayLabel = profile.label;
        button.textContent = profile.label;
        button.setAttribute('aria-label', profile.label);
        button.dataset.payMethod = profile.method;
    }

    function getPaymentInstruments(profile) {
        const googlePay = {
            supportedMethods: 'https://google.com/pay',
            data: {
                environment: 'TEST',
                apiVersion: 2,
                apiVersionMinor: 0,
                merchantInfo: { merchantName: 'Luci Boutique' },
                allowedPaymentMethods: [{
                    type: 'CARD',
                    parameters: {
                        allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
                        allowedCardNetworks: ['MASTERCARD', 'VISA', 'AMEX']
                    },
                    tokenizationSpecification: {
                        type: 'PAYMENT_GATEWAY',
                        parameters: { gateway: 'example', gatewayMerchantId: 'demoGatewayId' }
                    }
                }]
            }
        };

        const applePay = {
            supportedMethods: 'https://apple.com/apple-pay',
            data: {
                version: 3,
                merchantIdentifier: 'merchant.com.florariecarpineni.com',
                merchantCapabilities: ['supports3DS'],
                supportedNetworks: ['masterCard', 'visa', 'amex'],
                countryCode: 'MD'
            }
        };

        return profile.method === 'apple_pay'
            ? [applePay, googlePay]
            : [googlePay, applePay];
    }

>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
    window.onLangChange = function () {
        const submitBtn    = document.getElementById('submitBtn');
        const nativePayBtn = document.getElementById('native-pay-btn');
        if (submitBtn)    submitBtn.textContent    = safeT('btn_submit',     'Trimite comanda');
<<<<<<< HEAD
        if (nativePayBtn) nativePayBtn.textContent = safeT('btn_native_pay', 'Plătește rapid');
=======
        if (nativePayBtn) nativePayBtn.textContent = nativePayLabel || safeT('btn_native_pay', 'Plateste rapid');
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
    };

    // ── helpers ───────────────────────────────────────────────────────────────
    function sanitizeText(str, maxLen) {
        return String(str || '').trim()
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
            .slice(0, maxLen);
    }

    function isValidEmail(email) {
        return /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(email);
    }

    function showFeedback(type, html) {
        const el = document.getElementById('formFeedback');
        if (!el) return;
        el.innerHTML     = html;
        el.className     = `form-feedback ${type}`;
        el.style.display = 'block';
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Fetch with a hard timeout so a hanging server never freezes the UI.
    // 40 s is generous enough to cover even slow SMTP on the old server build.
    async function fetchWithTimeout(url, opts, ms = 40000) {
        const ctrl  = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), ms);
        try {
            return await fetch(url, { ...opts, signal: ctrl.signal });
        } finally {
            clearTimeout(timer);
<<<<<<< HEAD
=======
>>>>>>> Stashed changes
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
        }
    }

    // Safe JSON parse — returns null instead of throwing on bad/empty responses.
    async function safeJson(response) {
        try { return await response.json(); }
        catch { return null; }
    }

    // ── standard form submit ──────────────────────────────────────────────────
    const checkoutForm = document.getElementById('checkout-form');
    if (checkoutForm) {
        checkoutForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name    = sanitizeText(document.getElementById('name').value, 80);
            const phone   = sanitizeText(document.getElementById('phone').value, 20).replace(/[^0-9+\s\-]/g, '');
            const email   = sanitizeText(document.getElementById('email').value, 120);
            const address = sanitizeText(document.getElementById('address').value, 300);

            if (name.length < 2) {
                return showFeedback('error', 'Introduceți un nume valid (minim 2 caractere).');
            }
            if (phone.replace(/\D/g, '').length < 8) {
                return showFeedback('error', 'Introduceți un număr de telefon valid.');
            }
            if (address.length < 5) {
                return showFeedback('error', 'Introduceți o adresă de livrare validă.');
            }
            if (email && !isValidEmail(email)) {
                return showFeedback('error', 'Adresa de email nu este validă.');
            }

            const safeCart = cart.map(i => ({
                name:  sanitizeText(i.name, 120),
                qty:   Math.max(1, Math.min(99, Number(i.qty))),
                price: Math.max(0, Number(Number(i.price).toFixed(2)))
            }));

            const submitBtn = document.getElementById('submitBtn');
            submitBtn.textContent = safeT('btn_sending', 'Se trimite...');
            submitBtn.disabled    = true;

            const orderData = {
                customer: { name, phone, email, address },
                cart: safeCart,
                total
            };
            trackTelemetry('checkout_attempt', {
                source: 'form',
                cartItems: safeCart.length,
                total
            });

            // Use `succeeded` flag so the finally block knows whether to re-enable.
            let succeeded = false;
            try {
                const response = await fetchWithTimeout('/api/order', {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify(orderData)
                });

                const result = await safeJson(response);

                if (result && result.success) {
                    succeeded = true;
                    trackTelemetry('checkout_success', { source: 'form', orderId: result.orderId, total });
                    localStorage.removeItem('flowerCart');
                    showFeedback('success',
                        `${safeT('cart_checkout', 'Comandă plasată')}!<br>` +
                        `Nr. comenzii: <span class="order-id">${result.orderId}</span><br>` +
                        `<small>Redirecționare...</small>`
                    );
                    setTimeout(() => { window.location.href = '/'; }, 4000);
                } else {
                    // Surface the actual server validation message (e.g. "Telefon invalid.")
                    const errMsg = (result && result.error) || 'Eroare la procesarea comenzii.';
                    trackTelemetry('checkout_fail', { source: 'form', reason: errMsg });
                    showFeedback('error', errMsg);
                }
            } catch (err) {
                const msg = err.name === 'AbortError'
                    ? 'Serverul nu a răspuns în timp util. Verificați conexiunea și încercați din nou.'
                    : 'Eroare la procesarea comenzii. Încercați din nou.';
                trackTelemetry('checkout_fail', { source: 'form', reason: err.name || 'network_error' });
                showFeedback('error', msg);
            } finally {
                // Always re-enable the button unless the order was placed successfully.
                if (!succeeded) {
                    submitBtn.textContent = safeT('btn_retry', 'Încearcă din nou');
                    submitBtn.disabled    = false;
                }
            }
        });
    }

<<<<<<< HEAD
    initPaymentButton(cart, total);

    // ── native payment (Google Pay / Apple Pay) ───────────────────────────────
=======
<<<<<<< Updated upstream
        window.addEventListener('load', () => {
            document.getElementById('loader').classList.add('hidden');
=======
    initPaymentButton(cart, total);

    // native pay button flow using Payment Request API
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
    function initPaymentButton(cart, total) {
        const nativePayBtn = document.getElementById('native-pay-btn');
        if (!nativePayBtn) return;

        if (!window.PaymentRequest) {
            console.warn('PaymentRequest API indisponibil (lipsă HTTPS sau browser nesuportat).');
            return;
        }
<<<<<<< HEAD
        nativePayBtn.style.display = 'block';
        trackTelemetry('payment_method_shown', { method: 'native_pay' });

        const supportedInstruments = [
            {
                supportedMethods: 'https://google.com/pay',
                data: {
                    environment: 'TEST',
                    apiVersion: 2,
                    apiVersionMinor: 0,
                    merchantInfo: { merchantName: 'Luci Boutique' },
                    allowedPaymentMethods: [{
                        type: 'CARD',
                        parameters: {
                            allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
                            allowedCardNetworks: ['MASTERCARD', 'VISA', 'AMEX']
                        },
                        tokenizationSpecification: {
                            type: 'PAYMENT_GATEWAY',
                            parameters: { gateway: 'example', gatewayMerchantId: 'demoGatewayId' }
                        }
                    }]
                }
            },
            {
                supportedMethods: 'https://apple.com/apple-pay',
                data: {
                    version: 3,
                    merchantIdentifier: 'merchant.com.florariecarpineni.com',
                    merchantCapabilities: ['supports3DS'],
                    supportedNetworks: ['masterCard', 'visa', 'amex'],
                    countryCode: 'MD'
                }
            }
        ];
=======
        const payProfile = getNativePayProfile();
        setNativePayLabel(nativePayBtn, payProfile);
        nativePayBtn.style.display = 'block';
        trackTelemetry('payment_method_shown', { method: payProfile.method });

        const supportedInstruments = getPaymentInstruments(payProfile);
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)

        nativePayBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            nativePayBtn.disabled = true;
<<<<<<< HEAD
            trackTelemetry('native_pay_attempt', { cartItems: cart.length, total });
=======
            trackTelemetry('native_pay_attempt', { method: payProfile.method, cartItems: cart.length, total });
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)

            const displayItems = cart.map(item => ({
                label:  item.name,
                amount: { currency: 'MDL', value: (item.price * item.qty).toFixed(2) }
            }));

            const paymentDetails = {
                total:        { label: 'Total Luci Boutique', amount: { currency: 'MDL', value: total.toFixed(2) } },
                displayItems
            };

            const options = {
                requestPayerName:  true,
                requestPayerEmail: true,
                requestPayerPhone: true,
                requestShipping:   true,
                shippingType:      'delivery'
            };

            let paymentResponse = null;
            try {
                const request = new PaymentRequest(supportedInstruments, paymentDetails, options);
                paymentResponse = await request.show();

                await new Promise(resolve => setTimeout(resolve, 600));

                // ── normalise wallet fields to pass server-side validators ──────
                const rawName  = sanitizeText(paymentResponse.payerName  || '', 80);
                const rawPhone = sanitizeText(paymentResponse.payerPhone || '', 20).replace(/[^0-9+\s\-]/g, '');
                const rawEmail = sanitizeText(paymentResponse.payerEmail || '', 120);

                // Fallbacks that always satisfy validateName / validatePhone
                const safeName  = rawName.length  >= 2 ? rawName  : 'Client';
                const safePhone = rawPhone.replace(/\D/g, '').length >= 8 ? rawPhone : '000000000';
                const safeEmail = (rawEmail && isValidEmail(rawEmail)) ? rawEmail : '';

                let safeAddress = 'Adresa Wallet';
                if (paymentResponse.shippingAddress) {
                    const lines = (paymentResponse.shippingAddress.addressLine || []).join(' ').trim();
                    const city  = (paymentResponse.shippingAddress.city || '').trim();
                    const built = [lines, city].filter(Boolean).join(', ');
                    if (built.length >= 5) safeAddress = sanitizeText(built, 300);
                }

                const orderData = {
                    customer: { name: safeName, phone: safePhone, email: safeEmail, address: safeAddress },
                    cart: cart.map(i => ({
                        name:  sanitizeText(i.name, 120),
                        qty:   Math.max(1, Math.min(99, Number(i.qty))),
                        price: Math.max(0, Number(Number(i.price).toFixed(2)))
                    })),
                    total
                };

                const serverRes = await fetchWithTimeout('/api/order', {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify(orderData)
                });

                const result = await safeJson(serverRes);

                if (result && result.success) {
                    trackTelemetry('checkout_success', { source: 'native_pay', orderId: result.orderId, total });
                    await paymentResponse.complete('success');
                    paymentResponse = null; // prevent double-complete in finally
                    localStorage.removeItem('flowerCart');
                    showFeedback('success',
                        `Plată procesată cu succes!<br>` +
                        `Nr. comenzii: <span class="order-id">${result.orderId}</span><br>` +
                        `<small>Redirecționare...</small>`
                    );
                    setTimeout(() => { window.location.href = '/'; }, 4000);
                    return; // navigating away — don't re-enable button
                } else {
                    await paymentResponse.complete('fail');
                    paymentResponse = null;
                    const errMsg = (result && result.error) || 'Eroare la procesarea comenzii pe server.';
                    trackTelemetry('checkout_fail', { source: 'native_pay', reason: errMsg });
                    showFeedback('error', errMsg);
                }

            } catch (err) {
                console.error('Wallet error:', err);
                if (paymentResponse) {
                    try { await paymentResponse.complete('fail'); } catch {}
                }
                if (err.name === 'AbortError' && !paymentResponse) {
                    // User dismissed the sheet — silent
                } else if (err.name === 'NotSupportedError') {
                    showFeedback('error',
<<<<<<< HEAD
                        'Apple Pay / Google Pay nu sunt disponibile în modul demo.<br>' +
=======
                        `${payProfile.label} nu este disponibil în modul demo pe acest device.<br>` +
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
                        'Completați formularul standard de mai jos.'
                    );
                } else if (err.name !== 'AbortError') {
                    trackTelemetry('checkout_fail', { source: 'native_pay', reason: err.name || 'native_pay_error' });
                    showFeedback('error', `Eroare plată: ${err.message}`);
                }
            } finally {
                nativePayBtn.disabled = false;
            }
<<<<<<< HEAD
=======
>>>>>>> Stashed changes
>>>>>>> 2e64749 (Update storefront, admin security, sharing, and caching)
        });
    }
});
