import en from "./locales/en";
import tr from "./locales/tr";
import ru from "./locales/ru";
import ar from "./locales/ar";
import zh from "./locales/zh";
import es from "./locales/es";
import pt from "./locales/pt";
import fr from "./locales/fr";
import de from "./locales/de";
import paymentTranslations from "./paymentTranslations";
import authTranslations from "./authTranslations";
import accountTranslations from "./accountTranslations";
import localTranslations from "./localTranslations";
import regionalSharedTranslations from "./regionalSharedTranslations";

function withSharedTranslations(baseTranslations, language) {
  const regional = regionalSharedTranslations[language];
  const payment =
    regional?.payment || paymentTranslations[language] || paymentTranslations.en;
  const auth = regional?.auth || authTranslations[language] || authTranslations.en;
  const account =
    regional?.account || accountTranslations[language] || accountTranslations.en;
  const local = regional?.local || localTranslations[language] || localTranslations.en;

  return {
    ...baseTranslations,
    nav: {
      ...baseTranslations.nav,
      ...local.nav,
    },
    auth,
    account,
    localPage: local.localPage,
    checkoutPage: {
      ...baseTranslations.checkoutPage,
      ...payment.checkoutPage,
    },
    orderSuccessPage: {
      ...baseTranslations.orderSuccessPage,
      ...payment.orderSuccessPage,
    },
  };
}

const translations = {
  en: withSharedTranslations(en, "en"),
  tr: withSharedTranslations(tr, "tr"),
  ru: withSharedTranslations(ru, "ru"),
  ar: withSharedTranslations(ar, "ar"),
  zh: withSharedTranslations(zh, "zh"),
  es: withSharedTranslations(es, "es"),
  pt: withSharedTranslations(pt, "pt"),
  fr: withSharedTranslations(fr, "fr"),
  de: withSharedTranslations(de, "de"),
};

export default translations;
