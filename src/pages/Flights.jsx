import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Hotel, Plane, Search, LoaderCircle, Luggage } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import flightTranslations from '../i18n/flightTranslations';
import AirportInput from '../components/Flights/AirportInput';
import { flightRequest } from '../services/flightsApi';
import { flightLocalTime, flightResults, flightStops } from '../services/flightResults';
import './Flights.css';

const regionCodes = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');
function localDate(days = 0) {
  const date = new Date(); date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function FlightCard({ result, copy, language }) {
  const money = new Intl.NumberFormat(language, { style: 'currency', currency: result.currency }).format(result.total);
  const bags = result.offer.baggage?.included || [];
  return <article className="flightCard">
    <div className="flightItinerary">
      {['OUTBOUND', 'INBOUND'].map((direction) => {
        const segments = result.segments.filter((segment) => (segment.direction || 'OUTBOUND') === direction);
        if (!segments.length) return null;
        const stops = flightStops(segments);
        return <section className="flightLeg" key={direction}>
          <div className="flightLegHeading"><strong>{direction === 'OUTBOUND' ? copy.outbound : copy.inbound}</strong><span>{stops === 0 ? copy.nonstop : `${copy.stops}: ${stops}`}</span></div>
          {segments.map((segment, index) => <div className="flightSegment" key={segment.segmentKey || index}>
            <p className="flightCarrier"><Plane size={17} aria-hidden="true" />{segment.carrier?.marketingName || segment.carrier?.marketingCode || copy.unknown} · {segment.carrier?.marketingCode} {segment.flight?.marketingNumber}</p>
            <div className="flightRoute" dir="ltr">
              <div><strong>{segment.originCode}</strong><time>{flightLocalTime(segment.departureTime)}</time><small>{segment.originName}</small></div>
              <Plane size={22} aria-hidden="true" />
              <div><strong>{segment.destinationCode}</strong><time>{flightLocalTime(segment.arrivalTime)}</time><small>{segment.destinationName}</small></div>
            </div>
            {Number(segment.stopCount) > 0 && <small>{copy.stops}: {segment.stopCount} {(segment.stops || []).map((stop) => stop.airportCode).join(', ')}</small>}
          </div>)}
        </section>;
      })}
      <div className="flightBaggage"><Luggage size={18} aria-hidden="true" /><div><strong>{copy.baggage}</strong>
        {bags.length ? bags.map((bag, index) => <small key={index}>{bag.description || `${bag.pieces ?? '—'} × ${bag.weightKg ?? '—'} kg`} {bag.passengerType ? `(${bag.passengerType})` : ''}</small>) : <small>{copy.unknown}</small>}
      </div></div>
    </div>
    <div className="flightPrice"><small>{result.offer.fare?.family}</small><strong>{money}</strong><span>{copy.total}</span></div>
  </article>;
}
export default function Flights() {
  const { language } = useLanguage();
  const copy = flightTranslations[language] || flightTranslations.en;
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [roundTrip, setRoundTrip] = useState(true);
  const [departure, setDeparture] = useState(() => localDate(7));
  const [returnDate, setReturnDate] = useState(() => localDate(14));
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [cabinClass, setCabinClass] = useState('ECONOMY');
  const [currency, setCurrency] = useState('USD');
  const [country, setCountry] = useState('TR');
  const [environment, setEnvironment] = useState(null);
  const [state, setState] = useState('idle');
  const [error, setError] = useState('');
  const [results, setResults] = useState([]);
  const [visible, setVisible] = useState(20);
  const searchController = useRef(null);
  const resultsRef = useRef(null);
  const loading = state === 'loading';
  const countries = useMemo(() => {
    const names = new Intl.DisplayNames([language], { type: 'region' });
    return regionCodes.map((code) => ({ code, name: names.of(code) })).sort((a, b) => a.name.localeCompare(b.name, language));
  }, [language]);
  useEffect(() => {
    const controller = new AbortController();
    flightRequest('/status', { signal: controller.signal }).then((data) => { if (!controller.signal.aborted) setEnvironment(data.environment); }).catch(() => {});
    return () => { controller.abort(); searchController.current?.abort(); searchController.current = null; };
  }, []);
  async function submit(event) {
    event.preventDefault();
    if (loading) return;
    setError(''); setResults([]); setVisible(20);
    if (!origin || !destination) { setError('selectAirport'); setState('error'); return; }
    if (origin.iata === destination.iata || departure < localDate() || (roundTrip && returnDate < departure) || infants > adults || adults + children + infants > 9) { setError('invalid'); setState('error'); return; }
    searchController.current?.abort();
    const controller = new AbortController(); searchController.current = controller;
    setState('loading');
    const timeout = setTimeout(() => controller.abort(), 70000);
    try {
      const payload = await flightRequest('/search', { signal: controller.signal, body: { origin: origin.iata, destination: destination.iata, departure, ...(roundTrip ? { returnDate } : {}), adults, children, infants, cabinClass, currency, country } });
      if (searchController.current !== controller || controller.signal.aborted) return;
      setEnvironment(payload.environment); setResults(flightResults(payload, currency)); setState('done');
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      if (searchController.current !== controller) return;
      setState('error'); setError(err.name === 'AbortError' || err.message === 'TIMEOUT' ? 'timeout' : err.message === 'INVALID_SEARCH' ? 'invalid' : err.message === 'RATE_LIMIT' ? 'rateLimit' : 'error');
    } finally { clearTimeout(timeout); }
  }
  return <main className="flightsPage">
    <section className="flightsHero">
      <nav className="flightTabs" aria-label="Travel"><Link to="/travel"><Hotel size={18} />{copy.hotels}</Link><Link to="/flights" aria-current="page"><Plane size={18} />{copy.flights}</Link></nav>
      <h1>{copy.title}</h1><p>{copy.intro}</p>
      <form className="flightSearchForm" onSubmit={submit}>
        <fieldset disabled={loading}>
          <div className="flightTripType"><label><input type="radio" name="trip" checked={!roundTrip} onChange={() => setRoundTrip(false)} />{copy.oneWay}</label><label><input type="radio" name="trip" checked={roundTrip} onChange={() => setRoundTrip(true)} />{copy.roundTrip}</label></div>
          <div className="flightFields">
            <AirportInput label={copy.from} value={origin} onChange={setOrigin} copy={copy} disabled={loading} />
            <AirportInput label={copy.to} value={destination} onChange={setDestination} copy={copy} disabled={loading} />
            <label>{copy.departure}<input required type="date" min={localDate()} value={departure} onChange={(event) => { setDeparture(event.target.value); if (returnDate < event.target.value) setReturnDate(event.target.value); }} /></label>
            {roundTrip && <label>{copy.returnDate}<input required type="date" min={departure || localDate()} value={returnDate} onChange={(event) => setReturnDate(event.target.value)} /></label>}
          </div>
          <div className="flightFields flightPassengerFields">
            {[[copy.adults, adults, setAdults, 1], [copy.children, children, setChildren, 0], [copy.infants, infants, setInfants, 0]].map(([label, value, setter, min]) => <label key={label}>{label}<input required type="number" min={min} max="9" value={value} onChange={(event) => setter(Number(event.target.value))} /></label>)}
            <label>{copy.cabin}<select value={cabinClass} onChange={(event) => setCabinClass(event.target.value)}>{[['ECONOMY','economy'], ['PREMIUM_ECONOMY','premium'], ['BUSINESS','business'], ['FIRST','first']].map(([value, label]) => <option key={value} value={value}>{copy[label]}</option>)}</select></label>
            <label>{copy.currency}<select value={currency} onChange={(event) => setCurrency(event.target.value)}>{['USD','EUR','TRY','GBP'].map((code) => <option key={code}>{code}</option>)}</select></label>
            <label>{copy.country}<select value={country} onChange={(event) => setCountry(event.target.value)}>{countries.map((region) => <option key={region.code} value={region.code}>{region.name}</option>)}</select></label>
          </div>
          <button className="flightSearchButton" type="submit" disabled={loading}>{loading ? <LoaderCircle className="flightSpin" size={20} /> : <Search size={20} />}{loading ? copy.searching : copy.search}</button>
        </fieldset>
        {error && <p className="flightError" role="alert">{copy[error]}</p>}
        <p className="flightNotice">{copy.preview}</p>
        {environment === 'sandbox' && <p className="flightSandbox">{copy.sandbox}</p>}
      </form>
    </section>
    <section ref={resultsRef} className="flightResults" aria-live="polite" aria-busy={loading}>
      {loading && <p className="flightStatus">{copy.searching}</p>}
      {state === 'done' && <><h2>{copy.results} · {results.length}</h2><p>{copy.localTimes}</p>{environment === 'sandbox' && <p className="flightSandbox">{copy.sandbox}</p>}{results.length === 0 && <p className="flightStatus">{copy.empty}</p>}</>}
      {results.slice(0, visible).map((result) => <FlightCard key={result.offer.offerId} result={result} copy={copy} language={language} />)}
      {visible < results.length && <button className="flightSearchButton" onClick={() => setVisible((count) => count + 20)}>{copy.more}</button>}
    </section>
  </main>;
}
