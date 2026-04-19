# Accadde Oggi — Product Requirements Document

## Overview
"Accadde Oggi" (On This Day / Un Día Como Hoy) is a React Native Expo mobile app that delivers a daily feed of historical events that happened today in past years, personalized by the user's country and taste.

## Tech Stack
- **Frontend**: Expo SDK 54, Expo Router, React Native, TypeScript, lucide-react-native, expo-linear-gradient, axios, AsyncStorage
- **Backend**: FastAPI + Motor (MongoDB) + httpx for Wikipedia API + bcrypt + PyJWT
- **Data source**: Wikipedia REST "On This Day" API (IT/EN/ES editions, fetched in parallel and merged)

## Core Features
### Authentication (JWT, mobile Bearer tokens)
- Register with email + password + name + language + country
- Login, refresh, logout, update profile preferences
- Seeded accounts: `admin@accaddeoggi.app / Admin1234` and `demo@accaddeoggi.app / Demo1234`

### Country-aware multilingual feed
- Fetches events from IT/EN/ES Wikipedia in parallel
- Merges by year + Wikibase item ID
- Events tagged `GLOBAL` (present in 2+ editions — e.g. Moon Landing, Fall of Berlin Wall) or `LOCAL` (single-edition — e.g. Vasco Rossi birthday)
- LOCAL events only shown if they match the user's country (detected via keyword scanning)
- This means a Spanish user doesn't see "Vasco Rossi born today", an Italian user doesn't see local Argentine singer news

### Personalization
- Like / Dislike buttons per event
- Liked categories get a scoring boost (+likes_count * 1.5)
- Disliked events permanently filtered
- Save to favorites with dedicated tab
- Stats: total likes, dislikes, saves, top categories

### Filters
- Category: wars / science / culture / sports / politics
- Decade: 1900s → 2020s
- Scope: all / global / local-to-my-country

### UI (Cinematic dark-aggressive)
- Full-screen paging FlatList (TikTok-style vertical swipe)
- Heavy gradient overlay with large "YEARS AGO" numerals, bold year, editorial title
- Category-tinted accents (red=war, blue=science, orange=sport, etc.)
- Country flag badge in header showing current user scope
- Share to any social via React Native Share

## Backend API (all under `/api`)
- `POST /auth/register|login|refresh|logout`, `GET|PATCH /auth/me`
- `GET /events/today?lang=&country=&category=&decade=&scope=&limit=`
- `GET /events/teasers?lang=&country=&month=&day=&count=` — curated short teasers (title_short ≤60c, text_short ≤95c with "…") for push notification hooks
- `GET /events/favorites`, `GET /events/stats`, `GET /events/categories`
- `POST /events/interact` with `{event_id, action: like|dislike|save|unsave}` (idempotent toggles)

## Caching
- Wikipedia results cached per `(month, day)` combo, refreshed daily
- MongoDB collections: `users`, `interactions`, `events_cache`

## Languages
- IT (default), EN, ES — switchable in Profile; same events re-rendered with titles/text in chosen language

## Business enhancement baked in
- Country + likes = compound personalization signal that improves engagement daily and creates data about user interests (huge for future monetization via targeted educational content or sponsored historical reenactments)


## Push notifications with real event hooks (v1.1)
- Uses `expo-notifications` with local scheduling, 14 days × 3-4 random slots per day
- Fetches real event teasers from backend `/api/events/teasers`
- Each notification rotates 50/50 between:
  1. **Real excerpt format** — Title: "📜 YEAR · X anni fa"; Body: truncated real event text ending with "…"
  2. **Curiosity hook format** — Title: "Sai cosa accadde nel YEAR?"; Body: intriguing question per category
- Users can preview the next scheduled notification (title+body+time) in the Profile screen
- "PROVA NOTIFICA ORA" button fires a sample teaser notification immediately
