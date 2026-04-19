export type ThemeMode = "dark" | "light";

export type Palette = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  tabBar: string;
  headerBg: string;
  like: string;
  dislike: string;
  share: string;
  inputBorder: string;
};

export const darkColors: Palette = {
  bg: "#050505",
  surface: "#121212",
  surfaceAlt: "rgba(255,255,255,0.04)",
  textPrimary: "#F8F8F6",
  textSecondary: "#A1A1AA",
  textMuted: "#52525B",
  border: "rgba(255,255,255,0.1)",
  tabBar: "#0a0a0a",
  headerBg: "rgba(5,5,5,0.92)",
  like: "#E63946",
  dislike: "#52525B",
  share: "#F8F8F6",
  inputBorder: "#52525B",
};

export const lightColors: Palette = {
  bg: "#FAFAF7",
  surface: "#FFFFFF",
  surfaceAlt: "rgba(0,0,0,0.04)",
  textPrimary: "#0A0A0A",
  textSecondary: "#4A4A52",
  textMuted: "#8E8E98",
  border: "rgba(0,0,0,0.1)",
  tabBar: "#FFFFFF",
  headerBg: "rgba(250,250,247,0.95)",
  like: "#E63946",
  dislike: "#8E8E98",
  share: "#0A0A0A",
  inputBorder: "#8E8E98",
};

// Legacy export for components not yet migrated; always dark fallback
export const COLORS = darkColors;

export const CATEGORY_COLORS: Record<string, string> = {
  wars: "#E63946",
  science: "#4CC9F0",
  culture: "#FCA311",
  sports: "#FF5400",
  politics: "#0077B6",
};

export const categoryColor = (c: string) => CATEGORY_COLORS[c] || "#FCA311";
