import { Link } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext";
import siteConfig from "../config/site";
import "./InformationPage.css";

const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL || "support@rotavoy.com";

const content = {
 en: {
 about: ['About Rotavoy', 'Discover hotels and destinations with Rotavoy. Share your travel preferences and request a personalised quote.'],
 contact: ['Contact', `Send questions and travel enquiries to ${supportEmail}.`],
 support: ['Travel Support', `Contact ${supportEmail} with your request reference and email address.`],
 privacy: ['Privacy Policy', 'We process your contact details, travel preferences and enquiry notes to respond to your request. We also collect browsing events and approximate location information for site analytics. Authentication may use third-party providers. Personal information is not sold. Contact support to request access or deletion.'],
 terms: ['Travel Terms', 'Rotavoy currently accepts travel enquiries. Submitting a request does not confirm a reservation. Price and availability are checked separately and communicated before any booking. Online payments are not collected.'],
 refund: ['Cancellation & Refunds', 'Travel requests are free and involve no payment. You may withdraw a request by contacting support with your reference. Conditions for any future reservation will be communicated before confirmation.'],
 updated: 'Last updated: October 5, 2026', back: 'Back to travel'
 },
 tr: {
 about: ['Rotavoy Hakkında', 'Rotavoy ile otelleri ve destinasyonları keşfet. Seyahat tercihlerini paylaşarak sana özel teklif talep et.'],
 contact: ['İletişim', `Sorularını ve seyahat taleplerini ${supportEmail} adresine gönderebilirsin.`],
 support: ['Seyahat Desteği', `${supportEmail} adresine yazarken talep referansını ve e-posta adresini ekle.`],
 privacy: ['Gizlilik Politikası', 'İletişim bilgilerin, seyahat tercihlerin ve talep notların sana dönüş yapmak için işlenir. Site analitiği için gezinme olayları ve yaklaşık konum bilgisi de toplanır. Giriş işlemleri üçüncü taraf sağlayıcıları kullanabilir. Kişisel bilgiler satılmaz. Bilgilerine erişim veya silme talebi için desteğe ulaşabilirsin.'],
 terms: ['Seyahat Kullanım Şartları', 'Rotavoy şu aşamada seyahat talebi toplar. Talep göndermek rezervasyon onayı oluşturmaz. Fiyat ve müsaitlik ayrıca kontrol edilerek rezervasyon öncesinde sana bildirilir. Online ödeme alınmaz.'],
 refund: ['İptal ve İade', 'Seyahat talepleri ücretsizdir ve ödeme içermez. Referansınla desteğe yazarak talebini geri çekebilirsin. İleride oluşturulacak rezervasyonların koşulları onay öncesinde paylaşılır.'],
 updated: 'Son güncelleme: 5 Ekim 2026', back: 'Seyahat sayfasına dön'
 }
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
