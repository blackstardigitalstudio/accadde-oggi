# Accadde Oggi 🇮🇹

> *Made in Italy*

**Accadde Oggi** ("On This Day") è un'app che ogni giorno mostra un feed in stile
TikTok di eventi storici accaduti oggi negli anni passati, personalizzato per
paese e gusti dell'utente. I contenuti arrivano in tempo reale da Wikipedia
(edizioni IT / EN / ES) e si **aggiornano automaticamente ogni giorno**.

- **Frontend**: Expo / React Native (TypeScript) — gira come app Android/iOS e come web app.
- **Backend**: FastAPI + MongoDB, dati da Wikipedia "On This Day".
- **Approfondimenti**: estratto reale dell'articolo Wikipedia dell'evento (gratis,
  senza chiave API). Opzionalmente, una LLM gratuita (Groq) per una versione narrativa.

> Nessuna dipendenza da piattaforme proprietarie: il progetto è completamente
> autonomo e ospitabile gratis.

---

## Funzionalità
- Autenticazione JWT (registrazione, login, refresh, profilo)
- Feed multilingua (IT/EN/ES) con eventi globali e locali al paese dell'utente
- Like / dislike / preferiti con personalizzazione
- Filtri per categoria, decennio e ambito (globale / locale)
- Notifiche push con teaser di eventi reali
- Approfondimento dell'evento dall'articolo Wikipedia

Account di prova (creati all'avvio se imposti le env): `demo@accaddeoggi.app / Demo1234`.

---

## Avvio in locale

### Prerequisiti
- Node.js 20+ e Yarn
- Python 3.11/3.12
- Un MongoDB (locale, oppure un cluster gratuito MongoDB Atlas)

### Backend
```bash
cd backend
cp .env.example .env          # poi compila MONGO_URL ecc.
pip install -r requirements.txt
uvicorn server:app --reload --port 8000
```
API su `http://127.0.0.1:8000/api`.

### Frontend
```bash
cd frontend
cp .env.example .env          # EXPO_PUBLIC_BACKEND_URL=http://127.0.0.1:8000
yarn install
yarn web        # web app          (oppure)
yarn start      # Expo (Android/iOS via Expo Go)
```

---

## Deploy gratuito (auto-aggiornante)

Il database vive su **MongoDB Atlas** (piano gratuito M0). Backend e web app
si pubblicano su **Render** tramite il blueprint [`render.yaml`](render.yaml):
ogni push sul branch collegato fa un re-deploy automatico.

1. **MongoDB Atlas**: crea un cluster M0 gratuito, un utente DB e ottieni la
   connection string (`mongodb+srv://...`). In *Network Access* consenti `0.0.0.0/0`.
2. **Render**: *New → Blueprint*, collega questo repo. Render legge `render.yaml`
   e crea due servizi:
   - `accadde-oggi-api` (FastAPI) — imposta `MONGO_URL`, `ADMIN_PASSWORD`,
     `TEST_USER_PASSWORD` (e, se vuoi, `GROQ_API_KEY`).
   - `accadde-oggi-web` (export web statico di Expo).
3. La web app è subito online e si aggiorna ad ogni `git push`.

### App native (Android / iOS)
- **Aggiornamenti OTA gratis**: `eas update` invia gli aggiornamenti JS ai
  dispositivi senza ripubblicare sugli store.
- **Android**: `eas build -p android --profile preview` produce un APK
  distribuibile direttamente (senza Google Play).
- **iOS / store**: la pubblicazione sugli store richiede account a pagamento
  (Apple Developer 99$/anno, Google Play 25$ una tantum).

### LLM gratuita opzionale (Groq)
Per approfondimenti in stile narrativo, crea una chiave gratis su
<https://console.groq.com/keys> e imposta `GROQ_API_KEY`. Senza chiave, l'app
usa l'estratto reale dell'articolo Wikipedia (gratis e affidabile).

---

*Made in Italy* 🇮🇹
