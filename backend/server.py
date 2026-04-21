from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

import bcrypt
import jwt
import httpx
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Query
from fastapi.responses import Response, StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from bson import ObjectId

# ============================================================
# CONFIG
# ============================================================
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = 60 * 24
REFRESH_TOKEN_DAYS = 30

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Accadde Oggi API")
api = APIRouter(prefix="/api")
bearer_scheme = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("accadde-oggi")

# ============================================================
# AUTH HELPERS
# ============================================================
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "type": "access",
               "iat": datetime.now(timezone.utc),
               "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_MINUTES)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "type": "refresh",
               "iat": datetime.now(timezone.utc),
               "exp": datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_DAYS)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def user_public(user: dict) -> dict:
    return {
        "id": str(user["_id"]),
        "email": user["email"],
        "name": user.get("name", ""),
        "role": user.get("role", "user"),
        "language": user.get("language", "it"),
        "country": user.get("country", "IT"),
        "interests": user.get("interests", []),
        "notifications_enabled": user.get("notifications_enabled", True),
        "has_security_question": bool(user.get("security_question")),
        "created_at": user.get("created_at").isoformat() if user.get("created_at") else None,
    }


async def get_current_user(
    request: Request,
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> dict:
    token = creds.credentials if (creds and creds.credentials) else request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        # Session invalidation: if password changed after token was issued, reject
        iat = payload.get("iat")
        pwd_changed = user.get("password_changed_at")
        if iat and pwd_changed:
            # iat is a unix timestamp in seconds (int from jwt), pwd_changed is datetime
            iat_ts = iat if isinstance(iat, (int, float)) else int(iat.timestamp())
            if pwd_changed.replace(tzinfo=timezone.utc).timestamp() > iat_ts + 1:
                raise HTTPException(status_code=401, detail="Session invalidated — please log in again")
        return user_public(user)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ============================================================
# MODELS
# ============================================================
class RegisterBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: Optional[str] = ""
    language: Optional[Literal["it", "en", "es"]] = "it"
    country: Optional[str] = "IT"
    security_question: Optional[str] = Field(default=None, max_length=200)
    security_answer: Optional[str] = Field(default=None, min_length=2, max_length=100)


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class RefreshBody(BaseModel):
    refresh_token: str


class ForgotQuestionBody(BaseModel):
    email: EmailStr


class ForgotResetBody(BaseModel):
    email: EmailStr
    answer: str = Field(min_length=1, max_length=200)
    new_password: str = Field(min_length=6)


class SecurityQuestionBody(BaseModel):
    current_password: str
    question: str = Field(min_length=3, max_length=200)
    answer: str = Field(min_length=2, max_length=100)


class InteractionBody(BaseModel):
    event_id: str
    action: Literal["like", "dislike", "save", "unsave"]


class UpdatePrefsBody(BaseModel):
    language: Optional[Literal["it", "en", "es"]] = None
    country: Optional[str] = None
    notifications_enabled: Optional[bool] = None
    name: Optional[str] = None
    interests: Optional[List[str]] = None  # e.g. ["science.space", "culture.cinema"]


# ============================================================
# CATEGORIZATION + COUNTRY KEYWORDS
# ============================================================
CATEGORY_KEYWORDS = {
    "wars": ["war", "battle", "invasion", "siege", "army", "military", "troops", "soldiers", "bomb",
             "guerra", "battaglia", "invasione", "assedio", "esercito", "militare", "bomba",
             "batalla", "ejército", "militar", "soldados"],
    "science": ["scien", "discover", "invent", "physi", "chemi", "biolog", "astro", "space",
                "nasa", "launch", "rocket", "satellite", "medicine", "vaccin", "research",
                "scopert", "inventa", "medicin", "ricerca", "tecnolog",
                "descubrimiento", "invento", "tecnologia", "investigación"],
    "sports": ["sport", "football", "soccer", "olympic", "champion", "medal", "match", "tournament",
               "calcio", "olimpi", "campion", "medaglia", "partita", "torneo",
               "fútbol", "olímpic", "campeón"],
    "politics": ["president", "elect", "parliament", "minister", "government", "treaty", "law",
                 "constitution", "vote", "signed", "pope",
                 "elezion", "parlamento", "ministro", "governo", "trattato", "papa",
                 "presidente", "elecciones", "gobierno", "tratado"],
    "culture": ["film", "movie", "music", "album", "concert", "artist", "painting", "novel",
                "author", "writer", "premier", "opera", "theatre", "theater",
                "musica", "concerto", "artista", "scrittore", "teatro", "premiere",
                "película", "música", "escritor"],
}

# Subcategory keyword detection. Event gets one subcategory per category if matched.
SUBCATEGORY_KEYWORDS = {
    "wars": {
        "world_wars": ["world war", "ww1", "ww2", "wwii", "wwi", "prima guerra mondiale",
                       "seconda guerra mondiale", "primera guerra mundial", "segunda guerra mundial"],
        "ancient_battles": ["roman", "medieval", "crusade", "byzantine", "persian", "greek",
                            "romano", "medievale", "crociat", "bizantin",
                            "romano", "medieval", "cruzada"],
        "cold_war": ["cold war", "soviet", "ussr", "nato", "guerra fredda", "sovietic",
                     "guerra fría", "soviético"],
        "revolutions": ["revolution", "uprising", "rivoluzion", "rivolta", "revolución", "rebelión"],
        "civil_wars": ["civil war", "guerra civile", "guerra civil"],
    },
    "science": {
        "space": ["space", "moon", "mars", "nasa", "rocket", "satellite", "spacecraft", "astronaut",
                  "apollo", "soyuz", "iss",
                  "spazio", "luna", "marte", "astronaut", "razzo",
                  "espacio", "luna", "cohete", "astronauta"],
        "medicine": ["medicine", "vaccin", "surgery", "doctor", "disease", "antibiotic",
                     "medicin", "chirurg", "vaccin", "malatt",
                     "medicina", "vacuna", "cirugía", "enfermedad"],
        "physics": ["physi", "atom", "quantum", "einstein", "relativity", "nuclear",
                    "fisic", "quantistic", "relativit", "nuclear",
                    "física", "cuántic", "relatividad"],
        "biology": ["dna", "biolog", "genetic", "evolution", "species",
                    "genetic", "evoluzion", "specie",
                    "genétic", "evolución", "especie"],
        "technology": ["computer", "internet", "software", "microchip", "apple", "microsoft",
                       "google", "ibm", "tesla", "ai", "algorithm",
                       "computadora", "algoritmo"],
    },
    "culture": {
        "cinema": ["film", "movie", "director", "cinema", "oscar", "hollywood", "premier",
                   "regista", "pellicola",
                   "película", "director", "cine"],
        "music": ["music", "album", "concert", "singer", "band", "symphony", "opera",
                  "musica", "cantante", "concerto", "sinfonia",
                  "música", "cantante", "concierto", "sinfonía"],
        "literature": ["book", "novel", "poem", "author", "writer", "publish",
                       "libro", "romanzo", "poesia", "scrittore", "poeta", "pubblica",
                       "libro", "novela", "poema", "escritor", "publicó"],
        "art": ["paint", "sculpture", "artist", "exhibition", "gallery", "museum",
                "pittur", "scultura", "artista", "mostra", "gallerie", "museo",
                "pintura", "escultura", "artista", "exposición", "galería", "museo"],
        "fashion": ["fashion", "design", "couture", "moda", "stilista", "diseñador"],
    },
    "sports": {
        "football": ["football", "soccer", "fifa", "world cup", "premier league",
                     "calcio", "coppa del mondo", "mondiali",
                     "fútbol", "copa mundial"],
        "olympics": ["olympic", "olympics", "olimpi", "olímpic"],
        "motorsport": ["formula", "f1", "ferrari", "mclaren", "racing", "grand prix",
                       "automobilismo", "gran premio"],
        "tennis": ["tennis", "wimbledon", "roland garros", "grand slam"],
        "cycling": ["cycling", "tour de france", "giro d'italia", "vuelta",
                    "ciclismo", "ciclista"],
        "boxing": ["boxing", "heavyweight", "knockout", "pugilato", "boxeo"],
    },
    "politics": {
        "elections": ["elect", "ballot", "campaign", "vote", "elezion", "campagna elettorale",
                      "elecciones", "campaña"],
        "treaties": ["treaty", "pact", "agreement", "accord", "trattato", "patto", "accordo",
                     "tratado", "pacto", "acuerdo"],
        "monarchies": ["king", "queen", "emperor", "empress", "royal", "monarch", "prince",
                       "re ", "regina", "imperatore", "monarchia", "principe",
                       "rey", "reina", "emperador", "monarquía", "príncipe"],
        "papacy": ["pope", "vatican", "papa", "vaticano", "conclav", "papado"],
        "assassinations": ["assassin", "murder", "killed", "shot", "died",
                           "assassin", "ucciso", "morte",
                           "asesinat", "muerto", "asesinad"],
    },
}

COUNTRY_KEYWORDS = {
    "IT": ["italia", "italian", "italy", "roma", "rome", "milan", "napoli", "naples", "florence", "firenze",
           "venezia", "venice", "torino", "turin", "sicilia", "sicily", "genova", "bologna", "palermo",
           "pope", "papa", "vatican", "vaticano"],
    "ES": ["españa", "spain", "spanish", "madrid", "barcelona", "sevilla", "seville", "valencia",
           "spagna", "spagnol", "catalán", "catalan"],
    "US": ["united states", "america", "american", "washington", "new york", "california", "texas",
           "nyc", "boston", "chicago", "florida", "estados unidos", "stati uniti", "statunitens"],
    "GB": ["united kingdom", "britain", "british", "england", "english", "london", "scotland",
           "wales", "regno unito", "inglese", "inglaterra", "reino unido"],
    "FR": ["france", "french", "paris", "francia", "francese", "frances", "francia", "lyon", "marseille"],
    "DE": ["germany", "german", "berlin", "munich", "hamburg", "germania", "tedesch", "alemania", "alemán"],
    "MX": ["mexico", "mexican", "mexico city", "messico", "messican", "méxico", "mexicano"],
    "AR": ["argentina", "argentinian", "buenos aires", "argentin"],
    "BR": ["brazil", "brasil", "rio de janeiro", "são paulo", "brasile", "brasiliano", "brasileño"],
    "PT": ["portugal", "portuguese", "lisbon", "portogallo", "portoghese", "portugués"],
    "CH": ["switzerland", "swiss", "zurich", "geneva", "svizzera", "suiza", "suizo"],
    "CA": ["canada", "canadian", "toronto", "montreal", "ottawa", "vancouver", "canadese", "canadiense"],
    "AU": ["australia", "australian", "sydney", "melbourne"],
    "JP": ["japan", "japanese", "tokyo", "giappone", "giappones", "japón", "japonés"],
    "CN": ["china", "chinese", "beijing", "shanghai", "cina", "cinese", "chino"],
    "RU": ["russia", "russian", "moscow", "soviet", "ussr", "russo"],
    "IN": ["india", "indian", "delhi", "mumbai", "bombay"],
    "CO": ["colombia", "colombian", "bogota", "bogotá", "medellin"],
    "CL": ["chile", "chilean", "santiago", "cileno", "chileno"],
    "PE": ["peru", "perù", "peruvian", "lima", "peruviano", "peruano"],
}


def categorize(text: str) -> str:
    t = (text or "").lower()
    scores = {cat: 0 for cat in CATEGORY_KEYWORDS}
    for cat, words in CATEGORY_KEYWORDS.items():
        for w in words:
            if w in t:
                scores[cat] += 1
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else "culture"


def detect_subcategory(text: str, category: str) -> Optional[str]:
    t = (text or "").lower()
    subcats = SUBCATEGORY_KEYWORDS.get(category, {})
    best_sub = None
    best_score = 0
    for sub, words in subcats.items():
        score = sum(1 for w in words if w in t)
        if score > best_score:
            best_score = score
            best_sub = sub
    return best_sub


def detect_country_relevance(text: str) -> List[str]:
    """Return country codes that match keywords in the text."""
    t = (text or "").lower()
    hits = []
    for code, words in COUNTRY_KEYWORDS.items():
        for w in words:
            if w in t:
                hits.append(code)
                break
    return hits


# ============================================================
# WIKIPEDIA FETCH + MULTI-SOURCE MERGE
# ============================================================
WIKI_LANGS = ["it", "en", "es"]  # all editions we pull from


async def fetch_wiki(lang: str, month: int, day: int) -> List[dict]:
    url = f"https://api.wikimedia.org/feed/v1/wikipedia/{lang}/onthisday/events/{month:02d}/{day:02d}"
    ua = "AccaddeOggi/1.0 (https://accaddeoggi.app; contact@accaddeoggi.app)"
    try:
        async with httpx.AsyncClient(timeout=20.0) as hc:
            r = await hc.get(url, headers={"User-Agent": ua, "Api-User-Agent": ua, "Accept": "application/json"})
            if r.status_code != 200:
                logger.warning(f"Wiki {lang} {r.status_code}")
                return []
            return r.json().get("events", [])
    except Exception as e:
        logger.error(f"Wiki fetch error ({lang}): {e}")
        return []


def _norm_page_title(raw: dict) -> str:
    pages = raw.get("pages") or []
    if not pages:
        return ""
    return (pages[0].get("wikibase_item") or pages[0].get("normalizedtitle") or pages[0].get("title") or "").lower()


def _wikibase_id(raw: dict) -> Optional[str]:
    """Wikibase item (like Q123) is the strongest cross-language event identifier."""
    pages = raw.get("pages") or []
    for p in pages:
        if p.get("wikibase_item"):
            return p.get("wikibase_item")
    return None


def _extract_image(raw: dict) -> Optional[str]:
    """Extract best image URL and upgrade thumbnail size for full-screen display."""
    url = None
    for p in (raw.get("pages") or []):
        if p.get("thumbnail", {}).get("source"):
            url = p["thumbnail"]["source"]
            break
        if p.get("originalimage", {}).get("source"):
            url = p["originalimage"]["source"]
            break
    if not url:
        return None
    # Wikipedia thumbnails use /thumb/..../NNNpx-filename. Upgrade to 1080px for HD cards.
    # Example: /thumb/7/7e/Pope.jpg/330px-Pope.jpg -> /thumb/7/7e/Pope.jpg/1080px-Pope.jpg
    import re
    url = re.sub(r"/\d{2,4}px-", "/1080px-", url)
    return url


def _wiki_url(raw: dict) -> Optional[str]:
    pages = raw.get("pages") or []
    if not pages:
        return None
    return (pages[0].get("content_urls", {}) or {}).get("desktop", {}).get("page")


async def get_merged_events(month: int, day: int, primary_lang: str) -> List[dict]:
    """
    Fetch events from all Wikipedia editions we support (IT/EN/ES) in parallel.
    Merge events by (year + wikibase_item) so that an event appearing in
    multiple languages is tagged `global` (+1 per extra edition).
    Return events tagged with: scope, sources, countries.
    Text/title prefers the user's primary language, falling back to EN then ES.
    """
    cache_key = f"merged-{month:02d}-{day:02d}"
    cached = await db.events_cache.find_one({"_id": cache_key})
    today = datetime.now(timezone.utc).date()
    if cached and cached.get("cached_at") and cached["cached_at"].date() == today:
        return cached["events"]

    results = await asyncio.gather(*[fetch_wiki(lg, month, day) for lg in WIKI_LANGS])
    by_lang = dict(zip(WIKI_LANGS, results))

    # Bucket: key = (year, wikibase_id or normalized title)
    merged: dict = {}
    for lang, events in by_lang.items():
        for ev in events:
            year = ev.get("year")
            text = ev.get("text", "")
            if not year or not text:
                continue
            wb = _wikibase_id(ev)
            key = (int(year), wb) if wb else (int(year), _norm_page_title(ev) or text[:40].lower())
            bucket = merged.get(key)
            if not bucket:
                merged[key] = {
                    "year": int(year),
                    "per_lang": {lang: ev},
                    "image_url": _extract_image(ev),
                    "wiki_urls": {lang: _wiki_url(ev)},
                }
            else:
                bucket["per_lang"][lang] = ev
                if not bucket["image_url"]:
                    bucket["image_url"] = _extract_image(ev)
                bucket["wiki_urls"][lang] = _wiki_url(ev)

    current_year = datetime.now(timezone.utc).year
    final: List[dict] = []

    for key, b in merged.items():
        per_lang = b["per_lang"]
        sources = list(per_lang.keys())
        # Scope: global if present in 2+ editions, otherwise local
        scope = "global" if len(sources) >= 2 else "local"

        # Pick best text for each user language: fallback chain
        text_by_lang = {}
        title_by_lang = {}
        for ul in ("it", "en", "es"):
            chosen = per_lang.get(ul) or per_lang.get("en") or per_lang.get("it") or per_lang.get("es")
            if chosen:
                pages = chosen.get("pages") or []
                page_title = (pages[0].get("normalizedtitle") or pages[0].get("title")) if pages else None
                text_by_lang[ul] = chosen.get("text", "")
                title_by_lang[ul] = page_title or chosen.get("text", "").split(".")[0][:80]

        # Country relevance detected from any language text
        all_text = " ".join(text_by_lang.values()) + " " + " ".join([str(t) for t in title_by_lang.values()])
        countries = detect_country_relevance(all_text)

        # The origin: if scope is local and only one edition has it, origin is that edition's country
        origin = None
        if scope == "local":
            lang_only = sources[0]
            origin_map = {"it": "IT", "es": "ES", "en": None}  # EN is global-ish
            origin = origin_map.get(lang_only)
        if not origin and countries:
            origin = countries[0]

        category = categorize(all_text)
        stable_id = f"evt-{key[0]}-{abs(hash(str(key))) % 10000000}"
        years_ago = current_year - int(key[0])

        final.append({
            "id": stable_id,
            "year": int(key[0]),
            "years_ago": years_ago,
            "text_by_lang": text_by_lang,
            "title_by_lang": title_by_lang,
            "image_url": b["image_url"],
            "wiki_urls": b["wiki_urls"],
            "category": category,
            "scope": scope,          # 'global' | 'local'
            "sources": sources,      # wiki editions
            "countries": countries,  # countries mentioned in text
            "origin": origin,        # primary country affiliation
            "month": month,
            "day": day,
        })

    # Cache
    await db.events_cache.update_one(
        {"_id": cache_key},
        {"$set": {"events": final, "cached_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    return final


def project_event_for_lang(ev: dict, lang: str) -> dict:
    """Return an event serialized for a specific language."""
    text_by_lang = ev.get("text_by_lang", {})
    title_by_lang = ev.get("title_by_lang", {})
    text = text_by_lang.get(lang) or text_by_lang.get("en") or text_by_lang.get("it") or ""
    title = title_by_lang.get(lang) or title_by_lang.get("en") or title_by_lang.get("it") or text[:60]
    wiki_urls = ev.get("wiki_urls", {})
    wiki_url = wiki_urls.get(lang) or wiki_urls.get("en") or wiki_urls.get("it")
    return {
        "id": ev["id"],
        "year": ev["year"],
        "years_ago": ev["years_ago"],
        "title": title,
        "text": text,
        "image_url": ev.get("image_url"),
        "category": ev["category"],
        "subcategory": ev.get("subcategory"),
        "scope": ev["scope"],
        "sources": ev["sources"],
        "countries": ev.get("countries", []),
        "origin": ev.get("origin"),
        "wiki_url": wiki_url,
        "month": ev["month"],
        "day": ev["day"],
    }


# ============================================================
# AUTH ENDPOINTS
# ============================================================
@api.post("/auth/register")
async def register(body: RegisterBody):
    email = body.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    doc = {
        "email": email,
        "password_hash": hash_password(body.password),
        "password_changed_at": datetime.now(timezone.utc),
        "name": (body.name or email.split("@")[0]).strip(),
        "role": "user",
        "language": body.language or "it",
        "country": (body.country or "IT").upper(),
        "notifications_enabled": True,
        "created_at": datetime.now(timezone.utc),
    }
    if body.security_question and body.security_answer:
        doc["security_question"] = body.security_question.strip()
        doc["security_answer_hash"] = hash_password(body.security_answer.strip().lower())
    res = await db.users.insert_one(doc)
    uid = str(res.inserted_id)
    return {
        "access_token": create_access_token(uid, email),
        "refresh_token": create_refresh_token(uid),
        "user": user_public({"_id": res.inserted_id, **doc}),
    }


@api.post("/auth/login")
async def login(body: LoginBody):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    uid = str(user["_id"])
    return {
        "access_token": create_access_token(uid, email),
        "refresh_token": create_refresh_token(uid),
        "user": user_public(user),
    }


@api.post("/auth/refresh")
async def refresh_token(body: RefreshBody):
    try:
        payload = jwt.decode(body.refresh_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return {"access_token": create_access_token(str(user["_id"]), user["email"])}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")


@api.get("/auth/me")
async def me(current=Depends(get_current_user)):
    return current


@api.post("/auth/logout")
async def logout(current=Depends(get_current_user)):
    return {"ok": True}


# ============================================================
# PASSWORD RECOVERY VIA SECURITY QUESTION
# ============================================================
# Generic "not found" message to avoid leaking email existence.
_FORGOT_GENERIC_ERR = "Account non trovato o domanda segreta non impostata"


@api.post("/auth/forgot/question")
async def forgot_question(body: ForgotQuestionBody):
    """Step 1 of password recovery — return user's security question."""
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not user.get("security_question"):
        # Don't leak whether email exists OR whether question is set
        raise HTTPException(status_code=404, detail=_FORGOT_GENERIC_ERR)
    return {"question": user["security_question"]}


@api.post("/auth/forgot/reset")
async def forgot_reset(body: ForgotResetBody):
    """Step 2 of password recovery — verify answer and reset password."""
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not user.get("security_answer_hash"):
        raise HTTPException(status_code=404, detail=_FORGOT_GENERIC_ERR)
    answer = body.answer.strip().lower()
    if not bcrypt.checkpw(answer.encode("utf-8"), user["security_answer_hash"].encode("utf-8")):
        raise HTTPException(status_code=401, detail="Risposta errata")

    now = datetime.now(timezone.utc)
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "password_hash": hash_password(body.new_password),
            "password_changed_at": now,
        }},
    )
    return {"ok": True, "message": "Password reimpostata. Effettua il login."}


@api.patch("/auth/security-question")
async def update_security_question(
    body: SecurityQuestionBody,
    current=Depends(get_current_user),
):
    """Set or change security question (requires current password)."""
    user = await db.users.find_one({"_id": ObjectId(current["id"])})
    if not user or not verify_password(body.current_password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Password corrente errata")
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "security_question": body.question.strip(),
            "security_answer_hash": hash_password(body.answer.strip().lower()),
        }},
    )
    return {"ok": True, "has_security_question": True}


@api.patch("/auth/me")
async def update_me(body: UpdatePrefsBody, current=Depends(get_current_user)):
    updates = {k: (v.upper() if k == "country" and isinstance(v, str) else v)
               for k, v in body.dict().items() if v is not None}
    if updates:
        await db.users.update_one({"_id": ObjectId(current["id"])}, {"$set": updates})
    user = await db.users.find_one({"_id": ObjectId(current["id"])})
    return user_public(user)


# ============================================================
# EVENT ENDPOINTS
# ============================================================
async def load_user_interactions(user_id: str, event_ids: List[str]) -> dict:
    interactions = await db.interactions.find(
        {"user_id": user_id, "event_id": {"$in": event_ids}}
    ).to_list(length=10000)
    result: dict = {}
    for it in interactions:
        result.setdefault(it["event_id"], set()).add(it["type"])
    return result


@api.get("/events/today")
async def events_today(
    lang: Optional[Literal["it", "en", "es"]] = Query(None),
    country: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    decade: Optional[int] = Query(None),
    scope: Optional[Literal["global", "local", "all"]] = Query("all"),
    limit: int = Query(40, ge=1, le=100),
    current=Depends(get_current_user),
):
    user_lang = lang or current.get("language") or "it"
    user_country = (country or current.get("country") or "IT").upper()
    user_interests = set(current.get("interests", []) or [])

    now = datetime.now(timezone.utc)
    all_events = await get_merged_events(now.month, now.day, user_lang)

    # Personalization signals
    likes_agg = await db.interactions.aggregate([
        {"$match": {"user_id": current["id"], "type": "like"}},
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
    ]).to_list(length=100)
    liked_categories = {r["_id"]: r["count"] for r in likes_agg if r["_id"]}

    disliked_list = await db.interactions.find(
        {"user_id": current["id"], "type": "dislike"}
    ).to_list(length=10000)
    disliked_ids = {d["event_id"] for d in disliked_list}

    # Filters
    pool = all_events
    if category:
        pool = [e for e in pool if e["category"] == category]
    if decade is not None:
        pool = [e for e in pool if (e["year"] // 10) * 10 == decade]
    if scope and scope != "all":
        if scope == "global":
            pool = [e for e in pool if e["scope"] == "global"]
        else:
            # local relevant to user's country
            pool = [e for e in pool
                    if e["scope"] == "local"
                    and (user_country in e.get("countries", []) or e.get("origin") == user_country)]

    # Filter out events that are strictly local to a DIFFERENT country than user's
    # (i.e., Vasco Rossi only appears in IT wiki, so a Spanish user should NOT see it)
    def country_ok(ev: dict) -> bool:
        if ev["scope"] == "global":
            return True
        # For local events: show if user's country matches origin or is in countries
        if user_country in ev.get("countries", []):
            return True
        if ev.get("origin") == user_country:
            return True
        # If origin is None and no countries detected, fall back to text availability in user_lang
        if not ev.get("origin") and not ev.get("countries"):
            return bool(ev.get("text_by_lang", {}).get(user_lang))
        return False

    pool = [e for e in pool if country_ok(e)]

    # Scoring
    def score(ev):
        s = 0.0
        if ev.get("image_url"):
            s += 5
        for m in (10, 20, 25, 50, 75, 100, 150, 200, 500, 1000):
            if ev["years_ago"] == m:
                s += 6
                break
        if ev["scope"] == "global":
            s += 4
        if user_country in ev.get("countries", []) or ev.get("origin") == user_country:
            s += 5
        if ev["category"] in liked_categories:
            s += min(liked_categories[ev["category"]] * 1.5, 10)
        # User-declared interests: strong boost
        cat_key = ev["category"]
        sub_key = ev.get("subcategory")
        if cat_key in user_interests:
            s += 6
        if sub_key and f"{cat_key}.{sub_key}" in user_interests:
            s += 10
        s += min((ev["years_ago"] < 100) * 0.5, 0.5)
        return -s

    pool = [e for e in pool if e["id"] not in disliked_ids]
    pool.sort(key=score)
    pool = pool[:limit]

    # Project to language
    projected = [project_event_for_lang(e, user_lang) for e in pool]

    # Attach user interactions
    inters = await load_user_interactions(current["id"], [e["id"] for e in projected])
    for ev in projected:
        marks = inters.get(ev["id"], set())
        ev["liked"] = "like" in marks
        ev["disliked"] = "dislike" in marks
        ev["saved"] = "save" in marks

    return {
        "date": {"month": now.month, "day": now.day, "year": now.year},
        "lang": user_lang,
        "country": user_country,
        "count": len(projected),
        "events": projected,
    }


def _truncate_teaser(text: str, max_len: int = 95) -> str:
    """Trim text to a curiosity-inducing teaser (ends with '...')."""
    if not text:
        return ""
    t = text.strip().replace("\n", " ")
    # Prefer cutting at sentence boundary before max_len
    if len(t) <= max_len:
        return t
    cut = t[: max_len + 20]
    # Try to cut at a space near max_len
    space_idx = cut.rfind(" ", 0, max_len)
    if space_idx > max_len - 30:
        return cut[:space_idx].rstrip(" ,;:-") + "…"
    return t[:max_len].rstrip(" ,;:-") + "…"


@api.get("/events/teasers")
async def events_teasers(
    lang: Optional[Literal["it", "en", "es"]] = Query(None),
    country: Optional[str] = Query(None),
    month: Optional[int] = Query(None, ge=1, le=12),
    day: Optional[int] = Query(None, ge=1, le=31),
    count: int = Query(20, ge=1, le=50),
    current=Depends(get_current_user),
):
    """Return short curiosity-inducing teasers for push notifications."""
    user_lang = lang or current.get("language") or "it"
    user_country = (country or current.get("country") or "IT").upper()
    user_interests = set(current.get("interests", []) or [])

    now = datetime.now(timezone.utc)
    m = month or now.month
    d = day or now.day
    all_events = await get_merged_events(m, d, user_lang)

    likes_agg = await db.interactions.aggregate([
        {"$match": {"user_id": current["id"], "type": "like"}},
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
    ]).to_list(length=100)
    liked_categories = {r["_id"]: r["count"] for r in likes_agg if r["_id"]}

    disliked_list = await db.interactions.find(
        {"user_id": current["id"], "type": "dislike"}
    ).to_list(length=10000)
    disliked_ids = {d2["event_id"] for d2 in disliked_list}

    pool = [e for e in all_events if e["id"] not in disliked_ids]

    def score(ev):
        s = 0.0
        if ev.get("image_url"):
            s += 3
        # Prefer round-number anniversaries for notifications (hook!)
        for m2 in (10, 20, 25, 50, 75, 100, 150, 200, 500, 1000):
            if ev["years_ago"] == m2:
                s += 10
                break
        if ev["scope"] == "global":
            s += 3
        if user_country in ev.get("countries", []) or ev.get("origin") == user_country:
            s += 4
        if ev["category"] in liked_categories:
            s += min(liked_categories[ev["category"]] * 1.2, 8)
        cat_key = ev["category"]
        if cat_key in user_interests:
            s += 5
        return -s

    pool.sort(key=score)
    pool = pool[:count]

    teasers = []
    for e in pool:
        proj = project_event_for_lang(e, user_lang)
        text = proj.get("text") or ""
        title = proj.get("title") or ""
        teasers.append({
            "id": proj["id"],
            "year": proj["year"],
            "years_ago": proj["years_ago"],
            "category": proj["category"],
            "scope": proj["scope"],
            "origin": proj.get("origin"),
            "title": title,
            "text_short": _truncate_teaser(text, 95),
            "title_short": _truncate_teaser(title, 60),
        })

    return {
        "date": {"month": m, "day": d, "year": now.year},
        "lang": user_lang,
        "country": user_country,
        "count": len(teasers),
        "teasers": teasers,
    }


@api.get("/events/categories")
async def categories(current=Depends(get_current_user)):
    return {"categories": [
        {"id": "wars", "color": "#E63946"},
        {"id": "science", "color": "#4CC9F0"},
        {"id": "culture", "color": "#FCA311"},
        {"id": "sports", "color": "#FF5400"},
        {"id": "politics", "color": "#0077B6"},
    ]}


@api.post("/events/interact")
async def interact(body: InteractionBody, current=Depends(get_current_user)):
    # Locate event in merged cache
    now = datetime.now(timezone.utc)
    cache = await db.events_cache.find_one({"_id": f"merged-{now.month:02d}-{now.day:02d}"})
    ev_category = None
    ev_year = None
    if cache:
        for e in cache.get("events", []):
            if e["id"] == body.event_id:
                ev_category = e.get("category")
                ev_year = e.get("year")
                break

    if body.action == "unsave":
        await db.interactions.delete_one({"user_id": current["id"], "event_id": body.event_id, "type": "save"})
        return {"ok": True, "removed": "save"}

    action_type = body.action
    if action_type in ("like", "dislike"):
        other = "dislike" if action_type == "like" else "like"
        await db.interactions.delete_one({"user_id": current["id"], "event_id": body.event_id, "type": other})

    existing = await db.interactions.find_one(
        {"user_id": current["id"], "event_id": body.event_id, "type": action_type}
    )
    if existing:
        await db.interactions.delete_one({"_id": existing["_id"]})
        return {"ok": True, "removed": action_type}

    await db.interactions.insert_one({
        "user_id": current["id"],
        "event_id": body.event_id,
        "type": action_type,
        "category": ev_category,
        "year": ev_year,
        "created_at": datetime.now(timezone.utc),
    })
    return {"ok": True, "added": action_type}


@api.get("/events/favorites")
async def favorites(
    lang: Optional[Literal["it", "en", "es"]] = Query(None),
    current=Depends(get_current_user),
):
    user_lang = lang or current.get("language") or "it"
    saves = await db.interactions.find(
        {"user_id": current["id"], "type": "save"}
    ).sort("created_at", -1).to_list(length=500)
    if not saves:
        return {"count": 0, "events": []}

    saved_ids = [s["event_id"] for s in saves]
    caches = await db.events_cache.find({"_id": {"$regex": "^merged-"}}).to_list(length=500)
    by_id = {}
    for c in caches:
        for e in c.get("events", []):
            by_id[e["id"]] = e

    events = []
    for sid in saved_ids:
        if sid in by_id:
            ev = project_event_for_lang(by_id[sid], user_lang)
            ev["saved"] = True
            events.append(ev)
    return {"count": len(events), "events": events}


@api.get("/events/stats")
async def stats(current=Depends(get_current_user)):
    likes = await db.interactions.count_documents({"user_id": current["id"], "type": "like"})
    dislikes = await db.interactions.count_documents({"user_id": current["id"], "type": "dislike"})
    saves = await db.interactions.count_documents({"user_id": current["id"], "type": "save"})
    pref_agg = await db.interactions.aggregate([
        {"$match": {"user_id": current["id"], "type": "like"}},
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]).to_list(length=10)
    return {
        "likes": likes,
        "dislikes": dislikes,
        "saves": saves,
        "top_categories": [{"category": r["_id"] or "unknown", "count": r["count"]} for r in pref_agg],
    }


@api.get("/")
async def root():
    return {"name": "Accadde Oggi API", "status": "ok"}


# ============================================================
# IMAGE PROXY — bypasses Wikipedia 429 rate limits on clients
# by fetching with proper User-Agent and caching response.
# Public (no auth) — safe because we restrict to upload.wikimedia.org only.
# ============================================================
_image_cache: dict = {}  # in-memory LRU-ish, cap ~200 images
_IMAGE_CACHE_CAP = 200
_wikimedia_semaphore = asyncio.Semaphore(4)  # max 4 concurrent Wikimedia requests

# 1x1 transparent PNG as graceful fallback on upstream failure
_EMPTY_PNG = bytes.fromhex(
    "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000D49444154789C6300010000000500010D0A2DB40000000049454E44AE426082"
)

@api.get("/img")
async def image_proxy(url: str = Query(..., min_length=8)):
    if not url.startswith("https://upload.wikimedia.org/") and not url.startswith("https://commons.wikimedia.org/"):
        raise HTTPException(status_code=400, detail="Only Wikimedia images are allowed")

    cached = _image_cache.get(url)
    if cached:
        return Response(
            content=cached["data"],
            media_type=cached["content_type"],
            headers={"Cache-Control": "public, max-age=86400, immutable"},
        )

    ua = "AccaddeOggi/1.0 (https://accaddeoggi.app; contact@accaddeoggi.app)"
    data = None
    ct = "image/jpeg"

    async with _wikimedia_semaphore:
        for attempt in range(2):  # up to 2 tries with short backoff
            try:
                async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as hc:
                    r = await hc.get(url, headers={"User-Agent": ua, "Accept": "image/*"})
                    if r.status_code == 200:
                        data = r.content
                        ct = r.headers.get("content-type", "image/jpeg")
                        break
                    if r.status_code == 429 and attempt == 0:
                        await asyncio.sleep(0.8)
                        continue
            except httpx.HTTPError:
                if attempt == 0:
                    await asyncio.sleep(0.4)
                    continue

    if data is None:
        # Graceful fallback — tiny transparent PNG with short cache so we retry soon
        return Response(
            content=_EMPTY_PNG,
            media_type="image/png",
            headers={"Cache-Control": "public, max-age=60"},
        )

    # Simple cache eviction
    if len(_image_cache) >= _IMAGE_CACHE_CAP:
        _image_cache.pop(next(iter(_image_cache)), None)
    _image_cache[url] = {"data": data, "content_type": ct}

    return Response(
        content=data,
        media_type=ct,
        headers={"Cache-Control": "public, max-age=86400, immutable"},
    )


# ============================================================
# STARTUP
# ============================================================
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.interactions.create_index([("user_id", 1), ("event_id", 1), ("type", 1)], unique=True)
    await db.interactions.create_index([("user_id", 1), ("type", 1)])
    await db.events_cache.create_index("cached_at")

    # Ensure existing users get a country if missing
    await db.users.update_many({"country": {"$exists": False}}, {"$set": {"country": "IT"}})

    admin_email = os.environ.get("ADMIN_EMAIL", "").lower()
    admin_pw = os.environ.get("ADMIN_PASSWORD", "")
    if admin_email and admin_pw:
        existing = await db.users.find_one({"email": admin_email})
        if not existing:
            await db.users.insert_one({
                "email": admin_email, "password_hash": hash_password(admin_pw),
                "name": "Admin", "role": "admin", "language": "it", "country": "IT",
                "notifications_enabled": True, "created_at": datetime.now(timezone.utc),
            })
            logger.info(f"Seeded admin {admin_email}")
        elif not verify_password(admin_pw, existing["password_hash"]):
            await db.users.update_one({"email": admin_email},
                                       {"$set": {"password_hash": hash_password(admin_pw)}})

    test_email = os.environ.get("TEST_USER_EMAIL", "").lower()
    test_pw = os.environ.get("TEST_USER_PASSWORD", "")
    if test_email and test_pw:
        existing = await db.users.find_one({"email": test_email})
        if not existing:
            await db.users.insert_one({
                "email": test_email, "password_hash": hash_password(test_pw),
                "name": "Demo", "role": "user", "language": "it", "country": "IT",
                "notifications_enabled": True, "created_at": datetime.now(timezone.utc),
            })
            logger.info(f"Seeded demo user {test_email}")
        elif not verify_password(test_pw, existing["password_hash"]):
            await db.users.update_one({"email": test_email},
                                       {"$set": {"password_hash": hash_password(test_pw)}})


@app.on_event("shutdown")
async def shutdown():
    client.close()


app.include_router(api)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=False,
                   allow_methods=["*"], allow_headers=["*"])
