import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageContext";
import { getStoreProducts } from "../../services/productsApi";
import "./SearchBar.css";

function categoryLabel(categoryKey, t) {
  if (!categoryKey) return "General";

  const translationKey = `categories.${categoryKey}.title`;
  const translated = t(translationKey);

  if (translated !== translationKey) return translated;

  return categoryKey
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function SearchBar({ initialValue = "" }) {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState(initialValue);
  const [isFocused, setIsFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [suggestions, setSuggestions] = useState([]);

  const query = searchValue.trim();

  useEffect(() => {
    setSearchValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    let isCancelled = false;

    if (query.length < 2) {
      setSuggestions([]);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      getStoreProducts({ page: 1, limit: 8, search: query, language })
        .then((data) => {
          if (!isCancelled) {
            setSuggestions(
              (data.products || []).slice(0, 6).map((product) => ({
                ...product,
                categoryTitle: categoryLabel(product.categoryKey, t),
              })),
            );
          }
        })
        .catch(() => {
          if (!isCancelled) setSuggestions([]);
        });
    }, 250);

    return () => {
      isCancelled = true;
      window.clearTimeout(timer);
    };
  }, [language, query, t]);

  const shouldShowSuggestions = isFocused && suggestions.length > 0;

  function goToSearch(value) {
    const cleanValue = value.trim();

    if (!cleanValue) {
      navigate("/products");
      return;
    }

    navigate(`/products?search=${encodeURIComponent(cleanValue)}&page=1`);
    setIsFocused(false);
    setActiveIndex(-1);
  }

  function goToProduct(product) {
    setSearchValue(product.title);
    setIsFocused(false);
    setActiveIndex(-1);
    navigate(`/products/${encodeURIComponent(product.key)}`);
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (activeIndex >= 0 && suggestions[activeIndex]) {
      goToProduct(suggestions[activeIndex]);
      return;
    }

    goToSearch(searchValue);
  }

  function handleKeyDown(event) {
    if (!shouldShowSuggestions) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((currentIndex) =>
        currentIndex >= suggestions.length - 1 ? 0 : currentIndex + 1,
      );
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((currentIndex) =>
        currentIndex <= 0 ? suggestions.length - 1 : currentIndex - 1,
      );
    }

    if (event.key === "Escape") {
      setIsFocused(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div className="searchBarWrap">
      <form className="searchBar" onSubmit={handleSubmit}>
        <Search size={20} />

        <input
          type="search"
          value={searchValue}
          placeholder={t("search.placeholder")}
          autoComplete="off"
          spellCheck="false"
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            window.setTimeout(() => {
              setIsFocused(false);
              setActiveIndex(-1);
            }, 120);
          }}
          onChange={(event) => {
            setSearchValue(event.target.value);
            setActiveIndex(-1);
          }}
          onKeyDown={handleKeyDown}
        />

        <button type="submit">{t("search.button")}</button>
      </form>

      {shouldShowSuggestions ? (
        <div className="searchSuggestions">
          {suggestions.map((product, index) => (
            <button
              type="button"
              key={product.key}
              className={index === activeIndex ? "searchSuggestion active" : "searchSuggestion"}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => goToProduct(product)}
            >
              <span className="suggestionIcon">
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt="" loading="lazy" />
                ) : (
                  product.image || product.title?.charAt(0)?.toUpperCase() || "K"
                )}
              </span>

              <span className="suggestionContent">
                <strong>{product.title}</strong>
                <small>{product.categoryTitle}</small>
              </span>

              <span className="suggestionPrice">
                ${Number(product.price || 0).toLocaleString("en-US")}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default SearchBar;
