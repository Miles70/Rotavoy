export const SITE_URL = 'https://www.rotavoy.com';
export const SEO_LANGUAGES = ['en', 'tr', 'ru', 'ar', 'zh', 'es', 'pt', 'fr', 'de', 'it'];
export const LANGUAGE_NAMES = { en: 'English', tr: 'Türkçe', ru: 'Русский', ar: 'العربية', zh: '中文', es: 'Español', pt: 'Português (Brasil)', fr: 'Français', de: 'Deutsch', it: 'Italiano' };
export const languageTag = language => language === 'pt' ? 'pt-BR' : language;
export function travelLandingPath(category, language = 'en') {
  if (!['hotels', 'flights'].includes(category)) return `/${category}`;
  return `${SEO_LANGUAGES.includes(language) && language !== 'en' ? `/${language}` : ''}/${category}`;
}
export function travelLanding(pathname) {
  const match = String(pathname).match(/^\/(?:(en|tr|ru|ar|zh|es|pt|fr|de|it)\/)?(hotels|flights)\/?$/);
  return match ? { language: match[1] || 'en', category: match[2], path: travelLandingPath(match[2], match[1] || 'en') } : null;
}
export function travelAlternates(category) {
  return [...SEO_LANGUAGES.map(language => ({ language: languageTag(language), path: travelLandingPath(category, language) })), { language: 'x-default', path: travelLandingPath(category) }];
}
export const TRAVEL_LANDINGS = SEO_LANGUAGES.flatMap(language => ['hotels', 'flights'].map(category => ({ language, category, path: travelLandingPath(category, language) })));
