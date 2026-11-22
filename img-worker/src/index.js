// Ponte foto di Accadde Oggi — Cloudflare Worker gratuito.
//
// L'app chiede le foto di Wikipedia a /api/img sul backend Render, che ora
// risponde solo con un rimando qui. Questo Worker scarica la foto da
// Wikimedia (con un User-Agent corretto) e la tiene nella cache di Cloudflare
// per 30 giorni: la banda di Render (5 GB/mese sul piano gratuito) non viene
// piu' toccata dalle immagini.
//
//   ?u=<miniatura 960px o piu' piccola>  (facoltativo)
//   ?o=<file originale>                  (riserva se la miniatura non esiste)
//
// Accetta solo upload.wikimedia.org. Made in Italy.

const ALLOWED = /^https:\/\/upload\.wikimedia\.org\/wikipedia\/[^?#]+$/;
const UA = "AccaddeOggi/1.0 (https://blackstardigitalstudio.github.io/app/; image relay)";
const MONTH = 60 * 60 * 24 * 30;
const EMPTY_PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="),
  (c) => c.charCodeAt(0)
);

export default {
  async fetch(request, env, ctx) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405 });
    }
    const params = new URL(request.url).searchParams;
    const candidates = [params.get("u"), params.get("o")].filter(
      (c) => c && ALLOWED.test(c)
    );
    if (candidates.length === 0) {
      return new Response("Only upload.wikimedia.org images", { status: 400 });
    }

    const cache = caches.default;
    for (const src of candidates) {
      const key = new Request(src);
      const hit = await cache.match(key);
      if (hit) return hit;

      let upstream;
      try {
        upstream = await fetch(src, {
          headers: { "User-Agent": UA, Accept: "image/*" },
          cf: { cacheEverything: true, cacheTtl: MONTH },
        });
      } catch {
        continue;
      }
      const type = upstream.headers.get("content-type") || "";
      if (!upstream.ok || !type.startsWith("image/")) continue;

      const res = new Response(upstream.body, {
        status: 200,
        headers: {
          "Content-Type": type,
          "Cache-Control": `public, max-age=${MONTH}, immutable`,
          "Access-Control-Allow-Origin": "*",
        },
      });
      ctx.waitUntil(cache.put(key, res.clone()));
      return res;
    }

    return new Response(EMPTY_PNG, {
      headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=60" },
    });
  },
};
