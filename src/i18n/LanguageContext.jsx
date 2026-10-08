import { useLocation, useNavigate } from 'react-router-dom';
import { travelLanding, travelLandingPath } from '../../shared/travelSeo';
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
  let savedLanguage;
  try { savedLanguage = localStorage.getItem("language"); } catch { /* Storage is optional. */ }

  if (supportedLanguages.includes(savedLanguage)) {
    return savedLanguage;
  }

  const browserLanguage = (typeof navigator !== "undefined" ? navigator.language : "") || "";

  return normalizeLanguage(browserLanguage);
}

export function RoutedLanguageProvider({ children }) {
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();
  return <LanguageProvider pathname={pathname} search={search} hash={hash} navigate={navigate}>{children}</LanguageProvider>;
}
export function LanguageProvider({ children, pathname = '', search = '', hash = '', navigate }) {
  const [preferredLanguage, setLanguageState] = useState(detectInitialLanguage);
  // Public landing URLs are authoritative; saved preferences still apply to legacy/checkout routes.
  const urlLanguage = travelLanding(pathname)?.language;
  const language = urlLanguage || preferredLanguage;
  useEffect(() => {
    if (!urlLanguage) return;
    setLanguageState(urlLanguage);
    try { localStorage.setItem('language', urlLanguage); } catch { /* URL still determines the language. */ }
  }, [urlLanguage]);

  useEffect(() => {
    document.documentElement.lang = language === "pt" ? "pt-BR" : language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  }, [language]);

  const setLanguage = useCallback((nextLanguage) => {
    if (!supportedLanguages.includes(nextLanguage)) return;
    try { localStorage.setItem('language', nextLanguage); } catch { /* In-memory preference still works. */ }
    setLanguageState(nextLanguage);
    const landing = travelLanding(pathname);
    if (landing && navigate) navigate({ pathname: travelLandingPath(landing.category, nextLanguage), search, hash });
  }, [pathname, search, hash, navigate]);

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