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

### Chiuso il 06/08/2026 — tutto in produzione

Merge fatto su `main`, backend ridistribuito e **verificato interrogandolo**:

| Verifica | Esito |
|---|---|
| Schede servite (IT) | 120, **0 in spagnolo o inglese** |
| Login Google | attivo, `{"enabled": true}` |
| Token Google falso | respinto, 401 |
| `/api/cron/*` senza chiave | bloccato, 403 |

**Le chiavi Google stanno in `render.yaml`, non nel pannello.** Un client ID
OAuth non è un segreto: viaggia in chiaro in ogni richiesta che il browser manda
a Google. Ciò che protegge l'account è la verifica del token in
`/api/auth/google`. Tenerle nel file significa che un push configura il deploy,
senza dover entrare nella dashboard. Il *secret* del client web non serve e non
è salvato da nessuna parte: il flusso `id_token` non lo usa.

Progetto Google Cloud: **Accadde Oggi** (`crack-petal-504317-a9`), consenso **in
produzione** (non più solo utenti di prova). Il client Android usa la **SHA-1 di
Play App Signing** (`D4:8A:52:…:27:79`), non quella di caricamento: con quella
sbagliata il login va in sviluppo e fallisce nell'app pubblicata. È l'errore più
comune di tutti.

### Correzioni della sessione del 05-06/08

- **Lingua sporca alla radice**: `build_merged_events` applicava la catena di
  ripiego mentre *costruiva*, scrivendo la frase spagnola dentro
  `text_by_lang["it"]`. Tutto il resto credeva in buona fede di avere italiano.
  Ora ogni lingua sta sotto la propria chiave e il feed serve **solo** ciò che
  esiste nella lingua del lettore. Misurato: 86 schede straniere → 0.
- **Categorie preferite**: non era un bug di salvataggio ma un equivoco — quella
  lista si calcola dai Mi piace, non dagli interessi. Aggiunti
  `POST /api/events/reset`, "Azzera i miei Mi piace", "Togli tutti" e la scritta
  che gli interessi si salvano da soli.
- **36 sottogeneri** (erano 26, e nessuno poteva filtrarli: il campo usciva
  dall'API e finiva nel nulla). Filtro `?subcategory=` + riga in Esplora che
  compare solo dopo aver scelto una categoria.
- **Esplora da 4 file di filtri a 2**: ambito e decade dietro "Altri filtri",
  con contatore dei filtri nascosti attivi.
- **Menu inferiore animato** (`AnimatedTabBar`) con barretta che scorre e
  risposta aptica.
- **Fessura di 12px sotto ogni scheda**: feed e barra calcolavano l'altezza
  ciascuno per conto proprio. Ora la decide `useTabBarHeight` e basta.
- **Apertura**: tolti i file avanzati dal modello Expo (`react-logo*`,
  `partial-react-logo`, `app-image`, `splash-image`) e messa l'icona dentro la
  zona sicura di Android. Splash e schermata nativa ora usano la stessa arte,
  quindi non c'è più il salto che sembrava un disegno che compare a caso.
- **Play Store**: tolto `USE_EXACT_ALARM`, che Google riserva ad app di
  sveglie/timer/calendari e che avrebbe messo a rischio l'approvazione.
- Segreto cron spostato dalla query string a un header, confronto a tempo
  costante.

### Build
- **AAB versionCode 10** (per il Play Store):
  https://expo.dev/artifacts/eas/yuaVee9QaF6hfxjQutO1ZB5nwj-dmykLa-tJi1n7iRE.aab
- **APK** (profilo `preview`, installabile a mano per provare): firmato con la
  chiave di *caricamento*, quindi **il login Google non funziona lì** — Google
  riconosce l'app dalla firma. Per provare anche quello serve il test interno di
  Play Console.

### Resta da fare
1. Caricare l'AAB su Play Console (serve l'account sviluppatore).
2. Provare il login Google **da test interno**, non da APK: è l'unico modo.
3. Se si vuole: analisi dell'app "Lo Sapevi Che" (nicchie di notizie), chiesta e
   non ancora fatta.

## Note
- Push da `D:ccadde_clone` con PAT GitHub fine-grained; il CLI `gh` in questa
  macchina è già autenticato come `blackstardigitalstudio` (l'account giusto).
  Attenzione: nel browser esistono altri account simili
  (`blackstardigitals-lang`, `blackstardigitalstudio-arch`) che **non** hanno
  permessi sul repo.
- Made in Italy 🇮🇹
