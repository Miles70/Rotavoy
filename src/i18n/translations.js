import en from "./locales/en";
import tr from "./locales/tr";
import ru from "./locales/ru";
import ar from "./locales/ar";
import zh from "./locales/zh";
import paymentTranslations from "./paymentTranslations";
import authTranslations from "./authTranslations";

function withSharedTranslations(baseTranslations, language) {
  const payment = paymentTranslations[language] || paymentTranslations.en;
  const auth = authTranslations[language] || authTranslations.en;

  return {
    ...baseTranslations,
    auth,
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
};

export default translations;
