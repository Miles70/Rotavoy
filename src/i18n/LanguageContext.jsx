import { useLocation, useNavigate } from "react-router-dom";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
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
  "it",
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
  if (lowerLanguage.startsWith("it")) return "it";

  return "en";
}

function detectInitialLanguage() {
  const urlLanguage = new URLSearchParams(globalThis.window?.location?.search || "").get("lang");
  if (supportedLanguages.includes(urlLanguage)) {
    try { localStorage.setItem("language", urlLanguage); } catch { /* Optional storage. */ }
    return urlLanguage;
  }
  let savedLanguage;
  try { savedLanguage = localStorage.getItem("language"); } catch { /* Optional storage. */ }

  if (supportedLanguages.includes(savedLanguage)) {
    return savedLanguage;
  }

  const browserLanguage = globalThis.navigator?.language || "";

  return normalizeLanguage(browserLanguage);
}

export function RoutedLanguageProvider({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  return <LanguageProvider location={location} navigate={navigate}>{children}</LanguageProvider>;
}

export function LanguageProvider({ children, location, navigate }) {
  const [preferredLanguage, setLanguageState] = useState(detectInitialLanguage);
  const queryLanguage = new URLSearchParams(location?.search || "").get("lang");
  const urlLanguage = supportedLanguages.includes(queryLanguage) ? queryLanguage : null;
  const language = urlLanguage || preferredLanguage;

  useEffect(() => {
    if (urlLanguage) {
      setLanguageState(urlLanguage);
      try { localStorage.setItem("language", urlLanguage); } catch { /* Optional storage. */ }
    }
  }, [urlLanguage]);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  }, [language]);

  const setLanguage = useCallback((nextLanguage) => {
    if (!supportedLanguages.includes(nextLanguage)) {
      return;
    }

    try { localStorage.setItem("language", nextLanguage); } catch { /* Optional storage. */ }
    setLanguageState(nextLanguage);
    if (location && navigate && new URLSearchParams(location.search).has("lang")) {
      const params = new URLSearchParams(location.search);
      params.set("lang", nextLanguage);
      navigate({ pathname: location.pathname, search: `?${params}`, hash: location.hash }, { replace: true });
    }
  }, [location, navigate]);

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
  }, [language, setLanguage]);

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