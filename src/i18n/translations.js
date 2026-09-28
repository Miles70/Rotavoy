import en from "./locales/en";
import tr from "./locales/tr";
import ru from "./locales/ru";
import ar from "./locales/ar";
import zh from "./locales/zh";
import es from "./locales/es";
import pt from "./locales/pt";
import fr from "./locales/fr";
import de from "./locales/de";
import it from "./locales/it";
import travelPaymentTranslations from "./travelPaymentTranslations";
import travelAuthTranslations from "./travelAuthTranslations";
import hotelDetailTranslations from "./hotelDetailTranslations";
import travelRuntimeTranslations from "./travelRuntimeTranslations";

function withTravelTranslations(baseTranslations, language) {
  const payment = travelPaymentTranslations[language] || travelPaymentTranslations.en;
  const auth = travelAuthTranslations[language] || travelAuthTranslations.en;

  return {
    ...baseTranslations,
    auth,
    hotelDetail: hotelDetailTranslations[language] || hotelDetailTranslations.en,
    travelPage: {
      ...baseTranslations.travelPage,
      runtime: travelRuntimeTranslations[language] || travelRuntimeTranslations.en,
    },
    orderSuccessPage: payment,
  };
}

const translations = {
  en: withTravelTranslations(en, "en"),
  tr: withTravelTranslations(tr, "tr"),
  ru: withTravelTranslations(ru, "ru"),
  ar: withTravelTranslations(ar, "ar"),
  zh: withTravelTranslations(zh, "zh"),
  es: withTravelTranslations(es, "es"),
  pt: withTravelTranslations(pt, "pt"),
  fr: withTravelTranslations(fr, "fr"),
  de: withTravelTranslations(de, "de"),
  it: withTravelTranslations(it, "it"),
};

export default translations;
