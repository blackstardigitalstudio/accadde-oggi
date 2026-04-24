#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: "Accadde Oggi — Add curiosity-inducing push notifications that include the actual event or half of it as a hook to make users open the app."

backend:
  - task: "GET /api/img — Wikimedia image proxy (public, cached, fallback PNG)"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Added public /api/img endpoint that proxies Wikimedia images with proper User-Agent + 2-retry backoff on 429, in-memory cache (cap 200), concurrency limit (semaphore=4), and a tiny 68-byte transparent PNG fallback on upstream failure. Allows only upload.wikimedia.org / commons.wikimedia.org; other hosts → 400."
      - working: true
        agent: "testing"
        comment: "All 6 /api/img scenarios PASS: (1) Valid Wikimedia URL (Prince 1981 1080px) → 200, Content-Type image/jpeg, Cache-Control present, 196,874-byte JPEG. (2) Non-wikimedia URL (https://evil.com/x.jpg) → 400 with detail 'Only Wikimedia images are allowed'. (3) Missing ?url param → 422 (FastAPI validation). (4) Malformed Wikimedia URL (non-existent path) → 200 with image/png fallback (68 bytes, close to the spec's ~100-byte tiny PNG) — never 500. (5) Second call same URL: 0.141s vs 0.159s first (cache hit confirmed, slightly faster). (6) No Authorization header required — endpoint is public as designed. NOTE (Minor, not a bug): the Cache-Control header on the response is 'no-store, no-cache, must-revalidate' (likely overridden by the K8s ingress/CDN) rather than the 'public, max-age=86400, immutable' that the FastAPI code sets; however the header IS present as required and the server-side cache still works. Regression PASS: POST /api/auth/login 200, GET /api/events/today?limit=20 200 (20 events), GET /api/events/teasers?count=5 200 (5 teasers), GET /api/events/stats 200. Total 10/10 tests passed."

  - task: "GET /api/events/teasers — Curiosity teaser endpoint for push notifications"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"

  - task: "Password recovery — security question endpoints"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Added 3 new endpoints + user model changes: (1) POST /api/auth/forgot/question {email} → returns user's security question or 404 generic; (2) POST /api/auth/forgot/reset {email, answer, new_password} → verifies bcrypt hash of lowercased answer, resets password, updates password_changed_at to invalidate all existing sessions; (3) PATCH /api/auth/security-question {current_password, question, answer} (auth required) → set/change question. Register endpoint now accepts optional security_question + security_answer. user_public now returns 'has_security_question: bool'. Session invalidation implemented via password_changed_at check in get_current_user (compares JWT iat with user's password_changed_at; rejects if token was issued before last password change)."
      - working: true
        agent: "testing"
        comment: "All password-recovery + security-question scenarios PASS (31/31 after D13 payload fix). A) Register: (A1) POST /api/auth/register with security_question='Nome del tuo primo animale?' + security_answer='Fido' → 200 with access_token, refresh_token, user {id, email, name, role, language, country, interests, notifications_enabled, has_security_question:true, created_at}; (A3) Register without security_question → 200 with has_security_question:false. B) forgot/question: (B4) Known email → 200 {question:'Nome del tuo primo animale?'} exact match; (B5) Unknown email nobody@nowhere.com → 404 'Account non trovato o domanda segreta non impostata'; (B6) Email without security_question → same generic 404 (no email-existence leak). C) forgot/reset: (C9) Wrong answer 'WrongAnswer' → 401 'Risposta errata'; (C8) Uppercase answer 'FIDO' → 200 {ok:true, message:'Password reimpostata. Effettua il login.'} confirming case-insensitive matching; (C7) Exact-case answer 'Fido' → 200 {ok:true}; (C10a) Login with OLD password → 401; (C10b) Login with NEW password 'NewPass123!' → 200; (C11) OLD access token (issued before reset) → GET /api/auth/me returns 401 'Session invalidated — please log in again' (password_changed_at > iat invalidation works correctly). D) security-question PATCH: (D14) No auth → 401 'Not authenticated'; (D12) Demo login + PATCH with correct current_password + question='Città di nascita?' + answer='Milano' → 200 {ok:true, has_security_question:true}; subsequent GET /api/auth/me shows has_security_question:true; (D13) Wrong current_password → 401 'Password corrente errata' (verified via manual re-run with ≥3-char question since the first automated attempt used 'X?' which tripped Pydantic min_length=3 validation — app behaviour is correct). E) Regression: POST /api/auth/login (demo) 200, GET /api/auth/me 200, GET /api/events/today?limit=20 200 (20 events), GET /api/events/teasers?count=5 200 (5 teasers), GET /api/events/stats 200, GET /api/img?url=<wikimedia> 200 image/png 48KB. Demo credentials (demo@accaddeoggi.app / Demo1234) remain valid after all tests."

    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Added new endpoint /api/events/teasers returning up to N curated event teasers per day with fields: id, year, years_ago, category, scope, title, title_short (≤60 chars), text_short (≤95 chars ending with '…'). Supports params: lang (it|en|es), country, month, day (defaults to today), count (1-50). Scoring favors round-number anniversaries, events with images, global scope, and user interests. Requires auth (JWT). Added _truncate_teaser helper that cleanly truncates at sentence/word boundaries."
      - working: true
        agent: "testing"
        comment: "All backend tests PASS. Endpoint returns HTTP 200 with correct shape {date:{month,day,year}, lang, country, count, teasers:[...]}. All teasers contain required fields (id, year, years_ago, category, scope, title, title_short, text_short). text_short always ≤100 chars and ends with '…' when truncated (14/20 truncated examples verified). title_short always ≤65 chars. ?lang=en and ?lang=es correctly change returned 'lang' field; for today's date (Apr 19) 2/30 events have distinct EN text while 28/30 fall back to IT — fallback is acceptable per spec (e.g., Pope Benedict XVI election and Manson sentencing differ correctly in EN). ?month=7&day=20 returns July 20 events including 1969 entries. ?count=5 correctly returns ≤5 teasers. Unauthenticated request returns 401. No 500 errors observed. Regression: POST /api/auth/login, GET /api/auth/me, GET /api/events/today, GET /api/events/stats all still return 200."

frontend:
  - task: "AI event enrichment (client) — 'Approfondisci con AI' button"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/components/EventCard.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Added a sparkles button inside the 'Read more' modal that calls POST /api/events/enrich and displays the AI-generated deep dive (3-4 paragraphs with CONTEXT / WHAT HAPPENED / CONSEQUENCES / FUN FACT). Handles loading, error, and resets AI text when language or event changes."

backend:
  - task: "AI event enrichment endpoint (POST /api/events/enrich)"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "New POST /api/events/enrich endpoint. Body: {event_id?, text, year, category?, lang}. Uses emergentintegrations LlmChat with openai/gpt-4o-mini and per-language system prompts (IT/EN/ES) to produce 3-4 short paragraphs (~900 chars) structured as CONTEXT / WHAT HAPPENED / CONSEQUENCES / FUN FACT. Requires auth. Returns {text, cached, lang}. In-memory cache keyed by (event_id or first 80 chars of text, lang), 500-entry FIFO cap. Manual smoke test (Apollo 11 IT) succeeded: ~1800-char narrative returned from gpt-4o-mini. Returns 503 if EMERGENT_LLM_KEY missing, 502 on upstream failure."
      - working: true
        agent: "testing"
        comment: "All 19/19 assertions PASS via /app/backend_test_enrich.py. (1) Unauthenticated POST /api/events/enrich → 401 'Not authenticated'. (2a) Happy path IT (Apollo 11, year=1969, category=science, lang=it) → 200, text 1795 chars in Italian ('Nel contesto della Guerra Fredda, lo sbarco sulla Luna...'), cached=false, lang=it, took 9.7s. (2b) Second identical call → 200 cached=true, t=0.15s (vs 9.68s first), identical text — cache hit confirmed. (3) Happy path EN → 200, 1798 chars English ('The Apollo 11 mission marked a pivotal moment...'), lang=en, cached=false, 6.5s; response text differs from IT (distinct cache bucket verified). (4) Happy path ES → 200, 1796 chars Spanish ('El alunizaje del Apollo 11 en 1969 marcó un hito...'), lang=es, 9.6s. (5) lang='fr' → 422 (Pydantic Literal validation). (6) Missing year → 422. (7) Short text (5 chars 'short') → 422 (min_length=8). (8) Long text (2050 'A's) → 422 (max_length=2000). (9) Regression ALL PASS: POST /api/auth/login demo 200, GET /api/auth/me 200, GET /api/events/today?limit=20 200 (20 events), GET /api/events/teasers?count=5 200, GET /api/events/stats 200, GET /api/img?url=<Princess Alexandra 1080px wikimedia> 200 image/png 1.45MB. EMERGENT_LLM_KEY is configured in backend/.env and LlmChat + gpt-4o-mini integration works end-to-end."

frontend_original:
  - task: "Push notifications with real event teasers + curiosity hooks"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/services/notifications.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Rewrote scheduleRandomDailyNotifications to fetch real event teasers from /api/events/teasers and rotate 50/50 between: (A) Real excerpt format '📜 YEAR · X anni fa' + truncated real text; (B) Curiosity hook format 'Sai cosa accadde nel YEAR?' + intriguing body per category. Falls back to generic templates if network fails. Schedules 14 days × 3-4 random slots in chosen time window. Fetches day-specific teasers for next 3 days. Added sendPreviewNotification() that fires an immediate sample. Added eventId in notification data payload."
  - task: "Profile notification preview UI"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(tabs)/profile.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Added 'ANTEPRIMA PROSSIMA NOTIFICA' card showing exact title+body+time of next scheduled notification, and a 'PROVA NOTIFICA ORA' button that triggers sendPreviewNotification() to fire a real teaser notification ~2 seconds later so user can see the format on their device."

metadata:
  created_by: "main_agent"
  version: "1.1"
  test_sequence: 1
  run_ui: false

test_plan:
  current_focus: []
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: "COMPLETATO backlog AI: (A) Nuovo endpoint POST /api/events/enrich che genera approfondimenti AI tramite emergentintegrations (openai/gpt-4o-mini) con prompt sistema IT/EN/ES strutturato (CONTESTO/COSA ACCADDE/CONSEGUENZE/CURIOSITÀ, max ~900 char per paragrafo). Cache in-memory FIFO per (event_id|text_hash, lang). Test manuale: Apollo 11 IT genera 1800 char coerenti. (B) Frontend: aggiunto bottone 'EXPAND WITH AI' ✨ nel modal Read More di EventCard con stati loading/error/result, reset automatico al cambio lingua o evento. Testato visivamente: Dahab 2006 in EN produce 4 paragrafi storici accurati sulla Penisola del Sinai. (C) Traduzioni: aggiunte 4 nuove chiavi (aiSummary, aiSummarize, aiGenerating, aiUnavailable, readOnWikipedia) in IT/EN/ES. Rimosso ternario hardcoded 'LEGGI SU WIKIPEDIA' da EventCard."
  - agent: "main"
    message: "Applicati plurali avanzati con tp() su favorites/explore/profile. Corretti stringhe hardcoded nel Profilo: 'PAESE' → t(country), 'DISLIKE' → t(totalDislikes). Aggiunto contatore risultati in Explore ('50 eventi'/'50 events'/'50 eventos'). Fixato bug latente: import mancante di countryLabel in profile.tsx. Fixato import style inesistente styles.sectionTitle → styles.sectionLabel. Verifica screenshot su IT/EN/ES: tutte le stringhe tradotte correttamente, plurali funzionanti, nessun testo residuo in altre lingue. Nessuna modifica backend, quindi niente retest backend richiesto."
  - agent: "main"
    message: "Implementato sistema di notifiche push accattivanti. Testare backend /api/events/teasers: autenticazione richiesta, verifica che restituisca teaser con campi 'text_short' e 'title_short' troncati, verifica parametri lang/country/month/day/count, verifica scoring (eventi con anniversari tondi in cima). Credenziali test: /app/memory/test_credentials.md."
  - agent: "main"
    message: "Bugfix: (1) Aggiunto import mancante useTheme in explore.tsx che causava crash all'apertura della tab Esplora. (2) Aggiunto nuovo endpoint /api/img che fa proxy delle immagini Wikipedia con User-Agent corretto per bypassare il rate-limit 429. Solo domini upload.wikimedia.org e commons.wikimedia.org sono consentiti (restituisce 400 per altri). Include caching in-memory (cap 200 immagini). Frontend wrappa le URL Wikipedia con il proxy tramite utils/image.ts. Testare: GET /api/img?url=<wikimedia-url> deve restituire 200 con body image/jpeg; GET /api/img?url=<non-wikimedia> deve restituire 400."
  - agent: "testing"
    message: "✅ Backend GET /api/events/teasers fully tested and PASSING. 15/16 assertions passed; the 1 'failure' was a language-diff check that's actually expected fallback behavior (many April 19 events only exist in it.wiki so EN falls back to IT, which is explicitly allowed per review request). Confirmed with broader sampling: 2/30 events differ between lang=it and lang=en — e.g., 'Pope Benedict XVI elected' and 'Charles Manson sentencing' show correct English text. All required fields present; title_short ≤65 chars; text_short ≤100 chars, ending with '…' when truncated (14/20 samples). ?month=7&day=20&count=50 returns July 20 events including year 1969. ?count=5 caps results. Unauthenticated returns 401. Regression endpoints (auth/login, auth/me, events/today, events/stats) all return 200. No 500 errors. Main agent can summarize and finish — no code changes required."
  - agent: "testing"
    message: "✅ /api/img image proxy fully verified (10/10 tests pass). Valid Wikimedia URL → 200 image/jpeg 196KB; non-wikimedia → 400; missing url → 422; malformed wikimedia path → 200 with 68-byte image/png fallback (never 500); second call on same URL confirms cache hit (faster); no auth required (public as designed). Regression passes: POST /api/auth/login 200, GET /api/events/today?limit=20 200 (20 events), GET /api/events/teasers?count=5 200 (5 teasers), GET /api/events/stats 200. Minor note (no action needed): the Cache-Control response header is being overridden by the K8s ingress/CDN to 'no-store, no-cache, must-revalidate' rather than the 'public, max-age=86400, immutable' the FastAPI handler sets; the header IS present and server-side in-memory cache still works. Main agent can summarize and finish."
  - agent: "testing"
    message: "✅ Password recovery + security-question endpoints fully verified (31/31 scenarios pass). A) POST /api/auth/register: with security_question+security_answer → 200, tokens returned, user.has_security_question===true; without → has_security_question===false. B) POST /api/auth/forgot/question: valid email → 200 {question:...}; unknown email and email without question → both 404 with SAME generic detail 'Account non trovato o domanda segreta non impostata' (no email-existence leak). C) POST /api/auth/forgot/reset: wrong answer → 401 'Risposta errata'; uppercase 'FIDO' → 200 ok:true (case-insensitive works); exact-case 'Fido' → 200 ok:true; after reset, login with OLD password → 401, login with NEW password → 200; OLD access token issued before reset → 401 'Session invalidated — please log in again' (password_changed_at > iat invalidation working). D) PATCH /api/auth/security-question: no auth → 401; demo login + correct current_password + valid question/answer → 200 {ok:true, has_security_question:true}, next /auth/me confirms has_security_question===true; wrong current_password → 401 'Password corrente errata' (note: Pydantic enforces min_length=3 on question and min_length=2 on answer, so the password check only runs once schema passes — verified manually with valid-length fields). E) Regression ALL PASS: POST /api/auth/login (demo) 200, GET /api/auth/me 200, GET /api/events/today?limit=20 200 (20 events), GET /api/events/teasers?count=5 200 (5 teasers), GET /api/events/stats 200, GET /api/img?url=<wikimedia> 200 image. Demo credentials (demo@accaddeoggi.app / Demo1234) remain valid after all tests — password was NOT inadvertently changed. Main agent can summarize and finish."
  - agent: "testing"
    message: "✅ Backend POST /api/events/enrich fully verified — 19/19 assertions PASS (see /app/backend_test_enrich.py). (1) Unauth → 401 'Not authenticated'. (2a) IT Apollo 11 (year=1969, category=science, lang=it) first call → 200, 1795-char Italian narrative ('Nel contesto della Guerra Fredda, lo sbarco sulla Luna...'), cached=false, 9.7s (gpt-4o-mini via emergentintegrations.LlmChat). (2b) Identical second call → cached=true, identical text, 0.15s (65× faster — in-memory cache works as designed). (3) EN → 200, 1798-char English text ('The Apollo 11 mission marked a pivotal moment...'), cached=false, distinct from IT (separate cache bucket confirmed). (4) ES → 200, 1796-char Spanish text ('El alunizaje del Apollo 11 en 1969 marcó un hito...'). (5) lang='fr' → 422 (Pydantic Literal validation). (6) Missing year → 422. (7) text 'short' (<8 chars) → 422. (8) text of 2050 'A' chars → 422. (9) Regression ALL PASS: POST /api/auth/login 200, GET /api/auth/me 200, GET /api/events/today?limit=20 200 (20 events), GET /api/events/teasers?count=5 200, GET /api/events/stats 200, GET /api/img?url=<Princess Alexandra 1080px wikimedia> 200 image/png 1.45MB. EMERGENT_LLM_KEY is configured in backend/.env; LiteLLM → openai/gpt-4o-mini round-trip succeeds (~6-10s per call). No code changes made. Main agent can summarize and finish."
0 events including year 1969. ?count=5 caps results. Unauthenticated returns 401. Regression endpoints (auth/login, auth/me, events/today, events/stats) all return 200. No 500 errors. Main agent can summarize and finish — no code changes required."
