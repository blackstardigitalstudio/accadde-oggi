# Accadde Oggi — Handoff / Linea di lavoro

Brief di continuazione per una nuova sessione (es. Claude Cowork). Riprende da dove siamo.

## Cos'è
App Expo/React Native (IT/EN/ES) di eventi storici quotidiani + backend FastAPI/MongoDB.
Migrata da Emergent, deployata gratis, in pubblicazione su Google Play (test interno).

## Repo & copie locali
- GitHub: https://github.com/blackstardigitalstudio/accadde-oggi (branch `main`)
- `D:\accadde_clone` = copia **canonica** (push su GitHub)
- `D:\accadde oggi\accadde-oggi-main\accadde-oggi-main\frontend` = ha `node_modules` (per build EAS)

## Già fatto e ONLINE
- Web: https://accadde-oggi-web.onrender.com · API: https://accadde-oggi-api.onrender.com (Render, auto-deploy su push)
- DB: MongoDB Atlas free. Login demo: `demo@accaddeoggi.app` / `Demo1234`
- Emergent rimosso; approfondimento = estratto reale Wikipedia; immagini evento migliorate; icona **AO** dorata; "Made in Italy"; privacy su `/privacy`
- Marketing: `marketing/PLAY_STORE_LISTING.md` + `marketing/assets/` (feature_graphic.png, store_icon.png)
- **AAB** (EAS account `blackstark`), versionCode 4, package `app.accaddeoggi.mobile`, punta al backend live →
  `C:\Users\stell\Downloads\application-7573e4f2-097a-4946-803a-156916dbd860.aab`
- **OTA** (expo-updates + EAS Update) configurato nel progetto. Build OTA bloccata: **quota build Android gratuite EAS esaurita fino a Lun 1 Giu 2026** → poi ricostruire per includere l'OTA.

## Dove siamo (Play Console, dev account 5841476158353169844)
- App "Accadde Oggi" **creata** → App ID `4974048682038499830`
- Pagina "Preparar versión" (Test interno → nuova release, track `4700702515196015844`, release 1)
- **In attesa**: l'utente deve trascinare manualmente l'AAB (60,5 MB; `file_upload` è limitato a 10 MB)

## Come pilotare il Play Console
L'estensione Chrome NON può screenshot/click su `play.google.com`, **ma `mcp__Claude_in_Chrome__javascript_tool` funziona**: usa JS per leggere il DOM, cliccare, compilare input React (native value setter + dispatch `input`/`change`). NON spuntare caselle legali / accettare termini al posto dell'utente.

## Prossimi passi (dopo upload AAB)
1. Note di versione (opzionali) → Avanti/Salva
2. Dichiarazioni (risposte pronte):
   - Privacy URL: `https://accadde-oggi-web.onrender.com/privacy`
   - Accesso app: login richiesto → demo `demo@accaddeoggi.app` / `Demo1234`
   - Annunci: nessuno · Sicurezza dati: Email+Nome (account), cifrati in transito, non condivisi, cancellabili
   - Classificazione: Notizie/Istruzione → Tutti · Pubblico: 13+
3. Scheda store: testi da `marketing/PLAY_STORE_LISTING.md`; icona `marketing/assets/store_icon.png`; feature `marketing/assets/feature_graphic.png`
4. Collega la lista tester interni salvata → copia link di partecipazione
5. Rivedi → avvia rollout test interno (l'utente conferma il rollout)

## Aggiornamento 02/08/2026 — branch `feat/contenuti-notifiche-google`

Lavorato nella copia `D:\accadde oggi\...` (che prima non aveva remote: aggiunto
`origin` e riportato tutto sopra `origin/main`, così il tasto PayPal, i fix
TypeScript e `keep-warm.yml` sono rimasti intatti).

- **Contenuti**: dal feed Wikipedia `events` al feed `all` → arrivano anche nati,
  morti ed eventi in evidenza. 772 voci grezze, poi **selezionate**: restano ~133
  eventi + ~105 personaggi noti. Nuovo campo `kind` (event/birth/death) e
  `extract` (estratto reale dell'articolo, mostrato come "Approfondimento").
- **Selezione dei personaggi** (`curate_people`): Wikipedia elenca ogni persona
  nata quel giorno, centinaia, quasi tutte sconosciute. Wikidata ci dice in quante
  edizioni compare ciascuno: sotto `FAME_MIN` (30) si scarta. 639 → 105.
  La stessa chiamata dà il titolo dell'articolo **italiano**, che viene poi
  scaricato: tutti e 105 i personaggi hanno testo italiano vero.
  **Fallisce in sicurezza**: se Wikidata non risponde si tiene tutto, non si
  cancella nulla.
- Ordine importante: si seleziona *prima*, si cercano le immagini *dopo* — solo
  sui sopravvissuti. Invertito, il fallback immagini faceva scattare il 429 di
  Wikimedia e la selezione tornava vuota.
- **Aggiornamento automatico**: worker interno (refresh giornaliero di oggi +2,
  pulizia cache, giro di push, self-ping su `SELF_URL`) + `/api/cron/daily` e
  `/api/cron/push` protetti da `CRON_SECRET` + `daily-refresh.yml`.
- **Notifiche**: canali Android MAX con vibrazione lunga, canale a parte per gli
  anniversari tondi, frequenza scelta dall'utente (2/5/10 al giorno), copy
  riscritto sul gancio di curiosità, push dal server via Expo.
- **Login Google**: `/api/auth/google`. Serve che l'utente crei le credenziali —
  guida in `docs/GOOGLE-LOGIN.md`. Senza `GOOGLE_CLIENT_IDS` il bottone non compare.
- **Velocità**: bcrypt su thread e costo 10 → registrazione 152 ms, login 128 ms
  (prima bloccava tutto il server a ogni registrazione).
- `app.json` a **1.1.0**: le nuove dipendenze native (expo-auth-session,
  expo-crypto) e i permessi nuovi richiedono una **build nuova**, non basta l'OTA.

### Da fare
1. Su Render (`accadde-oggi-api`): impostare `SELF_URL`, `CRON_SECRET`, e
   `GOOGLE_CLIENT_IDS` quando le credenziali Google sono pronte.
2. Merge del branch su `main` → auto-deploy del backend (i contenuti nuovi
   arrivano subito anche alle app già installate).
3. Nuova build EAS per notifiche e Google (quota permettendo).

## Note
- Push da `D:\accadde_clone` con PAT GitHub fine-grained (solo questa repo, scade 28/06/2026); una nuova sessione potrebbe doverne rigenerare uno.
- Made in Italy 🇮🇹
