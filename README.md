# Luci Boutique

Site web pentru o florărie modernă, construit de Alexandru și Dan pentru concursul **Tekwill Junior Ambassadors**.

Vanilla JS, fără frameworks.

---

## Ce face

- Colecție de flori cu filtrare pe categorii
- Vizualizare 3D la 360° (Google Model Viewer) pentru produse selectate
- Coș de cumpărături persistent (localStorage)
- Comandă directă cu notificare prin email
- Suport multilingv — română, engleză, rusă
- Temă light/dark
- PWA-ready — se poate instala ca aplicație pe telefon
- Pagină de contact cu formular
- **Panou de administrare** — gestionare produse, vizualizare comenzi în timp real

---

## Stack

| Layer | Tehnologie |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JS |
| Backend | Node.js + Express |
| Email | Nodemailer |
| 3D | Google Model Viewer (GLB) |
| Auth admin | Session-based, server-side |

---

## Rulare locală

```bash
npm install
node server.js
```

Deschide `http://localhost:3000`

Panoul admin e la `/adminpan.html` — credențialele se setează în variabilele env.

---

## Echipă

Alexandru — [@Sans992](https://github.com/Sans992) / [@WJTMainDev](https://t.me/WJTMainDev)

Daniel — [@Dany0443](https://github.com/Dany0443) / [@Dany0443](https://t.me/Dany0443)

---

## Licență

Open source în scop educațional. Imaginile și modelele 3D sunt folosite demonstrativ.
