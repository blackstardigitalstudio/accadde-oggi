import { Lang } from "./translations";

export type Subcat = {
  id: string;
  label_it: string;
  label_en: string;
  label_es: string;
  icon: string;
};

export const INTERESTS: Record<string, Subcat[]> = {
  wars: [
    { id: "world_wars", label_it: "Guerre Mondiali", label_en: "World Wars", label_es: "Guerras Mundiales", icon: "🎖️" },
    { id: "ancient_battles", label_it: "Battaglie antiche", label_en: "Ancient battles", label_es: "Batallas antiguas", icon: "🏛️" },
    { id: "cold_war", label_it: "Guerra Fredda", label_en: "Cold War", label_es: "Guerra Fría", icon: "❄️" },
    { id: "revolutions", label_it: "Rivoluzioni", label_en: "Revolutions", label_es: "Revoluciones", icon: "✊" },
    { id: "civil_wars", label_it: "Guerre civili", label_en: "Civil wars", label_es: "Guerras civiles", icon: "⚔️" },
    { id: "terrorism", label_it: "Attentati", label_en: "Terrorism", label_es: "Atentados", icon: "💥" },
    { id: "independence", label_it: "Indipendenze", label_en: "Independence", label_es: "Independencias", icon: "🕊️" },
  ],
  science: [
    { id: "space", label_it: "Spazio", label_en: "Space", label_es: "Espacio", icon: "🚀" },
    { id: "medicine", label_it: "Medicina", label_en: "Medicine", label_es: "Medicina", icon: "💊" },
    { id: "physics", label_it: "Fisica", label_en: "Physics", label_es: "Física", icon: "⚛️" },
    { id: "biology", label_it: "Biologia", label_en: "Biology", label_es: "Biología", icon: "🧬" },
    { id: "technology", label_it: "Tecnologia", label_en: "Technology", label_es: "Tecnología", icon: "💻" },
    { id: "aviation", label_it: "Aviazione", label_en: "Aviation", label_es: "Aviación", icon: "✈️" },
    { id: "environment", label_it: "Natura e clima", label_en: "Nature & climate", label_es: "Naturaleza y clima", icon: "🌍" },
    { id: "inventions", label_it: "Invenzioni", label_en: "Inventions", label_es: "Inventos", icon: "💡" },
  ],
  culture: [
    { id: "cinema", label_it: "Cinema", label_en: "Cinema", label_es: "Cine", icon: "🎬" },
    { id: "music", label_it: "Musica", label_en: "Music", label_es: "Música", icon: "🎵" },
    { id: "literature", label_it: "Letteratura", label_en: "Literature", label_es: "Literatura", icon: "📚" },
    { id: "art", label_it: "Arte", label_en: "Art", label_es: "Arte", icon: "🎨" },
    { id: "fashion", label_it: "Moda", label_en: "Fashion", label_es: "Moda", icon: "👗" },
    { id: "television", label_it: "Televisione", label_en: "Television", label_es: "Televisión", icon: "📺" },
    { id: "theatre", label_it: "Teatro", label_en: "Theatre", label_es: "Teatro", icon: "🎭" },
  ],
  sports: [
    { id: "football", label_it: "Calcio", label_en: "Football", label_es: "Fútbol", icon: "⚽" },
    { id: "olympics", label_it: "Olimpiadi", label_en: "Olympics", label_es: "Olimpiadas", icon: "🏅" },
    { id: "motorsport", label_it: "Formula 1", label_en: "Formula 1", label_es: "Fórmula 1", icon: "🏎️" },
    { id: "motogp", label_it: "MotoGP", label_en: "MotoGP", label_es: "MotoGP", icon: "🏍️" },
    { id: "tennis", label_it: "Tennis", label_en: "Tennis", label_es: "Tenis", icon: "🎾" },
    { id: "cycling", label_it: "Ciclismo", label_en: "Cycling", label_es: "Ciclismo", icon: "🚴" },
    { id: "boxing", label_it: "Pugilato", label_en: "Boxing", label_es: "Boxeo", icon: "🥊" },
    { id: "basketball", label_it: "Basket", label_en: "Basketball", label_es: "Baloncesto", icon: "🏀" },
    { id: "athletics", label_it: "Atletica", label_en: "Athletics", label_es: "Atletismo", icon: "🏃" },
  ],
  politics: [
    { id: "elections", label_it: "Elezioni", label_en: "Elections", label_es: "Elecciones", icon: "🗳️" },
    { id: "treaties", label_it: "Trattati", label_en: "Treaties", label_es: "Tratados", icon: "📜" },
    { id: "monarchies", label_it: "Monarchie", label_en: "Monarchies", label_es: "Monarquías", icon: "👑" },
    { id: "papacy", label_it: "Papato", label_en: "Papacy", label_es: "Papado", icon: "⛪" },
    { id: "assassinations", label_it: "Assassinii", label_en: "Assassinations", label_es: "Asesinatos", icon: "🔪" },
    { id: "human_rights", label_it: "Diritti civili", label_en: "Civil rights", label_es: "Derechos civiles", icon: "✊🏽" },
  ],
};

/** Sottogeneri di una categoria, per i filtri di Esplora. */
export const subcatsFor = (category?: string | null): Subcat[] =>
  (category && INTERESTS[category]) || [];

export const subLabel = (sub: Subcat, lang: Lang) => {
  if (lang === "it") return sub.label_it;
  if (lang === "es") return sub.label_es;
  return sub.label_en;
};
