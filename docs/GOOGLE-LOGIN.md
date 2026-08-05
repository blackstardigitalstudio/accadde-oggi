# Accedi con Google

## ✅ GIÀ FATTO — le credenziali esistono (05/08/2026)

Progetto Google Cloud **Accadde Oggi** (`crack-petal-504317-a9`), schermata di
consenso **in produzione** (chiunque abbia un account Google può accedere, non
solo utenti di prova).

```
GOOGLE_WEB_CLIENT_ID     = 727081593792-pbs5ve4p4l7cr4ck60f3dsd8263afs16.apps.googleusercontent.com
GOOGLE_ANDROID_CLIENT_ID = 727081593792-g8i94utsk023koa9ssugk57od5dkk1kc.apps.googleusercontent.com
GOOGLE_IOS_CLIENT_ID     = 727081593792-s1qd9u459hgcvm85v3nc0mmnqcblr8oe.apps.googleusercontent.com
```

**Manca solo:** incollare queste tre righe su Render (servizio `accadde-oggi-api`
→ Environment). Non serve ricompilare l'app: appena Render riparte, il bottone
"Continua con Google" compare da solo anche su chi ce l'ha già installata.

Questi ID non sono segreti — viaggiano in chiaro in ogni richiesta che il browser
manda a Google. Il segreto del client web non serve e non è stato salvato da
nessuna parte: l'app usa il flusso con `id_token`, che non lo richiede.

Dettagli di come sono stati creati:
- Client **Web**: origini e redirect `https://accadde-oggi-web.onrender.com` e
  `http://localhost:8081`
- Client **Android**: pacchetto `app.accaddeoggi.mobile`, impronta SHA-1
  `D4:8A:52:19:0A:ED:4E:4C:85:D7:FB:80:DC:18:E3:8D:72:A5:27:79` — è la **chiave di
  firma di Play**, quella con cui Google firma ciò che scaricano gli utenti. La
  chiave di *caricamento* (`CF:CD:78:55:50:EB:4A:0D:ED:A6:D3:EC:3B:9A:47:88:E9:EE:31:6F`)
  è un'altra: serve solo se un giorno vuoi che il login funzioni anche negli APK
  installati a mano, e in quel caso va creato un secondo client Android.
- Client **iOS**: bundle `app.accaddeoggi.mobile`

---

## Come rifarlo da zero (se un giorno serve)

Il codice è già pronto e funziona da solo. Manca solo una cosa che **solo tu puoi
fare**, perché va fatta dal tuo account Google: creare le credenziali OAuth.

Finché non le crei, il bottone "Continua con Google" **non appare** — l'app resta
identica a com'è ora, nessuno vede errori. Appena le incolli, appare da solo.

---

## In parole semplici

Google non lascia che un'app qualsiasi dica "questo utente è Tizio". Vuole prima
sapere chi sei tu, lo sviluppatore. Ti dà quindi un **tesserino** (il *client ID*)
che l'app mostra ogni volta. È come il badge dell'ufficio: senza, la porta non si apre.

Ti servono **tre tesserini**: uno per il sito web, uno per Android, uno per iPhone.
Sono gratis e non scadono.

---

## Passo 1 — Crea il progetto

1. Vai su https://console.cloud.google.com/
2. In alto a sinistra, menù dei progetti → **Nuovo progetto**
3. Nome: `Accadde Oggi` → **Crea**

## Passo 2 — Schermata di consenso

1. Menù a sinistra → **API e servizi** → **Schermata consenso OAuth**
2. Tipo di utente: **Esterno** → **Crea**
3. Compila solo i campi obbligatori:
   - Nome dell'app: `Accadde Oggi`
   - Email di assistenza: la tua
   - Email del contatto sviluppatore: la tua
4. **Salva e continua** fino in fondo. Gli ambiti (scopes) lasciali come sono.
5. In **Utenti di test** aggiungi la tua email finché l'app è in modalità test.

> Per pubblicarla a tutti servirà il pulsante **Pubblica app** nella stessa pagina.
> Con i soli ambiti email/profilo Google di norma non chiede verifica.

## Passo 3 — I tre tesserini

**API e servizi** → **Credenziali** → **Crea credenziali** → **ID client OAuth**.
Ripeti tre volte:

### A) Web
- Tipo: **Applicazione web**
- Nome: `Accadde Oggi Web`
- **Origini JavaScript autorizzate**:
  - `https://accadde-oggi-web.onrender.com`
  - `http://localhost:8081` (per le prove in locale)
- **URI di reindirizzamento autorizzati**:
  - `https://accadde-oggi-web.onrender.com`
  - `http://localhost:8081`

### B) Android
- Tipo: **Android**
- Nome: `Accadde Oggi Android`
- **Nome pacchetto**: `app.accaddeoggi.mobile`
- **Impronta digitale SHA-1**: prendila con questo comando nella cartella `frontend`:

```bash
npx eas credentials -p android
```

Scegli il profilo `production`, poi *Keystore: Manage everything...* → mostra il
**SHA-1 Fingerprint** e copialo.

> Se l'app è già sul Play Store, serve **anche** il SHA-1 di *Play App Signing*
> (Play Console → la tua app → Test e release → Firma dell'app). Crea un secondo
> ID client Android identico usando quel SHA-1: senza, il login funziona solo
> negli APK tuoi e non in quelli scaricati dallo store.

### C) iOS
- Tipo: **iOS**
- Nome: `Accadde Oggi iOS`
- **ID bundle**: `app.accaddeoggi.mobile`

---

## Passo 4 — Incolla i tesserini (un posto solo)

Dashboard Render → servizio `accadde-oggi-api` → **Environment** → aggiungi
queste tre righe e salva:

```
GOOGLE_WEB_CLIENT_ID     = <ID_WEB>
GOOGLE_ANDROID_CLIENT_ID = <ID_ANDROID>
GOOGLE_IOS_CLIENT_ID     = <ID_IOS>
```

**Basta questo. Non serve ricompilare l'app né ripubblicarla sul Play Store.**

L'app chiede al server quali tesserini usare ogni volta che si apre la schermata
di accesso: appena Render riparte con queste variabili, il bottone "Continua con
Google" compare da solo su tutti i telefoni che hanno già l'app installata.

> Perché si può fare: un *client ID* non è una password, è un numero di targa —
> viaggia in chiaro in ogni richiesta che il browser manda a Google. Quello che
> protegge davvero l'account è la verifica del token, che avviene sul server.
>
> Se hai un secondo ID Android per Play App Signing, aggiungilo in
> `GOOGLE_CLIENT_IDS` (separati da virgola): sono gli ID che il server accetta.

---

## Passo 5 — Verifica

Il backend dice da solo se è a posto:

```bash
curl https://accadde-oggi-api.onrender.com/api/auth/google/status
```

`{"enabled": true}` → fatto. `{"enabled": false}` → la variabile non è arrivata,
ricontrolla di aver salvato e fatto ripartire il servizio su Render.

---

## Note

- Chi entra con Google **non ha una password**: l'app lo sa e non gliela chiede
  mai. Se prova a entrare con email e password, riceve un messaggio chiaro.
- Se un utente aveva già un account con la stessa email, entrando con Google
  quell'account viene **collegato**, non duplicato. Non perde nulla.
- Il bottone usa un badge neutro con la "G". Prima di pubblicare l'aggiornamento
  sul Play Store conviene sostituirlo con il logo ufficiale Google, che le loro
  linee guida di branding richiedono.

Made in Italy 🇮🇹
