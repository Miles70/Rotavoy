import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageContext";
import "./LanguageSwitcher.css";

const languages = [
  { code: "tr", flag: "🇹🇷", label: "Türkçe" },
  { code: "en", flag: "🇬🇧", label: "English" },
  { code: "es", flag: "🇪🇸", label: "Español" },
  { code: "pt", flag: "🇧🇷", label: "Português (Brasil)" },
  { code: "fr", flag: "🇫🇷", label: "Français" },
  { code: "de", flag: "🇩🇪", label: "Deutsch" },
  { code: "it", flag: "🇮🇹", label: "Italiano" },
  { code: "ru", flag: "🇷🇺", label: "Русский" },
  { code: "ar", flag: "🇸🇦", label: "العربية" },
  { code: "zh", flag: "🇨🇳", label: "中文" },
];

function LanguageSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const { language, setLanguage } = useLanguage();

  const activeLanguage =
    languages.find((item) => item.code === language) || languages[1];

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  function handleSelect(code) {
    setLanguage(code);
    setIsOpen(false);
  }

  return (
    <div className="languageSwitcher" ref={menuRef}>
      <button
        className="languageButton"
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-label={`Language: ${activeLanguage.label}`}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        title={activeLanguage.label}
      >
        <span className="languageButtonFlag">{activeLanguage.flag}</span>
        <ChevronDown size={15} />
      </button>

      {isOpen && (
        <div
          className="languageDropdown"
          role="listbox"
          aria-label="Languages"
        >
          {languages.map((item) => (
            <button
              key={item.code}
              className={`languageOption ${
                item.code === language ? "active" : ""
              }`}
              type="button"
              role="option"
              aria-selected={item.code === language}
              onClick={() => handleSelect(item.code)}
            >
              <span className="languageOptionFlag">{item.flag}</span>
              <span className="languageOptionLabel">{item.label}</span>

              {item.code === language && (
                <Check className="languageCheck" size={16} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default LanguageSwitcher;