# Luci Boutique

Site pentru o florarie, facut de Alexandru si Dan pentru **Tekwill Junior Ambassadors**.
Vanilla JS, fara frameworks.

---

## Ce face

**Magazin**
- Filtrare flori pe categorii, modal cu detalii si ingrijire
- Vizualizare 3D la 360° (Google Model Viewer)
- Cos persistent in localStorage
- Comanda cu email automat + factura PDF atasata

**Checkout**
- Validare input pe client si server
- Google Pay / Apple Pay prin PaymentRequest API (demo)
- Confirmare comanda prin email cu PDF

**Admin** — la `/admops`
- Login cu parola sau passkey (Face ID, fingerprint, Windows Hello)
- Comenzi in timp real prin WebSocket + sunet la comanda noua
- Schimbare status comanda → push notification automat pe telefon
- Adaugare, editare, stergere produse + upload imagine
- Gestiune dispozitive conectate — redenumire, revocare instant
- Jurnalizare actiuni, log-uri cu rotatie automata
- Pagina de Telemetrie, pentru a vedea informatii despre utilizatori.

Some Images

<img src="https://github.com/Dany0443/FlorarieCarpineni/blob/main/public/assets/docs/screenshotbktl.png" width="500" alt="Panou Telemetrie">
  

**Altele**
- Romana, engleza, rusa
- Tema light / dark
- PWA - se poate instala pe telefon, functioneaza offline partial

---

## Stack

| | |
|---|---|
| Frontend | HTML, CSS, Vanilla JS |
| Backend | Node.js + Express |
| Auth | Session + WebAuthn (SimpleWebAuthn) |
| Real-time | Socket.io |
| Email + PDF | Nodemailer + PDFKit |
| Push | Web Push + VAPID |

---

## Rulare

```bash
npm install
node server.js
```

`http://localhost:3000` — admin la `/admops`, credentiale din `.env`.

---

## Echipa

Alexandru — [@Sans992](https://github.com/Sans992) / [@WJTMainDev](https://t.me/WJTMainDev)

Daniel — [@Dany0443](https://github.com/Dany0443) / [@Dany0443](https://t.me/Dany0443)

---

Open source in scop educational. Realizat in cadrul „Tekwill Junior Ambassadors".
