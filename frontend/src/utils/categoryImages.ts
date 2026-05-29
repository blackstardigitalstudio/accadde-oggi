/**
 * Local, bundled category background images (replaces the former remote CDN images).
 * They are dark cinematic textures shown behind a heavy gradient overlay.
 * Bundled => work offline, never break, no external dependency.
 */
import { ImageSourcePropType } from "react-native";
import { proxyImage } from "./image";

const IMAGES: Record<string, ImageSourcePropType> = {
  wars: require("../../assets/images/categories/wars.png"),
  science: require("../../assets/images/categories/science.png"),
  sports: require("../../assets/images/categories/sports.png"),
  culture: require("../../assets/images/categories/culture.png"),
  politics: require("../../assets/images/categories/culture.png"),
};

/** Local fallback image for a category (defaults to "culture"). */
export function categoryImage(category?: string | null): ImageSourcePropType {
  return IMAGES[category || ""] || IMAGES.culture;
}

/** Source for an event card: the (proxied) Wikipedia image, else the local category fallback. */
export function eventImageSource(
  url?: string | null,
  category?: string | null
): ImageSourcePropType {
  const proxied = proxyImage(url);
  return proxied ? { uri: proxied } : categoryImage(category);
}

/** Rotating hero backgrounds for the auth screens. */
export const HERO_IMAGES: ImageSourcePropType[] = [
  IMAGES.wars,
  IMAGES.science,
  IMAGES.sports,
  IMAGES.culture,
];
