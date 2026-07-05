import { useLanguage } from "../../i18n/LanguageContext";
import "./Deals.css";

function Deals() {
  const { t } = useLanguage();

  return (
    <section className="deals">
      <div className="container dealsInner">
        <div>
          <p className="sectionTag">{t("deals.tag")}</p>
          <h2>{t("deals.title")}</h2>
          <p>{t("deals.text")}</p>
        </div>

        <button className="dealsButton">{t("deals.button")}</button>
      </div>
    </section>
  );
}

export default Deals;