const fail = message => { throw Object.assign(new Error(message), { statusCode: 400, code: 'INVALID_PASSENGERS' }); };
const text = (value, max = 100) => { if (typeof value !== 'string' || !value.trim() || value.length > max) fail('Yolcu bilgilerini eksiksiz doldur.'); return value.trim(); };
const day = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
export function validateFlightPassengers(input, journey) {
  const c = input?.contact || {};
  const contact = Object.fromEntries(['firstName', 'lastName', 'email', 'phoneCountryCode', 'phoneNumber'].map(k => [k, text(c[k], k === 'email' ? 254 : 100)]));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email) || !/^\d{1,4}$/.test(contact.phoneCountryCode) || !/^[\d\s()-]{5,25}$/.test(contact.phoneNumber)) fail('İletişim e-postası ve telefonunu kontrol et.');
  const passengers = input?.passengers;
  const counts = journey?.passengers || journey?.parameters;
  if (!Array.isArray(passengers) || !passengers.length || passengers.length > 9) fail('Yolcu sayısı geçersiz.');
  if (counts && passengers.length !== Number(counts.adults || 0) + Number(counts.children || 0) + Number(counts.infants || 0)) fail('Yolcu sayısı seçilen uçuşla eşleşmiyor.');
  const departure = journey?.segments?.[0]?.departureTime?.slice(0, 10);
  const lastDate = journey?.segments?.at(-1)?.arrivalTime?.slice(0, 10) || departure;
  if (!day(departure)) fail('Uçuş tarihi doğrulanamadı.');
  const result = passengers.map(p => {
    const person = Object.fromEntries(['firstName', 'lastName', 'birthday', 'gender', 'nationality', 'documentType', 'documentNumber', 'documentIssueCountry', 'documentExpiry'].map(k => [k, text(p[k])]));
    if (!day(person.birthday) || person.birthday > new Date().toISOString().slice(0, 10) || !day(person.documentExpiry) || person.documentExpiry <= lastDate || !['M', 'F'].includes(person.gender) || !['passport', 'id_card'].includes(person.documentType) || !/^[A-Z]{2}$/.test(person.nationality) || !/^[A-Z]{2}$/.test(person.documentIssueCountry)) fail('Yolcu doğum tarihi ve belge bilgilerini kontrol et.');
    let age = Number(departure.slice(0, 4)) - Number(person.birthday.slice(0, 4)); if (departure.slice(5) < person.birthday.slice(5)) age--;
    person.passengerType = age < 2 ? 2 : age < 12 ? 1 : 0;
    if (p.passengerType !== person.passengerType) fail('Yolcu yaşı aramada seçilen yolcu türüyle eşleşmiyor.');
    return person;
  });
  if (counts && [0, 1, 2].some((type, i) => result.filter(p => p.passengerType === type).length !== Number(counts[['adults', 'children', 'infants'][i]] || 0))) fail('Yetişkin, çocuk ve bebek sayısını kontrol et.');
  return { contact, passengers: result };
}
