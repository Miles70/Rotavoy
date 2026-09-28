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

const travelAuthOverrides = {
  en: {
    modalText: "Sign in to keep your travel access and continue reservations across devices.",
    guestNote: "Guest access is available for browsing and reservation checkout.",
    signedInText: "Your travel account is ready.",
    guestText: "You are continuing as a guest traveler.",
  },
  tr: {
    modalText: "Seyahat erişimini korumak ve rezervasyonlarına farklı cihazlardan devam etmek için giriş yap.",
    guestNote: "Otel arama ve rezervasyon checkout akışında misafir erişimi kullanılabilir.",
    signedInText: "Seyahat hesabın hazır.",
    guestText: "Misafir yolcu olarak devam ediyorsun.",
  },
  ru: {
    modalText: "Войдите, чтобы сохранить доступ к поездкам и продолжать бронирования на разных устройствах.",
    guestNote: "Поиск отелей и оформление бронирования доступны и в гостевом режиме.",
    signedInText: "Ваш аккаунт для путешествий готов.",
    guestText: "Вы продолжаете как гость.",
  },
  ar: {
    modalText: "سجّل الدخول للاحتفاظ بوصولك إلى السفر ومتابعة حجوزاتك عبر الأجهزة.",
    guestNote: "يمكن استخدام وضع الضيف للبحث عن الفنادق وإتمام الحجز.",
    signedInText: "حساب السفر الخاص بك جاهز.",
    guestText: "أنت تتابع كمسافر ضيف.",
  },
  zh: {
    modalText: "登录后可保留旅行访问权限，并在不同设备上继续预订。",
    guestNote: "酒店搜索和预订结账支持访客模式。",
    signedInText: "你的旅行账户已准备就绪。",
    guestText: "你正在以访客身份继续。",
  },
  es: {
    modalText: "Inicia sesión para conservar tu acceso de viaje y continuar reservas entre dispositivos.",
    guestNote: "Puedes buscar hoteles y completar reservas como invitado.",
    signedInText: "Tu cuenta de viaje está lista.",
    guestText: "Continúas como viajero invitado.",
  },
  pt: {
    modalText: "Entre para manter seu acesso de viagem e continuar reservas em outros dispositivos.",
    guestNote: "A busca de hotéis e o checkout de reservas estão disponíveis como visitante.",
    signedInText: "Sua conta de viagem está pronta.",
    guestText: "Você está continuando como viajante convidado.",
  },
  fr: {
    modalText: "Connectez-vous pour conserver votre accès voyage et poursuivre vos réservations sur plusieurs appareils.",
    guestNote: "La recherche d’hôtels et la réservation restent disponibles en mode invité.",
    signedInText: "Votre compte voyage est prêt.",
    guestText: "Vous continuez en tant que voyageur invité.",
  },
  de: {
    modalText: "Melde dich an, um deinen Reisezugang zu behalten und Buchungen geräteübergreifend fortzusetzen.",
    guestNote: "Hotelsuche und Buchungs-Checkout sind auch als Gast verfügbar.",
    signedInText: "Dein Reisekonto ist bereit.",
    guestText: "Du fährst als Gast fort.",
  },
  it: {
    modalText: "Accedi per mantenere il tuo accesso viaggio e continuare le prenotazioni su più dispositivi.",
    guestNote: "Ricerca hotel e checkout della prenotazione sono disponibili anche come ospite.",
    signedInText: "Il tuo account di viaggio è pronto.",
    guestText: "Stai continuando come viaggiatore ospite.",
  },
};

function withTravelTranslations(baseTranslations, language) {
  const payment = travelPaymentTranslations[language] || travelPaymentTranslations.en;
  const auth = travelAuthTranslations[language] || travelAuthTranslations.en;

  return {
    ...baseTranslations,
    auth: {
      ...auth,
      ...(travelAuthOverrides[language] || travelAuthOverrides.en),
    },
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
