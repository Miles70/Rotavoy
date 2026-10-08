import { SITE_URL } from './model.js';
import { copy } from './copy.js';
export const searchKeys = ['cityName','checkin','checkout','adults','children','infants','departure','returnDate','origin','destination','originName','destinationName','offerId','auto','latitude','longitude','placeId','cabinClass','currency','country','reference','bookingReference','prebookId'];
const generalSeo = {
 en: {
  '/about': ['About Rotavoy', 'Learn about Rotavoy, a travel platform for hotel discovery and reservations.'],
  '/contact': ['Contact', 'Contact Rotavoy for travel, hotel partnerships and reservation questions.'],
  '/support': ['Travel Support', 'Get help with Rotavoy searches, reservations and payments.'],
  '/privacy': ['Privacy Policy', 'Read how Rotavoy handles information for travel, payments and authentication.'],
  '/terms': ['Travel Terms of Service', 'Read the terms for Rotavoy hotel search and reservations.'],
  '/refund': ['Cancellation & Refund Policy', 'Read cancellation and refund information for Rotavoy reservations.'],
 },
 tr: {
  '/about': ['Rotavoy Hakkında', 'Rotavoy otel keşfi ve rezervasyon platformunu tanı.'],
  '/contact': ['İletişim', 'Seyahat, otel iş birliği ve rezervasyon soruların için Rotavoy ile iletişime geç.'],
  '/support': ['Seyahat Desteği', 'Rotavoy arama, rezervasyon ve ödeme işlemleri için destek al.'],
  '/privacy': ['Gizlilik Politikası', 'Rotavoy seyahat, ödeme ve kimlik doğrulama bilgilerinin nasıl işlendiğini incele.'],
  '/terms': ['Seyahat Kullanım Şartları', 'Rotavoy otel arama ve rezervasyon hizmetinin kullanım şartlarını incele.'],
  '/refund': ['İptal ve İade Politikası', 'Rotavoy rezervasyonları için iptal ve iade bilgilerini incele.'],
 },
};
export function appPolicy(pathname, search = '', catalog = []) {
 const params = new URLSearchParams(search);
 const lang = Object.hasOwn(copy, params.get('lang')) ? params.get('lang') : 'en';
 const empty = [...params.keys()].every(key => key.startsWith('utm_') || key === 'gclid');
 if (pathname === '/travel') return { redirect: `/${search ? `?${params}` : ''}` };
 if (empty && ['/hotels', '/flights'].includes(pathname)) return { redirect: `/${lang}${pathname}${search ? `?${params}` : ''}` };
 const hotelMatch = pathname.match(/^\/travel\/hotels\/(lp[a-z0-9]+)$/);
 if (empty && hotelMatch && catalog.includes(hotelMatch[1])) return { redirect: `/${lang}/travel/hotels/${hotelMatch[1]}${search ? `?${params}` : ''}` };
 const general = ['/', '/about', '/contact', '/support', '/privacy', '/terms', '/refund', '/cars', '/activities'];
 const privatePage = /^\/(admin(?:\/.*)?|account|travel\/checkout|flights\/checkout)$/.test(pathname);
 const liveHotel = /^\/travel\/hotels\/[^/]+$/.test(pathname);
 const known = general.includes(pathname) || privatePage || liveHotel || ['/hotels', '/flights'].includes(pathname);
 const userSearch = searchKeys.some(key => params.has(key));
 const noIndex = privatePage || liveHotel || ['/hotels', '/flights', '/cars', '/activities'].includes(pathname) || userSearch || !known;
 const c = copy[lang];
 const information = (generalSeo[lang] || generalSeo.en)[pathname];
 const title = information?.[0] || (!known ? '404 | Rotavoy' : pathname.startsWith('/flights') ? c.flights : pathname.startsWith('/hotels') || liveHotel ? c.hotels : c.homeTitle);
 const canonicalPath = liveHotel && hotelMatch && catalog.includes(hotelMatch[1]) ? `/${lang}/travel/hotels/${hotelMatch[1]}` : ['/hotels','/flights'].includes(pathname) ? `/${lang}${pathname}` : pathname === "/" ? "/en" : pathname;
 return { status: known ? 200 : 404, noIndex, title: `${title} | Rotavoy`, description: information?.[1] || (pathname.startsWith('/flights') ? c.flightHelp : c.hotelHelp), canonical: SITE_URL + canonicalPath };
}
