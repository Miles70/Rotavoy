import { Search } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageContext";
import "./SearchBar.css";

function SearchBar() {
  const { t } = useLanguage();

  return (
    <form className="searchBar">
      <Search size={20} />
      <input type="text" placeholder={t("search.placeholder")} />
      <button type="submit">{t("search.button")}</button>
    </form>
  );
}

export default SearchBar;