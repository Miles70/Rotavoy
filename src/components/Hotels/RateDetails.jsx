import { useLanguage } from '../../i18n/LanguageContext';
import { cancellationTimeLabel, interpolate } from '../../../shared/hotelPresentation.js';
import './RateDetails.css';

export default function RateDetails({ terms }) {
  const { t, language } = useLanguage();
  const text = (key, values = {}) => interpolate(t(`hotelRate.${key}`), values);
  const locale = language === 'pt' ? 'pt-BR' : language;
  const money = (amount, currency) => new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const taxName = value => ({ Tax: text('tax'), OTHERS: text('others') })[value] || value || '';
  const mealCodes = ['RO', 'BB', 'HB', 'FB', 'AI', 'UAI'];

  return <>
    {terms?.bookingConditions && <details className="rateFacts"><summary>{text('conditions')}</summary><p>{terms.bookingConditions}</p></details>}
    {terms?.rooms?.map((room, index) => {
      const policy = room.cancellation;
      const penalties = policy?.cancelPolicyInfos || [];
      const deadlines = penalties.filter(p => Number(p.amount) > 0).map(p => cancellationTimeLabel(p, language, timeZone));
      // Never promise free cancellation if any fee deadline is ambiguous.
      const limit = deadlines.length && deadlines.every(p => p.date)
        ? deadlines.sort((a, b) => a.date - b.date)[0] : null;
      const free = policy?.refundableTag === 'RFN' && limit && limit.date > new Date();
      const extra = (room.taxes || []).filter(tax => tax.included === false);
      const meal = mealCodes.includes(room.meal) ? text(room.meal) : room.mealName;
      return <div key={index} className="rateFacts">
        {meal && <p>{meal}</p>}
        {policy?.refundableTag === 'NRFN' ? <p>{text('nonRefundable')}</p>
          : free ? <p className="rateFactsFree">{text('freeUntil', { date: limit.label })}{limit.local && <small className="rateLocalTime">{text('localTime')}</small>}</p>
            : policy && <p>{text('cancellationDetails')}</p>}
        {extra.map((tax, i) => <p key={i}>{text('extraFee')}: {tax.amount != null && Number.isFinite(Number(tax.amount)) && tax.currency ? money(tax.amount, tax.currency) : text('amountUnknown')}{tax.description ? ` · ${taxName(tax.description)}` : ''} · {text('excluded')}</p>)}
        {(penalties.length > 0 || room.remarks || (room.taxes || []).length > 0 || policy?.hotelRemarks?.length > 0) && <details>
          <summary>{text('priceDetails')}</summary>
          {(room.taxes || []).map((tax, i) => <p key={i}>{text(tax.included === true ? 'includedFee' : tax.included === false ? 'extraFee' : 'taxFee')}{tax.description ? ` · ${taxName(tax.description)}` : ''}{tax.amount != null && tax.currency ? `: ${money(tax.amount, tax.currency)}` : ''}</p>)}
          {penalties.map((penalty, i) => {
            const time = cancellationTimeLabel(penalty, language, timeZone);
            const amount = penalty.type === 'amount' && penalty.currency ? money(penalty.amount, penalty.currency) : `${penalty.amount} ${penalty.type || ''}`;
            return <p key={i}>{text('penaltyFrom', { date: time.label, amount })}{time.local && <small className="rateLocalTime">{text('localTime')}</small>}</p>;
          })}
          {room.remarks && <p>{room.remarks}</p>}
          {policy?.hotelRemarks?.filter(x => typeof x === 'string').map((remark, i) => <p key={i}>{remark.replace(/<[^>]*>/g, ' ')}</p>)}
        </details>}
      </div>;
    })}
  </>;
}
