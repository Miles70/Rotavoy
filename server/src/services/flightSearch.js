function invalid() {
  const error = new Error('Invalid flight search.');
  error.statusCode = 400;
  error.code = 'INVALID_SEARCH';
  throw error;
}
export function validateFlightSearch(input, today = new Date().toISOString().slice(0, 10)) {
  const { origin, destination, departure, returnDate, adults, children = 0, infants = 0, cabinClass = 'ECONOMY', currency = 'USD', country = 'TR' } = input || {};
  const validDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  if (!/^[A-Z]{3}$/.test(origin || '') || !/^[A-Z]{3}$/.test(destination || '') || origin === destination || !validDate(departure) || departure < today) invalid();
  if (returnDate && (!validDate(returnDate) || returnDate < departure)) invalid();
  if (![adults, children, infants].every(Number.isInteger) || adults < 1 || children < 0 || infants < 0 || infants > adults || adults + children + infants > 9) invalid();
  if (!['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST'].includes(cabinClass) || !['USD', 'EUR', 'TRY', 'GBP'].includes(currency) || !/^[A-Z]{2}$/.test(country)) invalid();
  return {
    legs: [{ origin, destination, date: departure, direction: 'OUTBOUND' }, ...(returnDate ? [{ origin: destination, destination: origin, date: returnDate, direction: 'INBOUND' }] : [])],
    adults, children, infants, cabinClass, currency, country,
  };
}
