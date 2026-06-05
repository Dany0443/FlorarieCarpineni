const loaderStart = Date.now();

window.addEventListener('load', () => {
            const elapsed = Date.now() - loaderStart;
            const remaining = Math.max(0, 400 - elapsed);
            setTimeout(() => {
                document.getElementById('loader').classList.add('hidden');
            }, remaining);
        });

        function trackTelemetry(event, data) {
            try {
                if (window.Telemetry && typeof window.Telemetry.track === 'function') {
                    window.Telemetry.track(event, data || {});
                }
            } catch (_) {}
        }

        function sanitizeText(str, maxLen) {
            return String(str).trim().replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').slice(0, maxLen);
        }

        const msgArea  = document.getElementById('contactMessage');
        const msgCount = document.getElementById('msgCount');

        msgArea.addEventListener('input', () => {
            const len = msgArea.value.length;
            msgCount.textContent = `${len} / 1000`;
            msgCount.className = 'char-count' + (len > 900 ? ' over' : len > 750 ? ' warn' : '');
        });

        function showFeedback(type, msg) {
            const el = document.getElementById('formFeedback');
            el.textContent   = msg;
            el.className     = `form-feedback ${type}`;
            el.style.display = 'block';
        }
        function hideFeedback() {
            document.getElementById('formFeedback').style.display = 'none';
        }

        document.getElementById('contactForm').addEventListener('submit', async (e) => {
            e.preventDefault();

            const name    = sanitizeText(document.getElementById('contactName').value, 80);
            const message = sanitizeText(msgArea.value, 1000);

            if (name.length < 2)    return showFeedback('error', 'Numele trebuie să conțină cel puțin 2 caractere.');
            if (message.length < 5) return showFeedback('error', 'Mesajul este prea scurt.');

            const btn = document.getElementById('submitBtn');
            btn.disabled    = true;
            btn.textContent = t('btn_sending2');
            hideFeedback();
            trackTelemetry('contact_submit', { status: 'attempt' });

            try {
                const res  = await fetch('/api/contact', {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({ name, message })
                });
                const data = await res.json();

                if (data.success) {
                    trackTelemetry('contact_submit', { status: 'success' });
                    showFeedback('success', data.message || 'Mesajul a fost trimis cu succes! Vă vom contacta în curând.');
                    document.getElementById('contactForm').reset();
                    msgCount.textContent = '0 / 1000';
                    msgCount.className   = 'char-count';
                } else {
                    trackTelemetry('contact_submit', { status: 'fail', reason: data.error || 'server_rejected' });
                    showFeedback('error', data.error || 'Mesajul nu s-a putut trimite :( incercati din nou mai tarziu');
                }
            } catch {
                trackTelemetry('contact_submit', { status: 'fail', reason: 'network_error' });
                showFeedback('error', 'error');
            } finally {
                btn.disabled    = false;
                btn.textContent = t('btn_send');
            }
        });

        window.onLangChange = function() {
            document.getElementById('submitBtn').textContent = t('btn_send');
        };