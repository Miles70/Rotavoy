import { useEffect, useId, useState } from 'react';
import { flightRequest } from '../../services/flightsApi';
import { airportResults } from '../../services/flightResults';

export default function AirportInput({ label, value, onChange, copy, disabled }) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState([]);
  const [status, setStatus] = useState('idle');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  useEffect(() => {
    if (value || query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setStatus('loading');
      try {
        const payload = await flightRequest(`/airports?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        if (!controller.signal.aborted) { setOptions(airportResults(payload)); setStatus('done'); }
      } catch (error) { if (error.name !== 'AbortError' && !controller.signal.aborted) setStatus('error'); }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, value]);
  function choose(airport) { onChange(airport); setQuery(''); setOptions([]); setOpen(false); setActive(-1); }
  return <div className="flightAirport">
    <label htmlFor={id}>{label}</label>
    <input id={id} role="combobox" aria-autocomplete="list" aria-expanded={open && options.length > 0} aria-controls={`${id}-options`} aria-activedescendant={active >= 0 ? `${id}-${active}` : undefined}
      autoComplete="off" disabled={disabled} placeholder={copy.airportHint} value={value ? `${value.city || value.name} (${value.iata})` : query}
      onFocus={() => setOpen(true)} onBlur={(event) => { if (!event.currentTarget.parentElement.contains(event.relatedTarget)) setOpen(false); }}
      onChange={(event) => { onChange(null); setQuery(event.target.value); setOptions([]); setStatus('idle'); setOpen(true); setActive(-1); }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false);
        if (event.key === 'ArrowDown' && options.length) { event.preventDefault(); setOpen(true); setActive((n) => Math.min(n + 1, options.length - 1)); }
        if (event.key === 'ArrowUp' && options.length) { event.preventDefault(); setActive((n) => Math.max(0, n - 1)); }
        if (event.key === 'Enter' && open && active >= 0 && options[active]) { event.preventDefault(); choose(options[active]); }
      }} />
    {open && !value && query.trim().length >= 2 && <div className="flightAirportMenu">
      {status === 'loading' && <p role="status">…</p>}
      {status === 'error' && <p role="alert">{copy.error}</p>}
      {status === 'done' && options.length === 0 && <p>{copy.selectAirport}</p>}
      <ul id={`${id}-options`} role="listbox" aria-label={label}>{options.map((airport, index) => <li key={airport.iata}>
        <button id={`${id}-${index}`} type="button" role="option" aria-selected={active === index} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(airport)}>
          <strong>{airport.iata}</strong> {airport.name}<small>{airport.city} · {airport.country}</small>
        </button>
      </li>)}</ul>
    </div>}
  </div>;
}
