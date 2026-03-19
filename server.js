// rewrite the entire server.js V4 speram ca de data asta merge cum trebu
// patch 4.3

require('dotenv').config();

// aducem modulele necesare pentru server
const express    = require('express');
const nodemailer = require('nodemailer');
const cors       = require('cors');
const path       = require('path');
const fs         = require('fs');
const crypto     = require('crypto');
const readline   = require('readline');
const multer     = require('multer');

const app  = express();
const PORT = process.env.PORT || 3000;

const DIR_DATA      = path.join(__dirname, 'data');
const DIR_PUBLIC    = path.join(__dirname, 'public');
const DIR_UPLOADS   = path.join(DIR_PUBLIC, 'uploads');
const FILE_ORDERS   = path.join(DIR_DATA, 'orders.json');
const FILE_LOGS     = path.join(DIR_DATA, 'logs.txt');
const FILE_PRODUCTS = path.join(DIR_PUBLIC, 'js', 'products.js');

for (const dir of [DIR_DATA, DIR_UPLOADS]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
if (!fs.existsSync(FILE_ORDERS)) fs.writeFileSync(FILE_ORDERS, '[]');
if (!fs.existsSync(FILE_LOGS))   fs.writeFileSync(FILE_LOGS, '');

function log(level, msg) {
    const line = `[${new Date().toISOString()}] [${level}] ${msg}\n`;
    fs.appendFileSync(FILE_LOGS, line);
    if (level === 'ERROR') process.stderr.write(line);
}

function escHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function sanitize(val, maxLen) {
    return String(val ?? '')
        .trim()
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        .slice(0, maxLen);
}

function isValidEmail(email) {
    return /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(email);
}

function readProducts() {
    const src   = fs.readFileSync(FILE_PRODUCTS, 'utf-8');
    const start = src.indexOf('[');
    const end   = src.lastIndexOf(']');
    if (start === -1 || end === -1) return [];
    return new Function(`return ${src.slice(start, end + 1)}`)();
}

function writeProducts(products) {
    const items = products.map(p => {
        const lines = [
            `        id: ${p.id}`,
            `        name: ${JSON.stringify(p.name)}`,
            `        category: ${JSON.stringify(p.category || 'General')}`,
            `        price: ${Number(p.price)}`,
            `        image: ${JSON.stringify(p.image || '')}`,
            `        family: ${JSON.stringify(p.family || '')}`,
            `        desc: ${JSON.stringify(p.desc || '')}`,
            `        care: ${JSON.stringify(p.care || '')}`,
            `        note: ${JSON.stringify(p.note || '')}`,
            `        model3d: ${p.model3d ? JSON.stringify(p.model3d) : 'null'}`,
            `        listed: ${p.listed === false ? 'false' : 'true'}`,
        ];
        return `    {\n${lines.join(',\n')}\n    }`;
    });
    fs.writeFileSync(FILE_PRODUCTS, `const productsData = [\n${items.join(',\n')}\n];\n`, 'utf-8');
}

function readOrders() {
    try { return JSON.parse(fs.readFileSync(FILE_ORDERS, 'utf-8')); }
    catch { return []; }
}

function saveOrder(order) {
    const orders = readOrders();
    orders.push(order);
    fs.writeFileSync(FILE_ORDERS, JSON.stringify(orders, null, 2));
}

const mailer = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

const ADMIN_USER      = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS      = process.env.ADMIN_PASS || 'admin1132';
const sessions        = new Map();
const loginAttempts   = new Map();
const contactCooldown = new Map();

function genToken() { return crypto.randomBytes(32).toString('hex'); }

// protejam rutele daca nu i administrator
function requireAdmin(req, res, next) {
    // Permitem si formatul x-admin-token si formatul Authorization Bearer
    let token = req.headers['x-admin-token'];
    if (!token && req.headers['authorization']) {
        token = req.headers['authorization'].split(' ')[1];
    }

    if (!token || !sessions.has(token)) {
        return res.status(401).json({ success: false, error: 'Unauthorized.' });
    }
    const s = sessions.get(token);
    if (Date.now() > s.expires) {
        sessions.delete(token);
        return res.status(401).json({ success: false, error: 'Sesiune expirata.' });
    }
    s.expires = Date.now() + 4 * 60 * 60 * 1000;
    next();
}

// limitam incercarile de login sa nu scaneze parole
function checkBrute(ip) {
    const now = Date.now();
    const e   = loginAttempts.get(ip) || { count: 0, first: now };
    if (e.blockedUntil && now < e.blockedUntil) {
        return { ok: false, wait: Math.ceil((e.blockedUntil - now) / 1000) };
    }
    if (now - e.first > 15 * 60 * 1000) {
        loginAttempts.set(ip, { count: 1, first: now });
        return { ok: true };
    }
    e.count++;
    if (e.count >= 5) {
        e.blockedUntil = now + 15 * 60 * 1000;
        loginAttempts.set(ip, e);
        log('WARN', `Brute force blocat: ${ip}`);
        return { ok: false, wait: 900 };
    }
    loginAttempts.set(ip, e);
    return { ok: true };
}

function checkContactCooldown(ip) {
    const now  = Date.now();
    const last = contactCooldown.get(ip) || 0;
    if (now - last < 60 * 1000) return false;
    contactCooldown.set(ip, now);
    return true;
}

setInterval(() => {
    const now = Date.now();
    for (const [t, s] of sessions)      if (now > s.expires)                        sessions.delete(t);
    for (const [ip, e] of loginAttempts) if (e.blockedUntil && now > e.blockedUntil + 60000) loginAttempts.delete(ip);
    for (const [ip, t] of contactCooldown) if (now - t > 10 * 60 * 1000)            contactCooldown.delete(ip);
}, 10 * 60 * 1000);

const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, DIR_UPLOADS),
        filename:    (req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase();
            cb(null, `flower_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`);
        }
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ok = ['.jpg', '.jpeg', '.png', '.avif', '.webp']
            .includes(path.extname(file.originalname).toLowerCase());
        cb(null, ok);
    }
});

app.use(cors());
app.use(express.json({ limit: '512kb' }));
app.use(express.urlencoded({ extended: true, limit: '512kb' }));
app.use(express.static(DIR_PUBLIC, {
    maxAge: '1d',
    setHeaders(res, filePath) {
        if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    }
}));

app.get('/',         (req, res) => res.sendFile(path.join(DIR_PUBLIC, 'index.html')));
app.get('/checkout', (req, res) => res.sendFile(path.join(DIR_PUBLIC, 'checkout.html')));
app.get('/contact',  (req, res) => res.sendFile(path.join(DIR_PUBLIC, 'contact.html')));
app.get('/adminpan', (req, res) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(path.join(DIR_PUBLIC, 'adminpan.html'));
});

app.get('/api/products', (req, res) => {
    try {
        const products = readProducts().filter(p => p.listed !== false);
        res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
        res.json({ success: true, products });
    } catch (e) {
        log('ERROR', `readProducts: ${e.message}`);
        res.json({ success: true, products: [] });
    }
});

app.post('/api/admin/login', (req, res) => {
    const ip = req.ip;
    const bf = checkBrute(ip);
    if (!bf.ok) {
        log('WARN', `Login blocat: ${ip}`);
        return res.status(429).json({ success: false, error: `Prea multe incercari. Asteptati ${bf.wait}s.` });
    }
    const username = sanitize(req.body.username, 80);
    const password = sanitize(req.body.password, 200);
    if (!username || !password || username !== ADMIN_USER || password !== ADMIN_PASS) {
        log('WARN', `Login esuat: ${ip}`);
        return res.status(401).json({ success: false, error: 'Credentiale gresite.' });
    }
    const token = genToken();
    sessions.set(token, { expires: Date.now() + 4 * 60 * 60 * 1000, ip });
    loginAttempts.delete(ip);
    log('INFO', `Admin logat: ${ip}`);
    res.json({ success: true, token });
});


app.post('/api/admin/logout', requireAdmin, (req, res) => {
    let token = req.headers['x-admin-token'];
    if (!token && req.headers['authorization']) {
        token = req.headers['authorization'].split(' ')[1];
    }
    
    sessions.delete(token);
    log('INFO', 'Admin delogat');
    res.json({ success: true });
});

app.get('/api/admin/orders', requireAdmin, (req, res) => {
    res.json({ success: true, orders: readOrders() });
});

app.get('/api/admin/logs', requireAdmin, (req, res) => {
    const lines = fs.readFileSync(FILE_LOGS, 'utf-8')
        .trim().split('\n').filter(Boolean).slice(-200).reverse();
    res.json({ success: true, logs: lines });
});

app.get('/api/admin/products', requireAdmin, (req, res) => {
    try {
        res.json({ success: true, products: readProducts() });
    } catch (e) {
        log('ERROR', `readProducts admin: ${e.message}`);
        res.status(500).json({ success: false, error: 'Nu am putut citi produsele.' });
    }
});

app.post('/api/admin/upload', requireAdmin, upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, error: 'Fisier invalid.' });
    log('INFO', `Imagine incarcata: ${req.file.filename}`);
    res.json({ success: true, path: '/uploads/' + req.file.filename });
});

app.post('/api/admin/products', requireAdmin, (req, res) => {
    const name  = sanitize(req.body.name, 120);
    const price = Number(req.body.price);
    if (!name || !price || price <= 0) {
        return res.status(400).json({ success: false, error: 'Nume si pret sunt obligatorii.' });
    }
    try {
        const products = readProducts();
        const p = {
            id:       Date.now(),
            name,
            category: sanitize(req.body.category, 50) || 'General',
            price,
            image:    sanitize(req.body.image, 500) || '',
            family:   sanitize(req.body.family, 120) || '',
            desc:     sanitize(req.body.desc, 1000) || '',
            care:     sanitize(req.body.care, 500) || '',
            note:     sanitize(req.body.note, 300) || '',
            model3d:  null,
            listed:   true,
        };
        products.push(p);
        writeProducts(products);
        log('INFO', `Produs adaugat: ${name} (id=${p.id})`);
        res.json({ success: true, product: p });
    } catch (e) {
        log('ERROR', `Adaugare produs: ${e.message}`);
        res.status(500).json({ success: false, error: 'Nu am putut salva produsul.' });
    }
});

app.patch('/api/admin/products/:id', requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: 'ID invalid.' });
    try {
        const products = readProducts();
        const idx = products.findIndex(p => p.id === id);
        if (idx === -1) return res.status(404).json({ success: false, error: 'Produs negasit.' });
        const p = products[idx];
        if (req.body.name     !== undefined) p.name     = sanitize(req.body.name, 120);
        if (req.body.price    !== undefined) p.price    = Math.max(0, Number(req.body.price));
        if (req.body.category !== undefined) p.category = sanitize(req.body.category, 50);
        if (req.body.family   !== undefined) p.family   = sanitize(req.body.family, 120);
        if (req.body.desc     !== undefined) p.desc     = sanitize(req.body.desc, 1000);
        if (req.body.care     !== undefined) p.care     = sanitize(req.body.care, 500);
        if (req.body.note     !== undefined) p.note     = sanitize(req.body.note, 300);
        if (req.body.image && req.body.image !== '') p.image = sanitize(req.body.image, 500);
        writeProducts(products);
        log('INFO', `Produs actualizat: id=${id}`);
        res.json({ success: true, product: p });
    } catch (e) {
        log('ERROR', `Actualizare produs: ${e.message}`);
        res.status(500).json({ success: false, error: 'Nu am putut actualiza produsul.' });
    }
});

app.patch('/api/admin/products/:id/toggle', requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: 'ID invalid.' });
    try {
        const products = readProducts();
        const idx = products.findIndex(p => p.id === id);
        if (idx === -1) return res.status(404).json({ success: false, error: 'Produs negasit.' });
        products[idx].listed = products[idx].listed === false;
        writeProducts(products);
        log('INFO', `Produs listed=${products[idx].listed}: id=${id}`);
        res.json({ success: true, listed: products[idx].listed });
    } catch (e) {
        log('ERROR', `Toggle produs: ${e.message}`);
        res.status(500).json({ success: false, error: 'Nu am putut schimba starea produsului.' });
    }
});

app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: 'ID invalid.' });
    try {
        const products = readProducts();
        const filtered = products.filter(p => p.id !== id);
        if (filtered.length === products.length) {
            return res.status(404).json({ success: false, error: 'Produs negasit.' });
        }
        writeProducts(filtered);
        log('INFO', `Produs sters: id=${id}`);
        res.json({ success: true });
    } catch (e) {
        log('ERROR', `Stergere produs: ${e.message}`);
        res.status(500).json({ success: false, error: 'Nu am putut sterge produsul.' });
    }
});

app.post('/api/order', async (req, res) => {
    const raw = req.body;

    const customer = {
        name:    sanitize(raw.customer?.name,    80),
        phone:   sanitize(raw.customer?.phone,   20).replace(/[^0-9+\s\-]/g, ''),
        email:   sanitize(raw.customer?.email,   120),
        address: sanitize(raw.customer?.address, 300),
    };

    if (!customer.name || customer.name.length < 2)
        return res.status(400).json({ success: false, error: 'Nume invalid.' });
    if (!customer.phone || customer.phone.replace(/\D/g, '').length < 8)
        return res.status(400).json({ success: false, error: 'Telefon invalid.' });
    if (!customer.address || customer.address.length < 5)
        return res.status(400).json({ success: false, error: 'Adresa invalida.' });
    if (customer.email && !isValidEmail(customer.email))
        return res.status(400).json({ success: false, error: 'Email invalid.' });

    if (!Array.isArray(raw.cart) || raw.cart.length === 0)
        return res.status(400).json({ success: false, error: 'Cosul este gol.' });

    const cart = raw.cart
        .filter(i => i && typeof i.name === 'string'
            && Number.isFinite(Number(i.price))
            && Number.isFinite(Number(i.qty)))
        .map(i => ({
            name:  sanitize(i.name, 120),
            qty:   Math.max(1, Math.min(99, Math.floor(Number(i.qty)))),
            price: Math.max(0, parseFloat(Number(i.price).toFixed(2))),
        }));

    if (!cart.length)
        return res.status(400).json({ success: false, error: 'Cos invalid.' });

    const total = parseFloat(cart.reduce((s, i) => s + i.price * i.qty, 0).toFixed(2));

    const order = {
        id:        `ORD-${Date.now()}`,
        timestamp: new Date().toISOString(),
        customer, cart, total,
    };

    try {
        saveOrder(order);
        log('INFO', `Comanda salvata: ${order.id} | ${customer.name} | ${total} MDL`);
    } catch (e) {
        log('ERROR', `Salvare comanda: ${e.message}`);
    }

    const rows = cart.map(i => `
        <tr>
            <td style="padding:8px;border:1px solid #ddd;">${escHtml(i.name)}</td>
            <td style="padding:8px;border:1px solid #ddd;text-align:center;">${i.qty}</td>
            <td style="padding:8px;border:1px solid #ddd;text-align:right;">${i.price} MDL</td>
        </tr>`).join('');

    const table = `
        <table style="width:100%;border-collapse:collapse;margin-top:12px;">
            <thead><tr style="background:#f4f4f4;">
                <th style="padding:8px;border:1px solid #ddd;text-align:left;">Produs</th>
                <th style="padding:8px;border:1px solid #ddd;">Cant.</th>
                <th style="padding:8px;border:1px solid #ddd;text-align:right;">Pret</th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table>
        <p style="text-align:right;font-size:1.1rem;font-weight:700;color:#aa0132;margin-top:10px;">Total: ${total} MDL</p>`;

    try {
        await mailer.sendMail({
            from:    `Luci Boutique <${process.env.EMAIL_USER}>`,
            to:      process.env.EMAIL_USER,
            subject: `Comanda noua: ${escHtml(customer.name)} — ${total} MDL`,
            html: `<div style="font-family:Arial,sans-serif;color:#333;max-width:600px;">
                <h2 style="color:#aa0132;">Comanda Noua</h2>
                <p><strong>ID:</strong> ${order.id}</p>
                <p><strong>Client:</strong> ${escHtml(customer.name)}</p>
                <p><strong>Telefon:</strong> ${escHtml(customer.phone)}</p>
                <p><strong>Email:</strong> ${escHtml(customer.email || '—')}</p>
                <p><strong>Adresa:</strong> ${escHtml(customer.address)}</p>
                ${table}
            </div>`
        });
        log('INFO', `Email proprietar: ${order.id}`);

        if (customer.email) {
            await mailer.sendMail({
                from:    `Luci Boutique <${process.env.EMAIL_USER}>`,
                to:      customer.email,
                subject: `Confirmare comanda ${order.id}`,
                html: `<div style="font-family:Arial,sans-serif;color:#333;max-width:600px;">
                    <h2 style="color:#aa0132;">Comanda ta a fost primita!</h2>
                    <p>Buna, <strong>${escHtml(customer.name)}</strong>.</p>
                    <p>Te contactam la <strong>${escHtml(customer.phone)}</strong> pentru confirmare.</p>
                    <p><strong>Nr. comanda:</strong> ${order.id}</p>
                    <p><strong>Adresa livrare:</strong> ${escHtml(customer.address)}</p>
                    ${table}
                    <p style="color:#888;font-size:0.85rem;margin-top:20px;">
                        Plata la livrare (ramburs) &mdash; Luci Boutique, Carpineni, Moldova &mdash; 068 167 766
                    </p>
                </div>`
            });
            log('INFO', `Email confirmare client: ${order.id}`);
        }

        res.json({ success: true, orderId: order.id });
    } catch (e) {
        log('ERROR', `Email comanda ${order.id}: ${e.message}`);
        res.status(500).json({ success: false, error: 'Eroare la trimiterea comenzii.' });
    }
});

app.post('/api/contact', async (req, res) => {
    const ip = req.ip;
    if (!checkContactCooldown(ip)) {
        return res.status(429).json({ success: false, error: 'Asteptati un minut intre mesaje.' });
    }
    const name    = sanitize(req.body.name, 80);
    const message = sanitize(req.body.message, 1000);
    if (!name || name.length < 2)
        return res.status(400).json({ success: false, error: 'Nume invalid.' });
    if (!message || message.length < 5)
        return res.status(400).json({ success: false, error: 'Mesaj prea scurt.' });
    try {
        await mailer.sendMail({
            from:    `Luci Boutique <${process.env.EMAIL_USER}>`,
            to:      process.env.EMAIL_USER,
            subject: `Mesaj nou de la ${escHtml(name)}`,
            html: `<div style="font-family:Arial,sans-serif;color:#333;max-width:600px;">
                <h2 style="color:#aa0132;">Mesaj de Contact</h2>
                <p><strong>Nume:</strong> ${escHtml(name)}</p>
                <p><strong>Mesaj:</strong></p>
                <p style="background:#f4f4f4;padding:15px;border-radius:8px;white-space:pre-wrap;">${escHtml(message)}</p>
            </div>`
        });
        log('INFO', `Contact de la ${name} (${ip})`);
        res.json({ success: true });
    } catch (e) {
        log('ERROR', `Email contact: ${e.message}`);
        res.status(500).json({ success: false, error: 'Eroare la trimitere.' });
    }
});

app.use((req, res) => res.status(404).json({ success: false, error: 'Not found.' }));

app.use((err, req, res, next) => {
    log('ERROR', `Unhandled: ${err.message}`);
    res.status(500).json({ success: false, error: 'Eroare server.' });
});

async function shutdown(signal) {
    log('INFO', `Oprire: ${signal}`);
    try {
        rl.close();
        await new Promise((ok, fail) => server.close(e => e ? fail(e) : ok()));
        log('INFO', 'Server oprit.');
        process.exit(0);
    } catch (e) {
        log('ERROR', `Eroare oprire: ${e.message}`);
        process.exit(1);
    }
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const server = app.listen(PORT, () => {
    log('INFO', `Server pornit pe portul ${PORT}`);
    console.log(`Server => http://localhost:${PORT}`);
});

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException',  e => log('ERROR', `uncaughtException: ${e.message}`));
process.on('unhandledRejection', e => log('ERROR', `unhandledRejection: ${e}`));
rl.on('line', l => {
    if (['stop', 'quit', 'exit'].includes(l.trim().toLowerCase())) shutdown('ADMIN');
});
