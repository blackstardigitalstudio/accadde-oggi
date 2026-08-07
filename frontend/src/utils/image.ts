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

/**
 * The same picture at a width that suits where it is being shown.
 *
 * The backend asks Wikipedia for 1080px, which is right for a full-screen card
 * and wasteful everywhere else: the Explore grid draws them about 180px wide,
 * so it was downloading roughly thirty times the pixels it could display —
 * on a phone connection that is the difference between a grid that appears and
 * a grid that trickles in.
 */
export function proxyImageAt(url: string | null | undefined, width: number): string {
  if (!url) return "";
  const resized = url.replace(/\/\d{2,4}px-/, `/${Math.round(width)}px-`);
  return proxyImage(resized);
}
