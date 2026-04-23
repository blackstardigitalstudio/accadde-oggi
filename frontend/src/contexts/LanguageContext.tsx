import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import { Lang } from "../i18n/translations";

const LANG_KEY = "accadde:lang";

function detectDeviceLang(): Lang {
  try {
    const locales = Localization.getLocales();
    const primary = locales?.[0]?.languageCode?.toLowerCase() || "it";
    if (primary === "it") return "it";
    if (primary === "es") return "es";
    if (primary === "en") return "en";
  } catch {}
  return "it";
}

type LangCtx = {
  lang: Lang;
  setLang: (l: Lang) => Promise<void>;
  ready: boolean;
};

const LanguageContext = createContext<LangCtx | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>("it");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(LANG_KEY);
        if (saved === "it" || saved === "en" || saved === "es") {
          setLangState(saved);
        } else {
          setLangState(detectDeviceLang());
        }
      } catch {
        setLangState(detectDeviceLang());
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const setLang = useCallback(async (l: Lang) => {
    setLangState(l);
    try {
      await AsyncStorage.setItem(LANG_KEY, l);
    } catch {}
  }, []);

  return (
    <LanguageContext.Provider value={{ lang, setLang, ready }}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used within LanguageProvider");
  return ctx;
}
