# Graph Report - accadde-oggi-main  (2026-08-02)

## Corpus Check
- 58 files · ~93,389 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 570 nodes · 879 edges · 40 communities (34 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `906cad28`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- profile.tsx
- dependencies
- notifications.ts
- expo
- Accedi con Google — cosa devi fare tu (10 minuti, una volta sola)
- server.py
- BaseModel
- TestAuth
- send_daily_push
- TestEvents
- package.json
- build_merged_events
- _daily_worker
- TestInteractions
- Accadde Oggi — Product Requirements Document
- Accadde Oggi — Scheda Google Play (ASO + Neuromarketing)
- forgot_reset
- Accadde Oggi — Handoff / Linea di lavoro
- events_enrich
- conftest.py
- reset-project.js
- backend_test_enrich.py
- tsconfig.json
- Welcome to your Expo app 👋
- gen_store_assets.py
- TestHealth
- metro.config.js
- curate_people
- backend_test.py
- router.d.ts
- gen_category_images.py
- privacy.tsx
- eslint.config.js
- expo-env.d.ts
- apply_app_icon.py
- setupAndroidChannel

## God Nodes (most connected - your core abstractions)
1. `useAuth()` - 19 edges
2. `expo` - 18 edges
3. `build_merged_events()` - 15 edges
4. `useTheme()` - 15 edges
5. `Profile()` - 13 edges
6. `Lang` - 12 edges
7. `send_daily_push()` - 11 edges
8. `TestAuth` - 11 edges
9. `T` - 11 edges
10. `scheduleRandomDailyNotifications()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `build_push_content()` --references--> `BRAND`  [EXTRACTED]
  backend/server.py → frontend/src/services/notifications.ts
- `build_push_content()` --references--> `CATEGORY_ICON`  [EXTRACTED]
  backend/server.py → frontend/src/services/notifications.ts
- `build_push_content()` --references--> `FALLBACK_NUDGE`  [EXTRACTED]
  backend/server.py → frontend/src/services/notifications.ts
- `build_push_content()` --references--> `OPENERS`  [EXTRACTED]
  backend/server.py → frontend/src/services/notifications.ts
- `spell_years()` --references--> `SPELLED_YEARS`  [EXTRACTED]
  backend/server.py → frontend/src/services/notifications.ts

## Import Cycles
- None detected.

## Communities (40 total, 6 thin omitted)

### Community 0 - "profile.tsx"
Cohesion: 0.05
Nodes (77): Forgot(), styles, Login(), styles, Register(), styles, Index(), styles (+69 more)

### Community 1 - "dependencies"
Cohesion: 0.05
Nodes (44): dependencies, axios, @babel/runtime, expo, expo-auth-session, expo-blur, expo-constants, expo-crypto (+36 more)

### Community 2 - "notifications.ts"
Cohesion: 0.09
Nodes (37): build_push_content(), Title + body for one push, built from a real event.      Shape: "📜 Accadde Ogg, spell_years(), AuthContext, AuthProvider(), AuthState, readNotifPrefs(), User (+29 more)

### Community 3 - "expo"
Cohesion: 0.05
Nodes (37): backgroundColor, foregroundImage, adaptiveIcon, edgeToEdgeEnabled, package, permissions, projectId, typedRoutes (+29 more)

### Community 4 - "Accedi con Google — cosa devi fare tu (10 minuti, una volta sola)"
Cohesion: 0.08
Nodes (23): A) Web, Accedi con Google — cosa devi fare tu (10 minuti, una volta sola), App (Render statico + build EAS), B) Android, Backend (Render), C) iOS, In parole semplici, Note (+15 more)

### Community 5 - "server.py"
Cohesion: 0.10
Nodes (15): auth_google_status(), _fetch_pageimage(), fetch_summary(), forgot_question(), ForgotQuestionBody, health(), push_register(), push_unregister() (+7 more)

### Community 6 - "BaseModel"
Cohesion: 0.13
Nodes (22): auth_google(), create_access_token(), create_refresh_token(), get_current_user(), GoogleAuthBody, interact(), InteractionBody, login() (+14 more)

### Community 7 - "TestAuth"
Cohesion: 0.10
Nodes (11): Test PATCH /auth/me updates language, country, notifications, Authentication endpoint tests, Test user registration with all fields including country, Test registration with existing email fails, Test login with correct credentials returns tokens and user, Test login with wrong password fails, Test login with non-existent email fails, Test GET /auth/me returns user data with valid Bearer token (+3 more)

### Community 8 - "send_daily_push"
Cohesion: 0.13
Nodes (20): events_teasers(), events_today(), _expo_send(), favorites(), get_merged_events(), load_user_interactions(), native_langs(), _pick_lang() (+12 more)

### Community 9 - "TestEvents"
Cohesion: 0.11
Nodes (10): Event endpoints tests - fetching, filtering, multi-language, Test filtering for global events only, Test filtering for local events only, Test GET /events/categories returns category list, Test GET /events/today returns events with required fields, Test Italian user gets IT-relevant events, Test Spanish user gets ES-relevant events (different from IT), Test filtering events by category (+2 more)

### Community 10 - "package.json"
Cohesion: 0.11
Nodes (18): devDependencies, @babel/core, eslint, eslint-config-expo, @types/react, typescript, main, name (+10 more)

### Community 11 - "build_merged_events"
Cohesion: 0.11
Nodes (18): build_merged_events(), categorize(), detect_country_relevance(), detect_subcategory(), _extract_image(), fetch_wiki(), _norm_page_title(), _page_extract() (+10 more)

### Community 12 - "_daily_worker"
Cohesion: 0.13
Nodes (16): cron_daily(), cron_push(), _daily_worker(), _keepalive_ping(), purge_stale_cache(), Rebuild the cache for today and the next couple of days.      Notifications ar, Drop cache documents from previous formats and days nobody has opened., Ping our own public URL so the free instance never falls asleep.      A sleepi (+8 more)

### Community 13 - "TestInteractions"
Cohesion: 0.12
Nodes (8): Test saving an event to favorites, Event interaction tests - like, dislike, save, unsave, Test unsaving an event from favorites, Test GET /events/favorites returns saved events, Test GET /events/stats returns user interaction statistics, Test that like and dislike are mutually exclusive, Test clicking like twice removes the like (toggle behavior), TestInteractions

### Community 14 - "Accadde Oggi — Product Requirements Document"
Cohesion: 0.13
Nodes (14): Accadde Oggi — Product Requirements Document, Authentication (JWT, mobile Bearer tokens), Backend API (all under `/api`), Business enhancement baked in, Caching, Core Features, Country-aware multilingual feed, Filters (+6 more)

### Community 15 - "Accadde Oggi — Scheda Google Play (ASO + Neuromarketing)"
Cohesion: 0.15
Nodes (12): Accadde Oggi — Scheda Google Play (ASO + Neuromarketing), 🎨 ASSET GRAFICI (direzione di design), ✅ Checklist Play Console (per il rilascio interno), Descripción breve (≤80), Descripción completa (resumen), Descrizione breve (≤80 caratteri), Descrizione completa (≤4000 caratteri), 🇪🇸 ESPAÑOL (variante) (+4 more)

### Community 16 - "forgot_reset"
Cohesion: 0.22
Nodes (11): forgot_reset(), ForgotResetBody, hash_password(), hash_password_async(), Step 2 of password recovery — verify answer and reset password., Set or change security question (requires current password)., SecurityQuestionBody, startup() (+3 more)

### Community 17 - "Accadde Oggi — Handoff / Linea di lavoro"
Cohesion: 0.18
Nodes (10): Accadde Oggi — Handoff / Linea di lavoro, Aggiornamento 02/08/2026 — branch `feat/contenuti-notifiche-google`, Come pilotare il Play Console, Cos'è, Da fare, Dove siamo (Play Console, dev account 5841476158353169844), Già fatto e ONLINE, Note (+2 more)

### Community 18 - "events_enrich"
Cohesion: 0.22
Nodes (9): AiEnrichBody, events_enrich(), _fetch_wiki_extract(), _llm_enrich(), _parse_wiki_url(), Extract (lang, title) from a Wikipedia page URL like     https://it.wikipedia.o, Fetch the real plain-text intro (lead section) of a Wikipedia article. Free, fac, Optional: write a narrative deep dive via Groq (OpenAI-compatible, free tier). (+1 more)

### Community 19 - "conftest.py"
Cohesion: 0.22
Nodes (8): admin_token(), api_client(), auth_headers(), demo_token(), Shared requests session, Get admin access token, Get demo user access token, Authorization headers with Bearer token

### Community 20 - "reset-project.js"
Cohesion: 0.22
Nodes (7): exampleDirPath, fs, oldDirs, path, readline, rl, root

### Community 21 - "backend_test_enrich.py"
Cohesion: 0.43
Nodes (5): Backend tests for POST /api/events/enrich (event deep-dive).  The endpoint retur, record(), test_1_unauth(), test_2_wikipedia_it(), test_3_no_wiki_url()

### Community 22 - "tsconfig.json"
Cohesion: 0.29
Nodes (6): compilerOptions, paths, strict, extends, include, @/*

### Community 23 - "Welcome to your Expo app 👋"
Cohesion: 0.33
Nodes (5): Get a fresh project, Get started, Join the community, Learn more, Welcome to your Expo app 👋

### Community 24 - "gen_store_assets.py"
Cohesion: 0.40
Nodes (3): draw_ao(), font(), Generate Play Store marketing assets (feature graphic + icon) in the brand style

### Community 25 - "TestHealth"
Cohesion: 0.40
Nodes (3): Health check and basic connectivity tests, Test API root endpoint returns status ok, TestHealth

### Community 26 - "metro.config.js"
Cohesion: 0.40
Nodes (4): config, { FileStore }, { getDefaultConfig }, path

### Community 27 - "curate_people"
Cohesion: 0.50
Nodes (4): curate_people(), fetch_fame_and_italian(), For each Wikidata item: how many Wikipedia editions carry it, and the     Itali, Keep the people worth a card, and give them Italian words.      Two problems s

### Community 29 - "router.d.ts"
Cohesion: 0.50
Nodes (3): expo-router, ExpoRouter, __routes

### Community 30 - "gen_category_images.py"
Cohesion: 0.67
Nodes (3): gen(), _png(), Generate dark cinematic category background images (no external deps).  These re

## Knowledge Gaps
- **197 isolated node(s):** `expo-router`, `ExpoRouter`, `__routes`, `name`, `slug` (+192 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `build_push_content()` connect `notifications.ts` to `send_daily_push`, `server.py`?**
  _High betweenness centrality (0.128) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.111) - this node is a cross-community bridge._
- **Why does `EventCard()` connect `profile.tsx` to `dependencies`?**
  _High betweenness centrality (0.103) - this node is a cross-community bridge._
- **What connects `Public health check (no auth) — used by the host's health probe.`, `Return country codes that match keywords in the text.`, `Fetch every section of the "on this day" feed for one Wikipedia edition.` to the rest of the system?**
  _275 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `profile.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05265123226288275 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.045454545454545456 - nodes in this community are weakly interconnected._
- **Should `notifications.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09041835357624832 - nodes in this community are weakly interconnected._