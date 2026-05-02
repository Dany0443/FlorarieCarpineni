# Luci Boutique

Site pentru o florarie, facut de Alexandru si Dan pentru **Tekwill Junior Ambassadors**.

---

## Ce face

**Magazin**
- Filtrare flori pe categorii, modal cu detalii si ingrijire
- Vizualizare 3D la 360° (Google Model Viewer)
- Cos persistent in localStorage
- Comanda cu email automat + factura PDF atasata

<br>
<details>
<summary><strong style="font-size: 1.4em;">Screenshots from Main Website</strong></summary>
<br>
| Showcase | Modal |
| :---: | :---: |
| <img src="https://github.com/Dany0443/FlorarieCarpineni/blob/main/public/assets/docs/screenshotbktl.png" width="400" alt="Panou Telemetrie Dark"> | <img src="https://github.com/Dany0443/FlorarieCarpineni/blob/main/public/assets/docs/screenshotwhtl.png" width="400" alt="Panou Telemetrie White"> |
| **Setari Dark**<br><img src="https://github.com/Dany0443/FlorarieCarpineni/blob/main/public/assets/docs/screenshotbkst.png" width="400" alt="Setari Dark"> | **Setari White**<br><img src="https://github.com/Dany0443/FlorarieCarpineni/blob/main/public/assets/docs/screenshotwhst.png" width="400" alt="Setari White"> |

</details>

<br>


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

<br>

<details>
<summary><strong style="font-size: 1.4em;">Screenshots from Admin page</strong></summary>

<br>

| Panou Telemetrie Dark | Panou Telemetrie White |
| :---: | :---: |
| <img src="https://github.com/Dany0443/FlorarieCarpineni/blob/main/public/assets/docs/screenshotbktl.png" width="400" alt="Panou Telemetrie Dark"> | <img src="https://github.com/Dany0443/FlorarieCarpineni/blob/main/public/assets/docs/screenshotwhtl.png" width="400" alt="Panou Telemetrie White"> |
| **Setari Dark**<br><img src="https://github.com/Dany0443/FlorarieCarpineni/blob/main/public/assets/docs/screenshotbkst.png" width="400" alt="Setari Dark"> | **Setari White**<br><img src="https://github.com/Dany0443/FlorarieCarpineni/blob/main/public/assets/docs/screenshotwhst.png" width="400" alt="Setari White"> |

</details>

<br>

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
