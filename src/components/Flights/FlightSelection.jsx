import { useEffect, useRef, useState } from 'react';
import { LoaderCircle, X } from 'lucide-react';
import FlightCard from './FlightCard';
import { flightRequest } from '../../services/flightsApi';
import { verifiedFlightResult } from '../../services/flightResults';

export default function FlightSelection({ result, copy, language, environment, onVerified, onClose }) {
  const dialog = useRef(null);
  const [verified, setVerified] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 70000);
    setVerified(null); setError('');
    onVerified(null);
    flightRequest('/verify', { signal: controller.signal, body: { offerId: result.offer.offerId } })
      .then((payload) => {
        if (!active || controller.signal.aborted) return;
        setVerified(verifiedFlightResult(payload, result));
        onVerified(result.offer.offerId);
      }).catch((err) => {
        if (!active) return;
        setError(err.message === 'OFFER_EXPIRED' ? 'expired' : err.name === 'AbortError' || err.message === 'TIMEOUT' ? 'timeout' : 'verifyError');
      }).finally(() => clearTimeout(timeout));
    return () => { active = false; controller.abort(); clearTimeout(timeout); };
  }, [result, attempt, onVerified]);
  const terms = verified?.offer.terms;
  const money = (amount, currency) => new Intl.NumberFormat(language, { style: 'currency', currency }).format(amount);
  return <dialog ref={dialog} className="flightSelection" aria-labelledby="flight-selection-title" onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <header><h2 id="flight-selection-title">{copy.selectionTitle}</h2><button type="button" className="flightClose" onClick={onClose} aria-label={copy.back}><X /></button></header>
    {environment === 'sandbox' && <p className="flightSandbox">{copy.sandbox}</p>}
    <div aria-live="polite" aria-busy={!verified && !error}>
      {!verified && !error && <p className="flightVerifyStatus"><LoaderCircle className="flightSpin" size={20} />{copy.verifying}</p>}
      {error && <p className="flightError" role="alert">{copy[error]}</p>}
      {verified && <>
        <p className="flightVerified">{copy.verified}</p>
        {verified.priceChanged && <p className="flightSandbox">{copy.priceChanged}: <del>{money(result.total, result.currency)}</del> → <strong>{money(verified.total, verified.currency)}</strong></p>}
        {verified.changes?.messages?.length > 0 && <ul className="flightChanges">{verified.changes.messages.filter((message) => typeof message === 'string').map((message, index) => <li key={index}>{message}</li>)}</ul>}
        <FlightCard result={verified} copy={copy} language={language} />
        <section className="flightTerms"><h3>{copy.conditions}</h3>
          <p>{copy.refund}: <strong>{terms?.refundable === true ? copy.allowed : terms?.refundable === false ? copy.notAllowed : copy.unknown}</strong></p>
          <p>{copy.change}: <strong>{terms?.changeable === true ? copy.allowed : terms?.changeable === false ? copy.notAllowed : copy.unknown}</strong></p>
          {(terms?.summary || []).filter((item) => typeof item.message === 'string').map((item, index) => <p key={index}>{item.message}</p>)}
        </section>
        <p className="flightNotice">{copy.selectionNote}</p>
      </>}
    </div>
    <footer>{error && error !== 'expired' && <button type="button" className="flightSearchButton" onClick={() => setAttempt((n) => n + 1)}>{copy.retry}</button>}<button type="button" className="flightBackButton" onClick={onClose}>{copy.back}</button></footer>
  </dialog>;
}
