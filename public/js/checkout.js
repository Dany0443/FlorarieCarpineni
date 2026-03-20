        const cart = JSON.parse(localStorage.getItem('flowerCart')) || [];
        if (cart.length === 0) { window.location.replace('/'); throw new Error('empty cart'); }

        const total = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
        document.getElementById('checkout-total').innerText = total + ' MDL';

        function sanitizeText(str, maxLen) {
            return String(str).trim().replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').slice(0, maxLen);
        }

        function isValidEmail(email) {
            return /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(email);
        }

        function showFeedback(type, html) {
            const el = document.getElementById('formFeedback');
            el.innerHTML     = html;
            el.className     = `form-feedback ${type}`;
            el.style.display = 'block';
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        document.getElementById('checkout-form').addEventListener('submit', async (e) => {
            e.preventDefault();

            const name    = sanitizeText(document.getElementById('name').value, 80);
            const phone   = sanitizeText(document.getElementById('phone').value, 15).replace(/[^0-9+\s\-]/g, '');
            const email   = sanitizeText(document.getElementById('email').value, 120);
            const address = sanitizeText(document.getElementById('address').value, 300);

            if (name.length < 2)                        return showFeedback('error', t('notif_cart_err'));
            if (phone.replace(/\D/g,'').length < 8)     return showFeedback('error', t('notif_cart_err'));
            if (email && !isValidEmail(email))           return showFeedback('error', t('notif_cart_err'));
            if (address.length < 5)                      return showFeedback('error', t('notif_cart_err'));

            const safeCart = cart
                .filter(i => i && typeof i.name === 'string' && Number.isFinite(i.price) && Number.isInteger(i.qty))
                .map(i => ({
                    name:  sanitizeText(i.name, 120),
                    qty:   Math.max(1, Math.min(99, i.qty)),
                    price: Math.max(0, Number(i.price.toFixed(2)))
                }));

            if (safeCart.length === 0) return showFeedback('error', t('cart_empty'));

            const safeTotal = safeCart.reduce((acc, i) => acc + i.price * i.qty, 0);

            const submitBtn = document.getElementById('submitBtn');
            submitBtn.textContent = t('btn_sending');
            submitBtn.disabled = true;

            const orderData = {
                customer: { name, phone, email, address },
                cart: safeCart,
                total: safeTotal
            };

            try {
                const response    = await fetch('/api/order', {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify(orderData)
                });
                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) throw new TypeError('No JSON');
                const result = await response.json();

                if (result.success) {
                    localStorage.removeItem('flowerCart');
                    showFeedback('success',
                        `${t('cart_checkout')}!<br>
                        Nr. comenzii: <span class="order-id">${result.orderId}</span><br>
                        <small>Redirectionare in cateva secunde...</small>`
                    );
                    setTimeout(() => window.location.href = '/', 4000);
                } else {
                    showFeedback('error', result.error || t('notif_cart_err'));
                    submitBtn.textContent = t('btn_retry');
                    submitBtn.disabled = false;
                }
            } catch (err) {
                showFeedback('error', t('notif_cart_err'));
                submitBtn.textContent = t('btn_retry');
                submitBtn.disabled = false;
            }
        });

        window.addEventListener('load', () => {
            document.getElementById('loader').classList.add('hidden');
        });

        window.onLangChange = function() {
            document.getElementById('submitBtn').textContent = t('btn_submit');
        };