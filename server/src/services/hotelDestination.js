import { listNuiteeCountries, searchNuiteePlaces } from './nuiteeApi.js';

const languages = ['tr', 'en', 'de', 'fr', 'it', 'es', 'pt', 'ru', 'ar', 'zh'];
const normalize = (value) => String(value || '').toLowerCase().normalize('NFD')
  .replace(/\p{M}/gu, '').replace(/ı/g, 'i').replace(/[^\p{L}\p{N}]/gu, '');
let countryIndex;
let expiresAt = 0;
let pendingCountries;
const locations = new Map();

export async function resolveHotelDestination(destination) {
  const key = normalize(destination);
  const cached = locations.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.location;
  if (!countryIndex || expiresAt < Date.now()) {
    pendingCountries ||= listNuiteeCountries().then((response) => {
      const index = new Map();
      const displays = languages.map((language) => new Intl.DisplayNames([language], { type: 'region' }));
      for (const country of response.data || []) {
        const code = String(country.code || country.countryCode || country.iso2 || '').toUpperCase();
        if (!/^[A-Z]{2}$/.test(code)) continue;
        for (const name of [code, country.name, country.countryName, ...displays.map((display) => display.of(code))]) {
          if (name) index.set(normalize(name), { countryCode: code });
        }
      }
      for (const [name, code] of Object.entries({ amerika: 'US', abd: 'US', usa: 'US', uk: 'GB', ingiltere: 'GB', uae: 'AE', bae: 'AE', turkiye: 'TR', turkey: 'TR' })) {
        if (index.has(normalize(code))) index.set(name, { countryCode: code });
      }
      countryIndex = index;
      expiresAt = Date.now() + 24 * 60 * 60 * 1000;
    }).finally(() => { pendingCountries = undefined; });
    await pendingCountries;
  }
  let location = countryIndex.get(key);
  if (!location) {
    const response = await searchNuiteePlaces(destination);
    const places = response.data || [];
    const place = places.find((item) => normalize(typeof item.displayName === 'object' ? item.displayName.text : item.displayName) === key) || places[0];
    if (!place?.placeId) {
      const error = new Error('Destination not found. Try a city and country name.');
      error.statusCode = 400;
      throw error;
    }
    location = { placeId: place.placeId };
  }
  if (locations.size >= 200) locations.delete(locations.keys().next().value);
  locations.set(key, { location, expiresAt: Date.now() + 60 * 60 * 1000 });
  return location;
}
