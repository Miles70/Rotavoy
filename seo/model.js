import { copy, languages, interpolate } from './copy.js';
import { destinations, airports, routes } from './destinations.js';
export const SITE_URL = 'https://www.rotavoy.com';
export const languagePath = (lang, suffix = '') => `/${lang}${suffix ? `/${suffix}` : ''}`;
export const routeSlug = route => `${route.from.toLowerCase()}-${route.to.toLowerCase()}`;
export const eligibleHotel = h => h.published === true && h.source?.provider === 'Nuitee/LiteAPI' && h.source?.environment === 'production' && /^lp[a-z0-9]+$/.test(h.id) && h.name && h.address && h.image && h.source.descriptionHash && !h.deletedAt && languages.every(lang => typeof h.descriptions?.[lang] === 'string' && h.descriptions[lang].trim().length >= 60);
export function buildPages(hotels) {
 const catalog = hotels.filter(eligibleHotel);
 const activeDestinations = destinations.filter(d => catalog.filter(h => h.destination === d.slug).length >= 3);
 const pages = [];
 for (const lang of languages) {
  const c = copy[lang];
  const hotelCards = catalog.map(h => ({ title: h.name, href: languagePath(lang, `travel/hotels/${h.id}`), image: h.image, text: h.descriptions[lang].slice(0, 200), stars: h.stars }));
  const destinationLinks = activeDestinations.map(d => ({ title: interpolate(c.destinationTitle, { city: d.names[lang] }), href: languagePath(lang, `hotels/${d.slug}`) }));
  const routeLinks = routes.map(r => ({ title: interpolate(c.routeTitle, { from: airports[r.from].names[lang], to: airports[r.to].names[lang] }), href: languagePath(lang, `flights/${routeSlug(r)}`) }));
  const add = (suffix, data) => {
   const path = languagePath(lang, suffix);
   const alternates = [...languages.map(language => ({ language, path: languagePath(language, suffix) })), { language: 'x-default', path: languagePath('en', suffix) }];
   pages.push({ lang, path, suffix, alternates, destinationLinks, routeLinks, ...data });
  };
  add('', { kind: 'home', title: c.homeTitle, description: `${c.destinationIntro.replace('{city}', activeDestinations.map(d => d.names[lang]).join(', '))} ${c.flightHelp}`, cards: hotelCards.slice(0, 12), intro: c.hotelHelp });
  add('hotels', { kind: 'hotels', title: c.hotels, description: c.hotelHelp, intro: c.hotelHelp, cards: hotelCards.slice(0, 12), cta: { href: `/hotels?lang=${lang}`, title: c.hotelCta } });
  add('flights', { kind: 'flights', title: c.flights, description: c.flightHelp, intro: c.flightHelp, cards: routeLinks, cta: { href: `/flights?lang=${lang}`, title: c.flightCta } });
  for (const d of activeDestinations) {
   const city = d.names[lang];
   const destinationCards = hotelCards.filter((_, i) => catalog[i].destination === d.slug);
   const count = Math.ceil(destinationCards.length / 24);
   const pagination = Array.from({ length: count }, (_, i) => ({ title: String(i + 1), href: languagePath(lang, `hotels/${d.slug}${i ? `/page/${i + 1}` : ''}`) }));
   for (let i = 0; i < count; i++) {
    add(`hotels/${d.slug}${i ? `/page/${i + 1}` : ''}`, { kind: 'destination', title: interpolate(c.destinationTitle, { city }) + (i ? ` · ${i + 1}` : ''), description: interpolate(c.destinationIntro, { city }), intro: interpolate(c.destinationIntro, { city }), cards: destinationCards.slice(i * 24, (i + 1) * 24), pagination, cta: { href: `/hotels?${new URLSearchParams({ cityName: `${d.names.en}, ${d.country}`, lang })}`, title: c.hotelCta } });
   }
  }
  for (const h of catalog) {
   const hotel = Object.fromEntries(Object.entries(h).filter(([key]) => !["source", "descriptions"].includes(key)));
   add(`travel/hotels/${h.id}`, { kind: 'hotel', title: h.name, description: h.descriptions[lang], intro: h.descriptions[lang], hotel, cards: hotelCards.filter((card, i) => catalog[i].destination === h.destination && !card.href.endsWith(`/${h.id}`)).slice(0, 6), cta: { href: `/travel/hotels/${h.id}?lang=${lang}`, title: c.hotelCta }, modified: h.reviewedAt });
  }
  for (const r of routes) {
   const from = airports[r.from], to = airports[r.to];
   add(`flights/${routeSlug(r)}`, { kind: 'route', title: interpolate(c.routeTitle, { from: from.names[lang], to: to.names[lang] }), description: `${from.names[lang]} (${r.from}) → ${to.names[lang]} (${r.to}). ${c.flightHelp}`, intro: c.flightHelp, route: { ...r, originName: from.names[lang], destinationName: to.names[lang], originAirport: from.airport, destinationAirport: to.airport }, cards: routeLinks.filter(link => !link.href.endsWith(routeSlug(r))), cta: { href: `/flights?${new URLSearchParams({ origin: r.from, originName: from.names[lang], destination: r.to, destinationName: to.names[lang], lang })}`, title: c.flightCta } });
  }
 }
 return pages;
}
export function structuredData(page) {
 const url = SITE_URL + page.path;
 const c = copy[page.lang];
 const graph = [{ '@type': 'WebPage', '@id': url, url, name: page.title, description: page.description, inLanguage: page.lang }, { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: c.home, item: SITE_URL + languagePath(page.lang) }, ...(page.kind === 'home' ? [] : [{ '@type': 'ListItem', position: 2, name: page.title, item: url }])] }];
 if (page.hotel) {
  const h = page.hotel;
  graph.push({ '@type': 'Hotel', '@id': `${url}#hotel`, name: h.name, url, description: page.intro, image: h.image, address: { '@type': 'PostalAddress', streetAddress: h.address, addressLocality: h.city, addressCountry: h.country }, ...(Number.isFinite(h.stars) && h.stars > 0 && h.stars <= 5 ? { starRating: { '@type': 'Rating', ratingValue: h.stars } } : {}), ...(Number.isFinite(h.latitude) && Number.isFinite(h.longitude) ? { geo: { '@type': 'GeoCoordinates', latitude: h.latitude, longitude: h.longitude } } : {}) });
 }
 if (page.cards?.length) graph.push({ '@type': 'ItemList', itemListElement: page.cards.map((card, i) => ({ '@type': 'ListItem', position: i + 1, name: card.title, url: SITE_URL + card.href })) });
 return { '@context': 'https://schema.org', '@graph': graph };
}
