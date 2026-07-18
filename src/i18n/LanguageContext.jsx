import { createContext, useContext, useEffect, useMemo, useState } from "react";
import translations from "./translations";

const LanguageContext = createContext(null);

const supportedLanguages = [
  "en",
  "tr",
  "ru",
  "ar",
  "zh",
  "es",
  "pt",
  "fr",
  "de",
];

function normalizeLanguage(language) {
  if (!language) return "en";

  const lowerLanguage = language.toLowerCase();

  if (lowerLanguage.startsWith("tr")) return "tr";
  if (lowerLanguage.startsWith("ru")) return "ru";
  if (lowerLanguage.startsWith("ar")) return "ar";
  if (lowerLanguage.startsWith("zh")) return "zh";
  if (lowerLanguage.startsWith("es")) return "es";
  if (lowerLanguage.startsWith("pt")) return "pt";
  if (lowerLanguage.startsWith("fr")) return "fr";
  if (lowerLanguage.startsWith("de")) return "de";

  return "en";
}

function detectInitialLanguage() {
  const savedLanguage = localStorage.getItem("language");

  if (supportedLanguages.includes(savedLanguage)) {
    return savedLanguage;
  }

  const browserLanguage = navigator.language || "";

  return normalizeLanguage(browserLanguage);
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(detectInitialLanguage);

  useEffect(() => {
    document.documentElement.lang = language === "pt" ? "pt-BR" : language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  }, [language]);

  function setLanguage(nextLanguage) {
    if (!supportedLanguages.includes(nextLanguage)) {
      return;
    }

    localStorage.setItem("language", nextLanguage);
    setLanguageState(nextLanguage);
  }

  const value = useMemo(() => {
    const dictionary = translations[language] || translations.en;

    function t(path) {
      return path.split(".").reduce((current, key) => {
        return current?.[key];
      }, dictionary) || path;
    }

    return {
      language,
      setLanguage,
      supportedLanguages,
      t,
    };
  }, [language]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }

  return context;
}
