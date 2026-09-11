import { Link } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext";
import siteConfig from "../config/site";
import "./InformationPage.css";

const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL || "support@rotavoy.com";

const content = {
  en: {
    about: ["About Rotavoy", "Rotavoy is an evolving marketplace that brings shopping, travel and local discovery into one experience. The platform is currently in beta; services and availability will expand over time."],
    contact: ["Contact", `Questions, partnership requests and feedback can be sent to ${supportEmail}. We aim to respond as soon as possible during the beta period.`],
    support: ["Support", `For order support, include your order number and the email address used at checkout when contacting ${supportEmail}. Never send a wallet recovery phrase or private key.`],
    privacy: ["Privacy Policy", "Rotavoy processes the information required to provide accounts, orders, payments and customer support. Authentication may be handled by third-party identity providers. Payment transactions made on public blockchains are public by design. We do not sell personal information. Data may be retained where needed for security, fraud prevention, service delivery and legal obligations."],
    terms: ["Terms of Service", "Rotavoy is provided as a beta service. Product availability, prices and features may change. Users must provide accurate order and delivery information and are responsible for activity performed through their accounts and wallets. Orders are accepted only after payment verification and stock confirmation."],
    refund: ["Refund Policy", "Refund eligibility depends on the product, fulfillment status and payment method. Contact support with the order number before returning an item or disputing a delivery. Blockchain network fees and completed irreversible transactions cannot be refunded by Rotavoy. Approved refunds are returned using the method communicated by support."],
    updated: "Last updated: September 11, 2026",
    back: "Back to home",
  },
  tr: {
    about: ["Rotavoy Hakkında", "Rotavoy; alışveriş, seyahat ve yerel keşif deneyimlerini tek platformda birleştirmek üzere geliştirilen bir pazaryeridir. Platform şu anda beta sürecindedir; hizmetler ve kullanılabilirlik zaman içinde genişletilecektir."],
    contact: ["İletişim", `Soru, iş birliği talebi ve geri bildirimlerini ${supportEmail} adresine gönderebilirsin. Beta sürecinde mümkün olan en kısa sürede dönüş yapmayı hedefliyoruz.`],
    support: ["Destek", `Sipariş desteği için ${supportEmail} adresine yazarken sipariş numaranı ve ödeme sırasında kullandığın e-posta adresini ekle. Cüzdan kurtarma kelimelerini veya özel anahtarını asla gönderme.`],
    privacy: ["Gizlilik Politikası", "Rotavoy; hesap, sipariş, ödeme ve müşteri desteği sunmak için gerekli bilgileri işler. Kimlik doğrulama üçüncü taraf sağlayıcılar tarafından gerçekleştirilebilir. Herkese açık blokzincirlerde yapılan ödeme işlemleri yapıları gereği açıktır. Kişisel bilgiler satılmaz. Veriler güvenlik, dolandırıcılığın önlenmesi, hizmet sunumu ve yasal yükümlülükler için gerektiği sürece saklanabilir."],
    terms: ["Kullanım Şartları", "Rotavoy beta hizmeti olarak sunulmaktadır. Ürün bulunabilirliği, fiyatlar ve özellikler değişebilir. Kullanıcılar doğru sipariş ve teslimat bilgisi vermekle, hesapları ve cüzdanları üzerinden gerçekleştirilen işlemlerden sorumludur. Siparişler yalnızca ödeme doğrulaması ve stok onayından sonra kabul edilir."],
    refund: ["İade Politikası", "İade uygunluğu ürüne, siparişin hazırlanma durumuna ve ödeme yöntemine göre değişir. Bir ürünü göndermeden veya teslimata itiraz etmeden önce sipariş numarasıyla destek ekibine ulaş. Blokzincir ağ ücretleri ve tamamlanmış geri döndürülemez işlemler Rotavoy tarafından iade edilemez. Onaylanan iadeler destek ekibinin bildirdiği yöntemle gerçekleştirilir."],
    updated: "Son güncelleme: 11 Eylül 2026",
    back: "Ana sayfaya dön",
  },
};

function InformationPage({ page }) {
  const { language } = useLanguage();
  const localized = content[language] || content.en;
  const [title, body] = localized[page] || localized.about;

  return (
    <main className="informationPage container">
      <p className="informationEyebrow">{siteConfig.brandName} · Beta</p>
      <h1>{title}</h1>
      <p>{body}</p>
      {page !== "about" && <small>{localized.updated}</small>}
      <Link to="/" className="informationBack">← {localized.back}</Link>
    </main>
  );
}

export default InformationPage;
