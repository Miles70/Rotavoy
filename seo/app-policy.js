import { SITE_URL } from './model.js';
import { copy } from './copy.js';
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
 const userSearch = ['cityName','checkin','checkout','adults','departure','returnDate','origin','destination','offerId','auto','latitude','longitude','placeId'].some(key => params.has(key));
 const noIndex = privatePage || liveHotel || ['/hotels', '/flights', '/cars', '/activities'].includes(pathname) || userSearch || !known;
 const c = copy[lang];
 const title = !known ? '404 | Rotavoy' : pathname.startsWith('/flights') ? c.flights : pathname.startsWith('/hotels') || liveHotel ? c.hotels : c.homeTitle;
 const canonicalPath = liveHotel && hotelMatch && catalog.includes(hotelMatch[1]) ? `/${lang}/travel/hotels/${hotelMatch[1]}` : ['/hotels','/flights'].includes(pathname) ? `/${lang}${pathname}` : pathname === "/" ? "/en" : pathname;
 return { status: known ? 200 : 404, noIndex, title: `${title} | Rotavoy`, description: pathname.startsWith('/flights') ? c.flightHelp : c.hotelHelp, canonical: SITE_URL + canonicalPath };
}
