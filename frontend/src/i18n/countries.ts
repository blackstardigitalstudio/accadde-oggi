export type Country = {
  code: string;
  label_it: string;
  label_en: string;
  label_es: string;
  flag: string;
};

export const COUNTRIES: Country[] = [
  { code: "IT", label_it: "Italia", label_en: "Italy", label_es: "Italia", flag: "🇮🇹" },
  { code: "ES", label_it: "Spagna", label_en: "Spain", label_es: "España", flag: "🇪🇸" },
  { code: "US", label_it: "Stati Uniti", label_en: "United States", label_es: "Estados Unidos", flag: "🇺🇸" },
  { code: "GB", label_it: "Regno Unito", label_en: "United Kingdom", label_es: "Reino Unido", flag: "🇬🇧" },
  { code: "FR", label_it: "Francia", label_en: "France", label_es: "Francia", flag: "🇫🇷" },
  { code: "DE", label_it: "Germania", label_en: "Germany", label_es: "Alemania", flag: "🇩🇪" },
  { code: "MX", label_it: "Messico", label_en: "Mexico", label_es: "México", flag: "🇲🇽" },
  { code: "AR", label_it: "Argentina", label_en: "Argentina", label_es: "Argentina", flag: "🇦🇷" },
  { code: "BR", label_it: "Brasile", label_en: "Brazil", label_es: "Brasil", flag: "🇧🇷" },
  { code: "PT", label_it: "Portogallo", label_en: "Portugal", label_es: "Portugal", flag: "🇵🇹" },
  { code: "CH", label_it: "Svizzera", label_en: "Switzerland", label_es: "Suiza", flag: "🇨🇭" },
  { code: "CA", label_it: "Canada", label_en: "Canada", label_es: "Canadá", flag: "🇨🇦" },
  { code: "AU", label_it: "Australia", label_en: "Australia", label_es: "Australia", flag: "🇦🇺" },
  { code: "JP", label_it: "Giappone", label_en: "Japan", label_es: "Japón", flag: "🇯🇵" },
  { code: "CN", label_it: "Cina", label_en: "China", label_es: "China", flag: "🇨🇳" },
  { code: "RU", label_it: "Russia", label_en: "Russia", label_es: "Rusia", flag: "🇷🇺" },
  { code: "IN", label_it: "India", label_en: "India", label_es: "India", flag: "🇮🇳" },
  { code: "CO", label_it: "Colombia", label_en: "Colombia", label_es: "Colombia", flag: "🇨🇴" },
  { code: "CL", label_it: "Cile", label_en: "Chile", label_es: "Chile", flag: "🇨🇱" },
  { code: "PE", label_it: "Perù", label_en: "Peru", label_es: "Perú", flag: "🇵🇪" },
];

export const countryLabel = (code: string, lang: "it" | "en" | "es") => {
  const c = COUNTRIES.find((x) => x.code === code);
  if (!c) return code;
  if (lang === "it") return c.label_it;
  if (lang === "es") return c.label_es;
  return c.label_en;
};

export const countryFlag = (code: string) => COUNTRIES.find((x) => x.code === code)?.flag || "🌍";

export const defaultCountryForLang = (lang: "it" | "en" | "es"): string => {
  if (lang === "it") return "IT";
  if (lang === "es") return "ES";
  return "US";
};
