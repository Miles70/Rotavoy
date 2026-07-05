import { useLanguage } from "../../i18n/LanguageContext";
import "./Newsletter.css";

function Newsletter() {
  const { t } = useLanguage();

  return (
    <section className="newsletter">
      <div className="container newsletterInner">
        <div className="newsletterContent">
          <p className="sectionTag">{t("newsletter.tag")}</p>
          <h2>{t("newsletter.title")}</h2>
          <p>{t("newsletter.text")}</p>
        </div>

        <form className="newsletterForm">
          <input type="email" placeholder={t("newsletter.placeholder")} />
          <button type="submit">{t("newsletter.button")}</button>
        </form>
      </div>
    </section>
  );
}

export default Newsletter;