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

## Note
- Push da `D:\accadde_clone` con PAT GitHub fine-grained (solo questa repo, scade 28/06/2026); una nuova sessione potrebbe doverne rigenerare uno.
- Made in Italy 🇮🇹
