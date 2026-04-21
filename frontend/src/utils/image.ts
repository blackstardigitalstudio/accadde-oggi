/**
 * Image URL helper.
 * Wikipedia (upload.wikimedia.org) rate-limits anonymous clients with 429.
 * Route these URLs through the backend proxy which adds a proper User-Agent
 * and caches responses. Other URLs (our CDN fallbacks) pass through unchanged.
 */
const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "";

export function proxyImage(url?: string | null): string {
  if (!url) return "";
  if (url.includes("upload.wikimedia.org") || url.includes("commons.wikimedia.org")) {
    return `${BASE_URL}/api/img?url=${encodeURIComponent(url)}`;
  }
  return url;
}
