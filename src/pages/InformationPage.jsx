import { Link } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext";
import siteConfig from "../config/site";
import "./InformationPage.css";

const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL || "support@rotavoy.com";

const content = {
  en: {
    about: ["About Rotavoy", "Rotavoy is a travel-first platform focused on hotel discovery, live room availability and secure reservation flows."],
    contact: ["Contact", `Questions, hotel partnership requests and travel feedback can be sent to ${supportEmail}. We aim to respond as soon as possible.`],
    support: ["Travel Support", `For reservation support, include your Rotavoy booking reference and the email address used during checkout when contacting ${supportEmail}. Never send a wallet recovery phrase or private key.`],
    privacy: ["Privacy Policy", "Rotavoy processes the information required to provide hotel search, reservations, payments, authentication and customer support. Authentication may be handled by third-party identity providers. Payment transactions made on public blockchains are public by design. Personal information is not sold."],
    terms: ["Travel Terms of Service", "Rotavoy provides travel search and booking services. Hotel availability, room conditions, cancellation terms and prices may change until a reservation is confirmed. Users must provide accurate guest and contact information and review the live rate conditions before payment."],
    refund: ["Cancellation & Refund Policy", "Cancellation and refund eligibility depends on the hotel rate and reservation conditions shown during booking. Some rates may be non-refundable. Blockchain network fees and completed irreversible transfers cannot be reversed by Rotavoy. Contact support with your booking reference for eligible cancellation or refund requests."],
    updated: "Last updated: October 4, 2026",
    back: "Back to travel",
  },
  tr: {
    about: ["Rotavoy Hakkında", "Rotavoy; otel keşfi, canlı oda müsaitliği ve güvenli rezervasyon akışına odaklanan travel-first bir platformdur."],
    contact: ["İletişim", `Sorularını, otel iş birliği taleplerini ve seyahat geri bildirimlerini ${supportEmail} adresine gönderebilirsin. Mümkün olan en kısa sürede dönüş yapmayı hedefliyoruz.`],
    support: ["Seyahat Desteği", `Rezervasyon desteği için ${supportEmail} adresine yazarken Rotavoy rezervasyon referansını ve checkout sırasında kullandığın e-posta adresini ekle. Cüzdan kurtarma kelimelerini veya özel anahtarını asla gönderme.`],
    privacy: ["Gizlilik Politikası", "Rotavoy; otel arama, rezervasyon, ödeme, kimlik doğrulama ve müşteri desteği için gereken bilgileri işler. Kimlik doğrulama üçüncü taraf sağlayıcılar üzerinden gerçekleştirilebilir. Herkese açık blokzincirlerdeki ödeme işlemleri yapıları gereği açıktır. Kişisel bilgiler satılmaz."],
    terms: ["Seyahat Kullanım Şartları", "Rotavoy seyahat arama ve rezervasyon hizmeti sunar. Otel müsaitliği, oda koşulları, iptal şartları ve fiyatlar rezervasyon onaylanana kadar değişebilir. Kullanıcı doğru misafir ve iletişim bilgisi vermeli ve ödeme öncesinde güncel fiyat koşullarını kontrol etmelidir."],
    refund: ["İptal ve İade Politikası", "İptal ve iade uygunluğu rezervasyon sırasında gösterilen otel fiyat planı ve rezervasyon koşullarına bağlıdır. Bazı fiyatlar iade edilemez olabilir. Blokzincir ağ ücretleri ve tamamlanmış geri döndürülemez transferler Rotavoy tarafından geri alınamaz. Uygun iptal veya iade talepleri için rezervasyon referansınla desteğe ulaş."],
    updated: "Son güncelleme: 4 Ekim 2026",
    back: "Travel'a dön",
  },
};

function InformationPage({ page }) {
  const { language } = useLanguage();
  const localized = content[language] || content.en;
  const [title, body] = localized[page] || localized.about;

  return (
    <main className="informationPage container">
      <p className="informationEyebrow">{siteConfig.brandName} · Travel</p>
      <h1>{title}</h1>
      <p>{body}</p>
      {page !== "about" && <small>{localized.updated}</small>}
      <Link to="/" className="informationBack">← {localized.back}</Link>
    </main>
  );
}

export default InformationPage;
