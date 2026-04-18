export const COLORS = {
  bg: "#050505",
  surface: "#121212",
  surfaceGlass: "rgba(20,20,20,0.7)",
  textPrimary: "#F8F8F6",
  textSecondary: "#A1A1AA",
  textMuted: "#52525B",
  border: "rgba(255,255,255,0.1)",
  like: "#E63946",
  dislike: "#52525B",
  share: "#F8F8F6",
};

export const CATEGORY_COLORS: Record<string, string> = {
  wars: "#E63946",
  science: "#4CC9F0",
  culture: "#FCA311",
  sports: "#FF5400",
  politics: "#0077B6",
};

export const categoryColor = (c: string) => CATEGORY_COLORS[c] || "#FCA311";
