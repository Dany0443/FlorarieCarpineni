function detectTheme() {
    const saved = localStorage.getItem('lb_theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('lb_theme', theme);
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === theme);
    });
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    applyTheme(current === 'dark' ? 'light' : 'dark');
}

function initTheme() {
    applyTheme(detectTheme());
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        if (!localStorage.getItem('lb_theme')) {
            applyTheme(e.matches ? 'dark' : 'light');
        }
    });
}

function injectControls() {
    const toolbar = document.createElement('div');
    toolbar.className = 'lb-controls';
    toolbar.innerHTML = `
        <div class="lb-controls-inner">
            <div class="lang-group">
                <button class="lang-btn" data-lang="ro">RO</button>
                <button class="lang-btn" data-lang="en">EN</button>
                <button class="lang-btn" data-lang="ru">RU</button>
            </div>
            <button class="theme-toggle" id="theme-toggle-btn" aria-label="Toggle theme">
                <span class="theme-icon-light">☀️</span>
                <span class="theme-icon-dark">🌙</span>
            </button>
        </div>
    `;
    document.body.appendChild(toolbar);

    toolbar.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => setLang(btn.dataset.lang));
    });

    document.getElementById('theme-toggle-btn').addEventListener('click', toggleTheme);
}

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initLang();
    injectControls();

    setTimeout(() => {
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === window.__lang);
        });
        const theme = document.documentElement.getAttribute('data-theme') || 'light';
        applyTheme(theme);
    }, 50);
});