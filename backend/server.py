from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import re
import hashlib
import hmac
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

import bcrypt
import jwt
import httpx
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Query, Header
from fastapi.responses import Response, StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from bson import ObjectId
from urllib.parse import unquote

# ============================================================
# CONFIG
# ============================================================
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = 60 * 24 * 90    # 90 days — "stay logged in" UX
REFRESH_TOKEN_DAYS = 365                # 1 year
# Optional free LLM provider (Groq — OpenAI-compatible, generous free tier).
# If GROQ_API_KEY is set the deep-dive is written by the LLM; otherwise it falls
# back to the real Wikipedia article extract (free, factual, no key required).
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")

# Bump when the cached event shape changes, so old documents are never served.
CACHE_VERSION = "merged-v2"
# Shared secret for the external daily trigger (GitHub Actions / uptime pinger).
CRON_SECRET = os.environ.get("CRON_SECRET", "")
# Public URL of this service — used for the keep-alive ping that stops the free
# Render instance from going to sleep (and cold-starting on the user).
SELF_URL = os.environ.get("SELF_URL", "").rstrip("/")
# Accepted Google OAuth client IDs (comma separated: web, android, ios).
GOOGLE_CLIENT_IDS = [
    c.strip() for c in os.environ.get("GOOGLE_CLIENT_IDS", "").split(",") if c.strip()
]

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Accadde Oggi API")
api = APIRouter(prefix="/api")
bearer_scheme = HTTPBearer(auto_error=False)


@api.get("/health")
async def health():
    """Public health check (no auth) — used by the host's health probe."""
    return {"status": "ok"}

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("accadde-oggi")

# ============================================================
# AUTH HELPERS
# ============================================================
# bcrypt cost factor. Every extra round doubles the time, and on the free tier's
# shared CPU the old default (12) cost roughly a second per sign-up — most of the
# wait people felt. 10 rounds is the long-standing bcrypt default and still far
# beyond brute-force reach; raise it here if the instance ever gets real cores.
BCRYPT_ROUNDS = int(os.environ.get("BCRYPT_ROUNDS", "10"))


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt(rounds=BCRYPT_ROUNDS)).decode("utf-8")


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


# bcrypt is deliberately slow and fully synchronous: called directly it freezes
# the event loop, so one person signing up stalls everybody else. These run it on
# a worker thread instead.
async def hash_password_async(pw: str) -> str:
    return await asyncio.to_thread(hash_password, pw)


async def verify_password_async(pw: str, hashed: str) -> bool:
    return await asyncio.to_thread(verify_password, pw, hashed)


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
        "auth_provider": user.get("auth_provider", "password"),
        "has_password": bool(user.get("password_hash")),
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


class GoogleAuthBody(BaseModel):
    id_token: str = Field(min_length=20)
    name: Optional[str] = ""
    language: Optional[Literal["it", "en", "es"]] = "it"
    country: Optional[str] = "IT"


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

# Sections of the Wikimedia "onthisday/all" feed we ingest.
# 'selected' is a curated subset of 'events': it lands in the same buckets, so it
# never duplicates anything — it only marks what an edition chose to highlight.
# 'holidays' is deliberately skipped: those entries carry no year, and the whole
# UI is built around "N anni fa".
WIKI_SECTIONS = {
    "events": "event",
    "selected": "event",
    "births": "birth",
    "deaths": "death",
}
EVENT_KINDS = ("event", "birth", "death")

# Language fallback chain. Italian and Spanish readers get the other Romance
# edition before English: far more readable for them when their own edition
# doesn't carry the entry (it.wikipedia, for instance, publishes no births/deaths).
LANG_FALLBACK = {
    "it": ["it", "es", "en"],
    "es": ["es", "it", "en"],
    "en": ["en", "es", "it"],
}

# Long-form summary cap (keeps a full day of events comfortably inside one
# MongoDB document and inside the Atlas free tier).
EXTRACT_MAX = 600


async def fetch_wiki(lang: str, month: int, day: int) -> List[tuple]:
    """Fetch every section of the "on this day" feed for one Wikipedia edition.

    Returns a flat list of (kind, raw_item): a single request now feeds events,
    featured events, births and deaths at once.
    """
    url = f"https://api.wikimedia.org/feed/v1/wikipedia/{lang}/onthisday/all/{month:02d}/{day:02d}"
    ua = "AccaddeOggi/1.0 (https://accaddeoggi.app; contact@accaddeoggi.app)"
    try:
        async with httpx.AsyncClient(timeout=30.0) as hc:
            r = await hc.get(url, headers={"User-Agent": ua, "Api-User-Agent": ua, "Accept": "application/json"})
            if r.status_code != 200:
                logger.warning(f"Wiki {lang} {r.status_code}")
                return []
            payload = r.json()
    except Exception as e:
        logger.error(f"Wiki fetch error ({lang}): {e}")
        return []

    out: List[tuple] = []
    for section, kind in WIKI_SECTIONS.items():
        for item in (payload.get(section) or []):
            out.append((kind, item))
    return out


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
    """Extract best image URL and upgrade thumbnail size for full-screen display.

    Scans ALL pages in the onthisday event (not just pages[0]) and returns the
    first available image, preferring the full-resolution originalimage over the
    thumbnail and skipping tiny icon thumbnails (width < 100px).
    """
    url = None
    for p in (raw.get("pages") or []):
        orig = (p.get("originalimage") or {}).get("source")
        if orig:
            url = orig
            break
        thumb = p.get("thumbnail") or {}
        thumb_src = thumb.get("source")
        if thumb_src and (thumb.get("width") or 9999) >= 100:
            url = thumb_src
            break
    if not url:
        return None
    # Wikipedia thumbnails use /thumb/..../NNNpx-filename. Upgrade to 1080px for HD cards.
    # Example: /thumb/7/7e/Pope.jpg/330px-Pope.jpg -> /thumb/7/7e/Pope.jpg/1080px-Pope.jpg
    import re
    url = re.sub(r"/\d{2,4}px-", "/1080px-", url)
    return url


async def _fetch_pageimage(lang: str, title: str) -> Optional[str]:
    """Fallback lead image via the Action API pageimages prop. Free, no API key.

    Used only for events whose inline onthisday pages carried no usable image.
    Returns the best image URL (upgraded to ~1080px) or None on any error.
    """
    if not title:
        return None
    ua = "AccaddeOggi/1.0 (https://accaddeoggi.app; contact@accaddeoggi.app)"
    url = f"https://{lang}.wikipedia.org/w/api.php"
    params = {
        "action": "query", "format": "json", "formatversion": "2",
        "prop": "pageimages", "piprop": "original|thumbnail", "pithumbsize": "1080",
        "redirects": "1", "titles": title,
    }
    try:
        async with httpx.AsyncClient(timeout=20.0) as hc:
            r = await hc.get(url, params=params,
                             headers={"User-Agent": ua, "Api-User-Agent": ua, "Accept": "application/json"})
            if r.status_code != 200:
                return None
            pages = (r.json().get("query", {}) or {}).get("pages", []) or []
            if not pages:
                return None
            p = pages[0]
            src = (p.get("thumbnail") or {}).get("source") or (p.get("original") or {}).get("source")
            if not src:
                return None
            import re
            return re.sub(r"/\d{2,4}px-", "/1080px-", src)
    except Exception as e:
        logger.warning(f"Wiki pageimage error ({lang}/{title}): {e}")
        return None


def _wiki_url(raw: dict) -> Optional[str]:
    pages = raw.get("pages") or []
    if not pages:
        return None
    return (pages[0].get("content_urls", {}) or {}).get("desktop", {}).get("page")


def _page_extract(raw: dict) -> str:
    """Opening summary of the linked Wikipedia article.

    The feed's own `text` is one sentence; this is the real substance behind it
    and is what the card shows under "approfondimento".
    """
    for p in (raw.get("pages") or []):
        extract = (p.get("extract") or "").strip().replace("\n", " ")
        if len(extract) > 40:
            if len(extract) <= EXTRACT_MAX:
                return extract
            cut = extract[:EXTRACT_MAX]
            dot = cut.rfind(". ")
            return (cut[: dot + 1] if dot > EXTRACT_MAX * 0.5 else cut.rstrip() + "…")
    return ""


def _stable_id(kind: str, year: int, marker: str) -> str:
    """Deterministic event id.

    Python's builtin hash() is salted per process, so ids used to change at every
    restart and saved favourites stopped matching. An md5 digest is stable forever.
    """
    digest = hashlib.md5(f"{kind}|{year}|{marker}".encode("utf-8")).hexdigest()[:10]
    return f"evt-{year}-{digest}"


# How many Wikipedia editions a person must appear in to earn a card.
# It is the best free proxy for "would anyone recognise this name?": a household
# name is in a hundred languages, a promising under-21 footballer is in two.
# Wikipedia's own daily list is exhaustive, not curated — this is the curation.
FAME_MIN = int(os.environ.get("FAME_MIN", "30"))
WIKIDATA_API = "https://www.wikidata.org/w/api.php"
WIKI_UA = "AccaddeOggi/1.0 (https://accaddeoggi.app; contact@accaddeoggi.app)"


async def fetch_fame_and_italian(qids: List[str]) -> dict:
    """For each Wikidata item: how many Wikipedia editions carry it, and the
    Italian/Spanish article titles if they exist.

    Batched 50 at a time, so a whole day of people costs a handful of requests.
    """
    out: dict = {}
    if not qids:
        return out
    unique = list(dict.fromkeys(qids))  # same person can appear from two editions
    async with httpx.AsyncClient(timeout=40.0) as hc:
        for i in range(0, len(unique), 50):
            batch = unique[i: i + 50]
            entities = None
            # Wikimedia throttles bursts. Back off and retry rather than treat a
            # 429 as "nobody here is famous" — that answer would be a lie.
            for attempt in range(4):
                try:
                    r = await hc.get(
                        WIKIDATA_API,
                        params={"action": "wbgetentities", "format": "json",
                                "ids": "|".join(batch), "props": "sitelinks"},
                        headers={"User-Agent": WIKI_UA, "Accept": "application/json"},
                    )
                except Exception as e:
                    logger.warning(f"Wikidata batch error: {e}")
                    await asyncio.sleep(1.5 * (attempt + 1))
                    continue
                if r.status_code == 200:
                    entities = (r.json().get("entities") or {})
                    break
                if r.status_code in (429, 503):
                    wait = float(r.headers.get("Retry-After") or (2 * (attempt + 1)))
                    logger.info(f"Wikidata throttled us ({r.status_code}); waiting {wait:.0f}s")
                    await asyncio.sleep(min(wait, 20))
                    continue
                # Never swallow this silently: an unnoticed failure here used to
                # look exactly like "nobody was famous today".
                logger.warning(f"Wikidata HTTP {r.status_code} on batch {i // 50}: {r.text[:160]}")
                break
            if entities is None:
                continue
            # Stay a polite neighbour between batches.
            await asyncio.sleep(0.4)
            for qid, ent in entities.items():
                links = ent.get("sitelinks") or {}
                out[qid] = {
                    "fame": len(links),
                    "it": (links.get("itwiki") or {}).get("title"),
                    "es": (links.get("eswiki") or {}).get("title"),
                }
    return out


async def fetch_summary(lang: str, title: str) -> Optional[dict]:
    """Opening summary of one Wikipedia article, in a given language."""
    if not title:
        return None
    from urllib.parse import quote
    url = f"https://{lang}.wikipedia.org/api/rest_v1/page/summary/{quote(title, safe='')}"
    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as hc:
            r = await hc.get(url, headers={"User-Agent": WIKI_UA, "Accept": "application/json"})
            if r.status_code != 200:
                return None
            d = r.json()
    except Exception:
        return None
    extract = (d.get("extract") or "").strip().replace("\n", " ")
    if not extract:
        return None
    if len(extract) > EXTRACT_MAX:
        cut = extract[:EXTRACT_MAX]
        dot = cut.rfind(". ")
        extract = cut[: dot + 1] if dot > EXTRACT_MAX * 0.5 else cut.rstrip() + "…"
    return {
        "title": d.get("titles", {}).get("normalized") or d.get("title") or title,
        "extract": extract,
        "description": (d.get("description") or "").strip(),
        "url": (d.get("content_urls", {}) or {}).get("desktop", {}).get("page"),
        "image": (d.get("thumbnail") or {}).get("source"),
    }


async def curate_people(final: List[dict]) -> List[dict]:
    """Keep the people worth a card, and give them Italian words.

    Two problems solved in one pass, because one Wikidata call answers both:
      1. Wikipedia lists every single person born on a date — hundreds, mostly
         unknown. We keep the ones the world actually knows.
      2. it.wikipedia publishes no births/deaths, so those entries arrived in
         Spanish or English. For the ones we keep, we go and fetch the real
         Italian article.
    """
    people = [e for e in final if e["kind"] in ("birth", "death")]
    others = [e for e in final if e["kind"] not in ("birth", "death")]
    if not people:
        return final

    with_qid = [e for e in people if e.get("qid")]
    fame = await fetch_fame_and_italian([e["qid"] for e in with_qid])

    # Fail open. If Wikidata is unreachable we have no idea who is famous, and
    # "no idea" must never turn into "delete everyone" — that would silently
    # empty the app on the day their API has a bad hour.
    if not fame:
        logger.warning("Wikidata gave nothing back: keeping every person, uncurated")
        return final

    kept: List[dict] = []
    for e in with_qid:
        info = fame.get(e["qid"])
        if info is None:
            # This particular item is unknown to us; keep it rather than guess.
            kept.append(e)
            continue
        if info["fame"] < FAME_MIN:
            continue
        e["fame"] = info["fame"]
        e["_it_title"] = info.get("it")
        e["_es_title"] = info.get("es")
        kept.append(e)

    # Fill in the Italian (and Spanish) words for the ones we kept.
    gate = asyncio.Semaphore(6)

    async def _localise(entry: dict):
        async with gate:
            for lg in ("it", "es"):
                # Already native in this language? Nothing to do.
                if lg in entry["sources"]:
                    continue
                title = entry.get(f"_{lg}_title")
                if not title:
                    continue
                summary = await fetch_summary(lg, title)
                if not summary:
                    continue
                lead = summary["description"] or summary["extract"].split(". ")[0]
                entry["title_by_lang"][lg] = summary["title"]
                entry["text_by_lang"][lg] = f"{summary['title']}, {lead}".strip(" ,")
                entry["extract_by_lang"][lg] = summary["extract"]
                entry["wiki_urls"][lg] = summary["url"]
                if not entry.get("image_url") and summary.get("image"):
                    entry["image_url"] = summary["image"]
                entry.setdefault("native_langs", list(entry["sources"]))
                entry["native_langs"].append(lg)

    await asyncio.gather(*[_localise(e) for e in kept])

    for e in kept:
        e.pop("_it_title", None)
        e.pop("_es_title", None)

    logger.info(
        f"Curated people: {len(people)} -> {len(kept)} (soglia fama {FAME_MIN}), "
        f"con testo italiano: {sum(1 for e in kept if 'it' in (e.get('native_langs') or e['sources']))}"
    )
    return others + kept


async def build_merged_events(month: int, day: int) -> List[dict]:
    """Fetch and merge one calendar day from every Wikipedia edition we support.

    Each edition contributes events, featured events, births and deaths. Entries
    are bucketed by (kind + year + wikibase item), so the same fact told by three
    editions becomes one card tagged `global`; a fact only one edition carries
    stays `local`.
    """
    results = await asyncio.gather(*[fetch_wiki(lg, month, day) for lg in WIKI_LANGS])
    by_lang = dict(zip(WIKI_LANGS, results))

    # Bucket: key = (kind, year, wikibase_id or normalized title)
    merged: dict = {}
    for lang, items in by_lang.items():
        for kind, ev in items:
            year = ev.get("year")
            text = ev.get("text", "")
            if not year or not text:
                continue
            wb = _wikibase_id(ev)
            marker = wb or _norm_page_title(ev) or text[:40].lower()
            key = (kind, int(year), marker)
            bucket = merged.get(key)
            if not bucket:
                merged[key] = {
                    "kind": kind,
                    "year": int(year),
                    "qid": wb,
                    "per_lang": {lang: ev},
                    "image_url": _extract_image(ev),
                    "wiki_urls": {lang: _wiki_url(ev)},
                }
            else:
                bucket["per_lang"][lang] = ev
                if not bucket["qid"]:
                    bucket["qid"] = wb
                if not bucket["image_url"]:
                    bucket["image_url"] = _extract_image(ev)
                bucket["wiki_urls"][lang] = _wiki_url(ev)

    current_year = datetime.now(timezone.utc).year
    final: List[dict] = []

    for key, b in merged.items():
        kind, year, marker = key
        per_lang = b["per_lang"]
        sources = list(per_lang.keys())
        # Scope: global if present in 2+ editions, otherwise local
        scope = "global" if len(sources) >= 2 else "local"

        # Pick best text for each user language: fallback chain
        text_by_lang = {}
        title_by_lang = {}
        extract_by_lang = {}
        for ul in ("it", "en", "es"):
            chosen = None
            for candidate in LANG_FALLBACK[ul]:
                if per_lang.get(candidate):
                    chosen = per_lang[candidate]
                    break
            if chosen:
                pages = chosen.get("pages") or []
                page_title = (pages[0].get("normalizedtitle") or pages[0].get("title")) if pages else None
                text_by_lang[ul] = chosen.get("text", "")
                title_by_lang[ul] = page_title or chosen.get("text", "").split(".")[0][:80]
                extract_by_lang[ul] = _page_extract(chosen)

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
        subcategory = detect_subcategory(all_text, category)
        years_ago = current_year - year

        entry = {
            "id": _stable_id(kind, year, marker),
            "kind": kind,            # 'event' | 'birth' | 'death'
            "qid": b.get("qid"),     # Wikidata item — used to rank fame and find the Italian page
            "year": year,
            "years_ago": years_ago,
            "text_by_lang": text_by_lang,
            "title_by_lang": title_by_lang,
            "extract_by_lang": extract_by_lang,
            "image_url": b["image_url"],
            "wiki_urls": b["wiki_urls"],
            "category": category,
            "subcategory": subcategory,
            "scope": scope,          # 'global' | 'local'
            "sources": sources,      # wiki editions
            "countries": countries,  # countries mentioned in text
            "origin": origin,        # primary country affiliation
            "month": month,
            "day": day,
        }

        # For image-less events only, remember the best (lang, title) to look up.
        if not entry["image_url"]:
            for ul in ("it", "en", "es"):
                chosen = per_lang.get(ul)
                if not chosen:
                    continue
                pgs = chosen.get("pages") or []
                pg_title = (pgs[0].get("normalizedtitle") or pgs[0].get("title")) if pgs else None
                if pg_title:
                    entry["_img_fallback"] = (ul, pg_title)
                    break

        final.append(entry)

    # Curate BEFORE chasing images. Wikipedia's daily list of people is
    # exhaustive, not curated: keep the ones anyone would recognise and give them
    # Italian words. Doing it first also means the image lookups below run for
    # ~150 survivors instead of ~500 — the burst that was getting us rate-limited.
    final = await curate_people(final)

    # Second-tier image fallback: for entries whose inline onthisday pages had no
    # usable image, query the Action API pageimages (free, no key). A few at a
    # time — Wikimedia throttles bursts, and it is their gift we are spending.
    image_less = [e for e in final if not e.get("image_url") and e.get("_img_fallback")]
    if image_less:
        gate = asyncio.Semaphore(4)

        async def _lookup(entry: dict):
            async with gate:
                return await _fetch_pageimage(entry["_img_fallback"][0], entry["_img_fallback"][1])

        fetched = await asyncio.gather(*[_lookup(e) for e in image_less])
        for e, src in zip(image_less, fetched):
            if src:
                e["image_url"] = src
    for e in final:
        e.pop("_img_fallback", None)

    return final


async def refresh_day_cache(month: int, day: int) -> int:
    """Rebuild and store the cache for one calendar day. Returns the event count."""
    events = await build_merged_events(month, day)
    if not events:
        # Never overwrite a good cache with an empty fetch (Wikipedia hiccup).
        logger.warning(f"Refresh {month:02d}-{day:02d} returned 0 events — cache left untouched")
        return 0
    await db.events_cache.update_one(
        {"_id": f"{CACHE_VERSION}-{month:02d}-{day:02d}"},
        {"$set": {"events": events, "cached_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    logger.info(f"Cache refreshed {month:02d}-{day:02d}: {len(events)} events")
    return len(events)


async def get_merged_events(month: int, day: int, primary_lang: str) -> List[dict]:
    """Cached accessor. The daily worker keeps this warm, so users rarely wait."""
    cache_key = f"{CACHE_VERSION}-{month:02d}-{day:02d}"
    cached = await db.events_cache.find_one({"_id": cache_key})
    today = datetime.now(timezone.utc).date()
    if cached and cached.get("cached_at") and cached["cached_at"].date() == today:
        return cached["events"]

    events = await build_merged_events(month, day)
    if not events:
        # Fall back to yesterday's cache rather than showing an empty app.
        return cached["events"] if cached else []

    await db.events_cache.update_one(
        {"_id": cache_key},
        {"$set": {"events": events, "cached_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    return events


def native_langs(ev: dict) -> List[str]:
    """Languages this entry can be read in natively.

    Starts as the Wikipedia editions that carried it, and grows when the
    curation step goes and fetches the real Italian article for a person.
    """
    return ev.get("native_langs") or ev.get("sources") or []


def _pick_lang(mapping: dict, lang: str) -> str:
    for candidate in LANG_FALLBACK.get(lang, ["en"]):
        value = mapping.get(candidate)
        if value:
            return value
    return ""


def project_event_for_lang(ev: dict, lang: str) -> dict:
    """Return an event serialized for a specific language."""
    text = _pick_lang(ev.get("text_by_lang", {}), lang)
    title = _pick_lang(ev.get("title_by_lang", {}), lang) or text[:60]
    extract = _pick_lang(ev.get("extract_by_lang", {}), lang)
    wiki_url = _pick_lang(ev.get("wiki_urls", {}), lang) or None
    # Which Wikipedia edition the text actually comes from. it.wikipedia publishes
    # no births/deaths, so those cards fall back to es/en — the card says so
    # rather than passing foreign text off as translated.
    available = native_langs(ev)
    text_lang = lang if lang in available else next(
        (c for c in LANG_FALLBACK.get(lang, []) if c in available), lang
    )
    return {
        "id": ev["id"],
        "kind": ev.get("kind", "event"),
        "text_lang": text_lang,
        "fame": ev.get("fame"),
        "year": ev["year"],
        "years_ago": ev["years_ago"],
        "title": title,
        "text": text,
        "extract": extract,
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
    # Sign-up hashes the password and (optionally) the security answer. Doing them
    # together on worker threads roughly halves the wait the user actually feels.
    wants_question = bool(body.security_question and body.security_answer)
    jobs = [hash_password_async(body.password)]
    if wants_question:
        jobs.append(hash_password_async(body.security_answer.strip().lower()))
    hashes = await asyncio.gather(*jobs)

    doc = {
        "email": email,
        "password_hash": hashes[0],
        "password_changed_at": datetime.now(timezone.utc),
        "name": (body.name or email.split("@")[0]).strip(),
        "role": "user",
        "language": body.language or "it",
        "country": (body.country or "IT").upper(),
        "notifications_enabled": True,
        "created_at": datetime.now(timezone.utc),
    }
    if wants_question:
        doc["security_question"] = body.security_question.strip()
        doc["security_answer_hash"] = hashes[1]
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
    # Google-only accounts have no password hash: they must come back through Google.
    if user and not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="Questo account usa l'accesso con Google")
    if not user or not await verify_password_async(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    uid = str(user["_id"])
    return {
        "access_token": create_access_token(uid, email),
        "refresh_token": create_refresh_token(uid),
        "user": user_public(user),
    }


# ============================================================
# GOOGLE SIGN-IN
# ============================================================
GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"
GOOGLE_ISSUERS = ("accounts.google.com", "https://accounts.google.com")


async def verify_google_id_token(id_token: str) -> dict:
    """Validate a Google ID token and return its claims.

    Uses Google's own tokeninfo endpoint: it checks the signature and expiry for
    us, so there is no key handling and no extra dependency. We still verify the
    audience and issuer ourselves — that part is never someone else's job.
    """
    if not GOOGLE_CLIENT_IDS:
        raise HTTPException(status_code=503, detail="Google sign-in non configurato")
    try:
        async with httpx.AsyncClient(timeout=15.0) as hc:
            r = await hc.get(GOOGLE_TOKENINFO_URL, params={"id_token": id_token})
    except Exception:
        raise HTTPException(status_code=503, detail="Google non raggiungibile, riprova")
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Token Google non valido")

    claims = r.json()
    if claims.get("aud") not in GOOGLE_CLIENT_IDS:
        logger.warning(f"Google token with unexpected aud: {claims.get('aud')}")
        raise HTTPException(status_code=401, detail="Token Google non valido")
    if claims.get("iss") not in GOOGLE_ISSUERS:
        raise HTTPException(status_code=401, detail="Token Google non valido")
    if str(claims.get("email_verified", "")).lower() not in ("true", "1"):
        raise HTTPException(status_code=401, detail="Email Google non verificata")
    if not claims.get("email"):
        raise HTTPException(status_code=401, detail="Token Google senza email")
    return claims


@api.post("/auth/google")
async def auth_google(body: GoogleAuthBody):
    """Sign in (or sign up) with Google. Existing email accounts get linked."""
    claims = await verify_google_id_token(body.id_token)
    email = claims["email"].lower().strip()
    now = datetime.now(timezone.utc)

    user = await db.users.find_one({"email": email})
    if user:
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"google_sub": claims.get("sub"), "last_google_login": now}},
        )
        uid = str(user["_id"])
        return {
            "access_token": create_access_token(uid, email),
            "refresh_token": create_refresh_token(uid),
            "user": user_public(user),
            "created": False,
        }

    doc = {
        "email": email,
        # No password_hash on purpose: this account signs in through Google only.
        "name": (claims.get("name") or body.name or email.split("@")[0]).strip(),
        "role": "user",
        "language": body.language or "it",
        "country": (body.country or "IT").upper(),
        "notifications_enabled": True,
        "auth_provider": "google",
        "google_sub": claims.get("sub"),
        "created_at": now,
    }
    res = await db.users.insert_one(doc)
    uid = str(res.inserted_id)
    return {
        "access_token": create_access_token(uid, email),
        "refresh_token": create_refresh_token(uid),
        "user": user_public({"_id": res.inserted_id, **doc}),
        "created": True,
    }


@api.get("/auth/google/status")
async def auth_google_status():
    """Lets the app show or hide the Google button without shipping a rebuild."""
    return {"enabled": bool(GOOGLE_CLIENT_IDS)}


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
    if not await verify_password_async(answer, user["security_answer_hash"]):
        raise HTTPException(status_code=401, detail="Risposta errata")

    now = datetime.now(timezone.utc)
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "password_hash": await hash_password_async(body.new_password),
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
    if not user:
        raise HTTPException(status_code=401, detail="Password corrente errata")
    # Google-only accounts have no password to confirm — the session token is the proof.
    if user.get("password_hash") and not await verify_password_async(body.current_password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Password corrente errata")
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "security_question": body.question.strip(),
            "security_answer_hash": await hash_password_async(body.answer.strip().lower()),
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
    kind: Optional[Literal["event", "birth", "death"]] = Query(None),
    limit: int = Query(60, ge=1, le=250),
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
    if kind:
        pool = [e for e in pool if e.get("kind", "event") == kind]
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
        # If the user's own Wikipedia edition carries the entry, it is relevant to
        # them by definition — and the text is native, not a fallback translation.
        if user_lang in native_langs(ev):
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
        # Content the user can read in their own language comes first.
        if user_lang in native_langs(ev):
            s += 7
        # Events still open the feed; births and deaths fill it out further down.
        if ev.get("kind", "event") == "event":
            s += 3
        if ev.get("extract_by_lang", {}).get(user_lang):
            s += 1
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
    count: int = Query(20, ge=1, le=120),
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
        # A notification the user can actually read beats a better story they can't.
        if user_lang in native_langs(ev):
            s += 8
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

    # A notification has one line to earn a tap, so it must be in the reader's own
    # language. Native entries are exhausted first and only then topped up from the
    # other editions — ranking alone let a round anniversary in Spanish outrank
    # every Italian story.
    native = [e for e in pool if user_lang in native_langs(e)]
    other = [e for e in pool if user_lang not in native_langs(e)]
    native.sort(key=score)
    other.sort(key=score)
    pool = (native + other)[:count]

    teasers = []
    for e in pool:
        proj = project_event_for_lang(e, user_lang)
        text = proj.get("text") or ""
        title = proj.get("title") or ""
        teasers.append({
            "id": proj["id"],
            "kind": proj["kind"],
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
    cache = await db.events_cache.find_one({"_id": f"{CACHE_VERSION}-{now.month:02d}-{now.day:02d}"})
    ev_category = None
    ev_year = None
    ev_snapshot = None
    if cache:
        for e in cache.get("events", []):
            if e["id"] == body.event_id:
                ev_category = e.get("category")
                ev_year = e.get("year")
                ev_snapshot = e
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

    doc = {
        "user_id": current["id"],
        "event_id": body.event_id,
        "type": action_type,
        "category": ev_category,
        "year": ev_year,
        "created_at": datetime.now(timezone.utc),
    }
    # Saves keep their own copy of the event. Favourites then read straight from
    # here instead of scanning every cached day — which, now that a day holds
    # hundreds of events, would pull the whole cache into memory.
    if action_type == "save" and ev_snapshot:
        doc["snapshot"] = ev_snapshot
    await db.interactions.insert_one(doc)
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

    by_id = {}
    missing = []
    for s in saves:
        if s.get("snapshot"):
            by_id[s["event_id"]] = s["snapshot"]
        else:
            missing.append(s["event_id"])

    # Saves made before snapshots existed: resolve them against today's cache only.
    if missing:
        now = datetime.now(timezone.utc)
        cache = await db.events_cache.find_one(
            {"_id": f"{CACHE_VERSION}-{now.month:02d}-{now.day:02d}"}
        )
        if cache:
            wanted = set(missing)
            for e in cache.get("events", []):
                if e["id"] in wanted:
                    by_id[e["id"]] = e

    events = []
    for s in saves:
        raw = by_id.get(s["event_id"])
        if raw:
            ev = project_event_for_lang(raw, user_lang)
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
# AI ENRICHMENT — "Approfondisci con AI"
# ============================================================
class AiEnrichBody(BaseModel):
    event_id: Optional[str] = None
    text: str = Field(..., min_length=8, max_length=2000)
    year: int = Field(..., ge=-3000, le=2100)
    category: Optional[str] = None
    lang: Literal["it", "en", "es"] = "it"
    wiki_url: Optional[str] = None   # Wikipedia page URL of the event (for the real extract)

# Simple in-memory cache keyed by (event_id|hash, lang)
_ai_cache: dict = {}
_AI_CACHE_CAP = 500

_AI_PROMPT_BY_LANG = {
    "it": (
        "Sei uno storico divulgatore. Scrivi in italiano un approfondimento coinvolgente "
        "(3-4 paragrafi brevi, massimo 900 caratteri totali) su questo evento storico. "
        "Struttura: 1) CONTESTO (perché era importante), 2) COSA ACCADDE (fatti chiave), "
        "3) CONSEGUENZE (impatto nel tempo), 4) CURIOSITÀ (dettaglio poco noto ma veritiero). "
        "Tono narrativo ma preciso. NON inventare fatti: se non hai dati certi, resta sul generale. "
        "Niente intestazioni, niente elenchi puntati, solo paragrafi separati da una riga vuota."
    ),
    "en": (
        "You are a history storyteller. Write in English an engaging deep dive "
        "(3-4 short paragraphs, at most 900 characters total) about this historical event. "
        "Structure: 1) CONTEXT (why it mattered), 2) WHAT HAPPENED (key facts), "
        "3) CONSEQUENCES (long-term impact), 4) FUN FACT (a lesser-known but accurate detail). "
        "Narrative but precise. NEVER invent facts: if you are unsure, stay general. "
        "No headers, no bullet lists — only paragraphs separated by a blank line."
    ),
    "es": (
        "Eres un narrador histórico. Escribe en español una ampliación atractiva "
        "(3-4 párrafos cortos, máximo 900 caracteres en total) sobre este evento histórico. "
        "Estructura: 1) CONTEXTO (por qué importaba), 2) QUÉ PASÓ (hechos clave), "
        "3) CONSECUENCIAS (impacto a largo plazo), 4) CURIOSIDAD (detalle poco conocido pero real). "
        "Tono narrativo pero preciso. No inventes datos: si no estás seguro, sé general. "
        "Sin títulos ni listas, solo párrafos separados por una línea en blanco."
    ),
}


def _parse_wiki_url(url: str) -> Optional[tuple]:
    """Extract (lang, title) from a Wikipedia page URL like
    https://it.wikipedia.org/wiki/Sbarco_sulla_Luna -> ('it', 'Sbarco sulla Luna')."""
    if not url:
        return None
    try:
        m = re.search(r"https?://([a-z]{2,3})\.wikipedia\.org/wiki/(.+)$", url)
        if not m:
            return None
        lang = m.group(1)
        title = unquote(m.group(2)).replace("_", " ").split("#")[0].strip()
        return (lang, title) if title else None
    except Exception:
        return None


async def _fetch_wiki_extract(lang: str, title: str) -> str:
    """Fetch the real plain-text intro (lead section) of a Wikipedia article. Free, factual."""
    ua = "AccaddeOggi/1.0 (https://accaddeoggi.app; contact@accaddeoggi.app)"
    url = f"https://{lang}.wikipedia.org/w/api.php"
    params = {
        "action": "query", "format": "json", "formatversion": "2",
        "prop": "extracts", "exintro": "1", "explaintext": "1",
        "redirects": "1", "titles": title,
    }
    try:
        async with httpx.AsyncClient(timeout=20.0) as hc:
            r = await hc.get(url, params=params,
                             headers={"User-Agent": ua, "Api-User-Agent": ua, "Accept": "application/json"})
            if r.status_code != 200:
                return ""
            pages = (r.json().get("query", {}) or {}).get("pages", []) or []
            if not pages:
                return ""
            return (pages[0].get("extract") or "").strip()
    except Exception as e:
        logger.warning(f"Wiki extract error ({lang}/{title}): {e}")
        return ""


async def _llm_enrich(system_msg: str, user_msg: str) -> str:
    """Optional: write a narrative deep dive via Groq (OpenAI-compatible, free tier)."""
    if not GROQ_API_KEY:
        return ""
    try:
        async with httpx.AsyncClient(timeout=40.0) as hc:
            r = await hc.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
                json={
                    "model": GROQ_MODEL,
                    "temperature": 0.6,
                    "messages": [
                        {"role": "system", "content": system_msg},
                        {"role": "user", "content": user_msg},
                    ],
                },
            )
            if r.status_code != 200:
                logger.warning(f"Groq {r.status_code}: {r.text[:200]}")
                return ""
            choices = r.json().get("choices", [])
            return (choices[0]["message"]["content"] if choices else "").strip()
    except Exception as e:
        logger.warning(f"Groq enrich error: {e}")
        return ""


@api.post("/events/enrich")
async def events_enrich(body: AiEnrichBody, current=Depends(get_current_user)):
    """Deep dive for an event.

    Primary source = the real Wikipedia article intro (free, factual, multilingual).
    If GROQ_API_KEY is configured, a narrative version is generated by a free LLM instead.
    """
    cache_key = f"{body.event_id or body.text[:80]}::{body.lang}"
    cached = _ai_cache.get(cache_key)
    if cached:
        return {"text": cached, "cached": True, "lang": body.lang}

    years_ago = datetime.now(timezone.utc).year - body.year
    text = ""
    source = "wikipedia"

    # 1) Real Wikipedia extract (no API key needed).
    parsed = _parse_wiki_url(body.wiki_url or "")
    if parsed:
        wlang, wtitle = parsed
        text = await _fetch_wiki_extract(wlang, wtitle)
        # If the article is in another language than requested, try the requested edition too.
        if wlang != body.lang:
            alt = await _fetch_wiki_extract(body.lang, wtitle)
            if len(alt) > 40:
                text = alt

    # 2) Optional free LLM (Groq) — produces a richer narrative when a key is set.
    if GROQ_API_KEY:
        system_msg = _AI_PROMPT_BY_LANG.get(body.lang, _AI_PROMPT_BY_LANG["it"])
        user_msg = (
            f"Evento: {body.text}\n"
            f"Anno: {body.year} ({years_ago} anni fa)\n"
            f"Categoria: {body.category or 'generale'}\n"
            + (f"\nContesto da Wikipedia:\n{text[:1500]}\n" if text else "")
            + "\nScrivi ora l'approfondimento."
        )
        llm = await _llm_enrich(system_msg, user_msg)
        if len(llm) > 40:
            text, source = llm, "llm"

    text = (text or "").strip()
    if not text:
        raise HTTPException(status_code=502, detail="No deep-dive content available")

    # Trim overly long outputs at a sentence/word boundary.
    if len(text) > 1800:
        text = text[:1800].rsplit(" ", 1)[0] + "…"

    # Cache (FIFO eviction)
    if len(_ai_cache) >= _AI_CACHE_CAP:
        _ai_cache.pop(next(iter(_ai_cache)), None)
    _ai_cache[cache_key] = text

    return {"text": text, "cached": False, "lang": body.lang, "source": source}


# ============================================================
# PUSH NOTIFICATIONS (Expo) — server-driven, so they keep arriving
# even when the app hasn't been opened in weeks
# ============================================================
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
PUSH_CHANNEL = "accadde-daily"

KIND_ICON = {"event": "📜", "birth": "🎂", "death": "🕯️"}
CATEGORY_ICON = {"wars": "⚔️", "science": "🔬", "culture": "🎭", "sports": "🏆", "politics": "🏛️"}

# The brand leads every push: it has to be recognisable before it is read.
BRAND = {"it": "Accadde Oggi", "en": "On This Day", "es": "Un Día Como Hoy"}

# Round anniversaries spelled out. "Vent'anni fa" reads like a person wrote it,
# "20 anni fa" reads like a database. Everything else stays as digits.
SPELLED_YEARS = {
    "it": {10: "dieci anni", 20: "vent'anni", 25: "venticinque anni", 30: "trent'anni",
           40: "quarant'anni", 50: "mezzo secolo", 60: "sessant'anni", 70: "settant'anni",
           75: "settantacinque anni", 80: "ottant'anni", 90: "novant'anni", 100: "cent'anni",
           150: "centocinquant'anni", 200: "due secoli", 250: "duecentocinquant'anni",
           500: "cinque secoli", 1000: "mille anni"},
    "en": {10: "ten years", 20: "twenty years", 25: "twenty-five years", 30: "thirty years",
           40: "forty years", 50: "half a century", 60: "sixty years", 70: "seventy years",
           75: "seventy-five years", 80: "eighty years", 90: "ninety years", 100: "a century",
           150: "a century and a half", 200: "two centuries", 250: "two hundred and fifty years",
           500: "five centuries", 1000: "a thousand years"},
    "es": {10: "diez años", 20: "veinte años", 25: "veinticinco años", 30: "treinta años",
           40: "cuarenta años", 50: "medio siglo", 60: "sesenta años", 70: "setenta años",
           75: "setenta y cinco años", 80: "ochenta años", 90: "noventa años", 100: "un siglo",
           150: "siglo y medio", 200: "dos siglos", 250: "doscientos cincuenta años",
           500: "cinco siglos", 1000: "mil años"},
}

OPENERS = {
    "it": {"first": "{years} fa nasceva", "birth": "Nel {year} nasceva", "death": "Nel {year} ci lasciava"},
    "en": {"first": "{years} ago this was born", "birth": "Born in {year}", "death": "In {year} we lost"},
    "es": {"first": "Hace {years} nacía", "birth": "En {year} nacía", "death": "En {year} nos dejaba"},
}

FALLBACK_NUDGE = {
    "it": "Trenta secondi e lo sai.",
    "en": "Thirty seconds and you know.",
    "es": "Treinta segundos y lo sabes.",
}

ROUND_ANNIVERSARIES = (10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100, 150, 200, 250, 500, 1000)

# Firsts, inventions and discoveries land differently from ordinary events:
# "oggi hanno creato la lampadina" is its own kind of hook.
FIRST_RE = re.compile(
    r"\bprim[ao]\b|\binvent|\bbrevett|\bscopert|\bnasce\b|\bdebutt"
    r"|\bfirst\b|\bpatent|\bdiscover|\blaunch|\bdebut"
    r"|\bprimer[ao]?\b|\bdescubr|\bestren",
    re.IGNORECASE,
)


def spell_years(lang: str, years: int) -> str:
    spelled = SPELLED_YEARS.get(lang, {}).get(years)
    if spelled:
        return spelled
    return f"{years} years" if lang == "en" else f"{years} anni"


def build_push_content(teaser: dict, lang: str) -> dict:
    """Title + body for one push, built from a real event.

    Shape: "📜 Accadde Oggi · vent'anni fa" / "Il fatto vero, in chiaro."
    """
    kind = teaser.get("kind", "event")
    year = teaser.get("year")
    years_ago = teaser.get("years_ago") or 0
    fact = (teaser.get("text_short") or teaser.get("title") or "").strip()
    is_first = kind == "event" and bool(FIRST_RE.search(fact))
    is_round = years_ago in ROUND_ANNIVERSARIES

    icon = "💡" if is_first else "🎯" if is_round else (
        CATEGORY_ICON.get(teaser.get("category")) or KIND_ICON.get(kind, "📜")
    )
    years = spell_years(lang, years_ago)
    brand = BRAND.get(lang, BRAND["en"])

    # A round anniversary is the occasion, so it always leads — spelled out,
    # for anyone. Otherwise events show the distance and people show the year.
    if kind == "event" or is_round:
        stamp = f"{years} ago" if lang == "en" else (f"hace {years}" if lang == "es" else f"{years} fa")
    else:
        stamp = str(year)
    title = f"{icon} {brand} · {stamp}"

    if len(fact) <= 12:
        body = FALLBACK_NUDGE.get(lang, FALLBACK_NUDGE["en"])
    elif kind == "event" and not is_first:
        body = fact
    else:
        opener_key = "first" if is_first else kind
        opener = (OPENERS.get(lang) or OPENERS["en"])[opener_key]
        body = f"{opener.format(years=years, year=year)} {fact}"

    return {"title": title, "body": body}


async def _expo_send(messages: List[dict]) -> dict:
    """Post one batch to Expo and clean up tokens the device no longer accepts."""
    sent = 0
    dropped = 0
    async with httpx.AsyncClient(timeout=30.0) as hc:
        for i in range(0, len(messages), 100):
            batch = messages[i: i + 100]
            try:
                r = await hc.post(
                    EXPO_PUSH_URL,
                    json=batch,
                    headers={"Content-Type": "application/json", "Accept": "application/json"},
                )
                data = r.json().get("data", [])
            except Exception as e:
                logger.error(f"Expo push error: {e}")
                continue
            for msg, result in zip(batch, data if isinstance(data, list) else []):
                if result.get("status") == "ok":
                    sent += 1
                    continue
                err = (result.get("details") or {}).get("error")
                if err in ("DeviceNotRegistered", "InvalidCredentials"):
                    await db.push_tokens.delete_one({"token": msg["to"]})
                    dropped += 1
    return {"sent": sent, "dropped": dropped}


def _push_score(ev: dict, country: str, lang: str = "it") -> float:
    """Generic (non personalised) ranking used to pick the daily push subject."""
    s = 0.0
    if ev.get("image_url"):
        s += 3
    if lang in native_langs(ev):
        s += 8
    if ev["years_ago"] in (10, 20, 25, 50, 75, 100, 150, 200, 500, 1000):
        s += 10
    if ev["scope"] == "global":
        s += 3
    if country in ev.get("countries", []) or ev.get("origin") == country:
        s += 4
    return -s


async def send_daily_push() -> dict:
    """One push per registered device, built from today's best story.

    Grouped by (language, country) so the whole round costs a handful of
    Wikipedia-free cache reads, not one per user.
    """
    tokens = await db.push_tokens.find({"enabled": True}).to_list(length=20000)
    if not tokens:
        return {"ok": True, "sent": 0, "reason": "no tokens"}

    now = datetime.now(timezone.utc)
    events = await get_merged_events(now.month, now.day, "it")
    if not events:
        return {"ok": False, "sent": 0, "reason": "no events"}

    messages: List[dict] = []
    pools: dict = {}
    for tok in tokens:
        lang = tok.get("lang") or "it"
        country = (tok.get("country") or "IT").upper()
        key = (lang, country)
        if key not in pools:
            # Same rule as the teasers: readable in the user's language first.
            native = [e for e in events if lang in native_langs(e)]
            rest = [e for e in events if lang not in native_langs(e)]
            ranked = (
                sorted(native, key=lambda e: _push_score(e, country, lang))
                + sorted(rest, key=lambda e: _push_score(e, country, lang))
            )[:8]
            pool_items = []
            for e in ranked:
                proj = project_event_for_lang(e, lang)
                proj["text_short"] = _truncate_teaser(proj.get("text", ""), 110)
                pool_items.append(proj)
            pools[key] = pool_items
        pool = pools[key]
        if not pool:
            continue
        # Vary the story per device so two phones side by side don't match.
        teaser = pool[hash(tok["token"]) % len(pool)]
        content = build_push_content(teaser, lang)
        messages.append({
            "to": tok["token"],
            "title": content["title"],
            "body": content["body"],
            "sound": "default",
            "priority": "high",
            "channelId": PUSH_CHANNEL,
            "interruptionLevel": "time-sensitive",
            "data": {"eventId": teaser["id"], "year": teaser["year"]},
        })

    result = await _expo_send(messages)
    logger.info(f"Daily push: {result}")
    return {"ok": True, **result, "devices": len(messages)}


class PushRegisterBody(BaseModel):
    token: str = Field(min_length=10, max_length=256)
    lang: Optional[Literal["it", "en", "es"]] = None
    country: Optional[str] = None
    platform: Optional[str] = Field(default=None, max_length=20)


@api.post("/push/register")
async def push_register(body: PushRegisterBody, current=Depends(get_current_user)):
    """Store an Expo push token so the server can reach this device."""
    await db.push_tokens.update_one(
        {"token": body.token},
        {"$set": {
            "token": body.token,
            "user_id": current["id"],
            "lang": body.lang or current.get("language") or "it",
            "country": (body.country or current.get("country") or "IT").upper(),
            "platform": body.platform,
            "enabled": True,
            "updated_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )
    return {"ok": True}


@api.post("/push/unregister")
async def push_unregister(body: PushRegisterBody, current=Depends(get_current_user)):
    await db.push_tokens.delete_one({"token": body.token, "user_id": current["id"]})
    return {"ok": True}


# ============================================================
# DAILY AUTO-REFRESH — keeps the app fresh without anyone touching it
# ============================================================
REFRESH_DAYS_AHEAD = 2        # today + the next two days
CACHE_RETENTION_DAYS = 45     # days of unvisited cache we keep around
KEEPALIVE_SECONDS = 600       # 10 min — under Render's 15 min idle shutdown


async def refresh_upcoming_days() -> dict:
    """Rebuild the cache for today and the next couple of days.

    Notifications are scheduled a few days ahead, so those days have to be ready
    before anyone asks for them.
    """
    today = datetime.now(timezone.utc).date()
    counts = {}
    for offset in range(REFRESH_DAYS_AHEAD + 1):
        target = today + timedelta(days=offset)
        counts[target.isoformat()] = await refresh_day_cache(target.month, target.day)
    return counts


async def purge_stale_cache() -> int:
    """Drop cache documents from previous formats and days nobody has opened."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=CACHE_RETENTION_DAYS)
    result = await db.events_cache.delete_many({
        "$or": [
            {"_id": {"$not": {"$regex": f"^{CACHE_VERSION}-"}}},
            {"cached_at": {"$lt": cutoff}},
        ]
    })
    if result.deleted_count:
        logger.info(f"Purged {result.deleted_count} stale cache documents")
    return result.deleted_count


async def _keepalive_ping():
    """Ping our own public URL so the free instance never falls asleep.

    A sleeping instance means a ~1 minute cold start for whoever opens the app next.
    """
    if not SELF_URL:
        return
    try:
        async with httpx.AsyncClient(timeout=20.0) as hc:
            await hc.get(f"{SELF_URL}/api/health")
    except Exception:
        pass


async def _daily_worker():
    """Background loop: refresh once per UTC day, ping in between."""
    await asyncio.sleep(10)  # let the app finish booting
    last_refresh: Optional[str] = None
    while True:
        try:
            today = datetime.now(timezone.utc).date().isoformat()
            if last_refresh != today:
                await refresh_upcoming_days()
                await purge_stale_cache()
                await send_daily_push()
                last_refresh = today
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.error(f"Daily worker error: {e}")
        await _keepalive_ping()
        await asyncio.sleep(KEEPALIVE_SECONDS)


def _require_cron_key(key: Optional[str], header_key: Optional[str]):
    """Authorise a cron call.

    Prefer the header: anything in a query string ends up in access logs, proxy
    logs and CI output, so a secret passed that way is a secret written down in
    several places. The query form stays for convenience but is the fallback.
    Comparison is constant-time so a wrong key leaks nothing by how long it takes.
    """
    if not CRON_SECRET:
        raise HTTPException(status_code=503, detail="CRON_SECRET not configured")
    supplied = header_key or key or ""
    if not hmac.compare_digest(supplied, CRON_SECRET):
        raise HTTPException(status_code=403, detail="Invalid key")


@api.get("/cron/daily")
async def cron_daily(
    key: Optional[str] = Query(None),
    x_cron_key: Optional[str] = Header(None),
):
    """External daily trigger (GitHub Actions). Also wakes a sleeping instance."""
    _require_cron_key(key, x_cron_key)
    counts = await refresh_upcoming_days()
    purged = await purge_stale_cache()
    return {"ok": True, "refreshed": counts, "purged": purged}


@api.get("/cron/push")
async def cron_push(
    key: Optional[str] = Query(None),
    x_cron_key: Optional[str] = Header(None),
):
    """External trigger for the daily push round."""
    _require_cron_key(key, x_cron_key)
    return await send_daily_push()


# ============================================================
# STARTUP
# ============================================================
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.interactions.create_index([("user_id", 1), ("event_id", 1), ("type", 1)], unique=True)
    await db.interactions.create_index([("user_id", 1), ("type", 1)])
    await db.events_cache.create_index("cached_at")
    await db.push_tokens.create_index("token", unique=True)
    await db.push_tokens.create_index("user_id")

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

    app.state.daily_worker = asyncio.create_task(_daily_worker())
    logger.info("Daily refresh worker started")


@app.on_event("shutdown")
async def shutdown():
    task = getattr(app.state, "daily_worker", None)
    if task:
        task.cancel()
    client.close()


app.include_router(api)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=False,
                   allow_methods=["*"], allow_headers=["*"])
