import { Plane, Luggage } from 'lucide-react';
import { flightLocalTime, flightStops } from '../../services/flightResults';
export default function FlightCard({ result, copy, language, onSelect, selected = false }) {
  const money = new Intl.NumberFormat(language, { style: 'currency', currency: result.currency }).format(result.total);
  const bags = result.offer.baggage?.included || [];
  return <article className={`flightCard${selected ? " flightCardSelected" : ""}`}>
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
    <div className="flightPrice"><small>{result.offer.fare?.family}</small><strong>{money}</strong><span>{copy.total}</span>{onSelect && <button type="button" className="flightSearchButton" aria-pressed={selected} onClick={() => onSelect(result)}>{selected ? copy.selected : copy.select}</button>}</div>
  </article>;
}
