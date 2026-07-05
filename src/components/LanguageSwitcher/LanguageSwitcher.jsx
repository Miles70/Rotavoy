import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageContext";
import "./LanguageSwitcher.css";

const languages = [
  { code: "tr", flag: "🇹🇷", label: "Türkçe" },
  { code: "en", flag: "🇬🇧", label: "English" },
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

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
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
        aria-label="Select language"
        aria-expanded={isOpen}
      >
        <span className="languageButtonFlag">{activeLanguage.flag}</span>
        <ChevronDown size={15} />
      </button>

      {isOpen && (
        <div className="languageDropdown">
          {languages.map((item) => (
            <button
              key={item.code}
              className={`languageOption ${
                item.code === language ? "active" : ""
              }`}
              type="button"
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