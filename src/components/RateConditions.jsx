import { useEffect, useState } from "react";
import { useLanguage } from '../i18n/LanguageContext';
import { cancellationStatus } from '../../shared/hotelCancellation';
import './RateConditions.css';

export function formatPolicyDate(value, language) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? `${new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(date)} ${new Intl.DateTimeFormat(language, { timeZoneName: 'short' }).formatToParts(date).find(part => part.type === 'timeZoneName')?.value || ''}` : '';
}
function money(amount, currency, language) {
  if (amount === null || !/^[A-Z]{3}$/.test(currency || '')) return '';
  return new Intl.NumberFormat(language, { style: 'currency', currency }).format(amount);
}

export default function RateConditions({ conditions, bookingConditions = '', confirmed = false }) {
  const { t, language } = useLanguage();
  const tr = key => t(`rateConditions.${key}`);
  const rooms = conditions?.rooms || [];
  const [now, setNow] = useState(Date.now);
  const nextBoundary = Math.min(...rooms.flatMap(room => (room.cancellationPolicies || []).map(policy => Date.parse(policy.from)).filter(time => time > now)));
  useEffect(() => {
    if (!Number.isFinite(nextBoundary)) return;
    const timeout = setTimeout(() => setNow(Date.now()), Math.min(nextBoundary - Date.now() + 10, 2147483647));
    return () => clearTimeout(timeout);
  }, [nextBoundary]);
  if (!rooms.length) return null;
  return <div className="rateConditions">
    {rooms.map((room, index) => {
      const cancellation = cancellationStatus(room, now);
      const extras = (room.taxesAndFees || []).filter(tax => tax.included === false);
      const meal = room.mealPlan === 'unknown' ? room.mealPlanName || tr('unknownMeal') : tr(room.mealPlan);
      const cancelText = cancellation.kind === 'freeUntil' ? `${tr('freeUntil')} ${formatPolicyDate(cancellation.deadline, language)}` : tr({ unknown: 'unknownCancellation', penalty: 'penalty', refundable: 'refundable', nonRefundable: 'nonRefundable' }[cancellation.kind]);
      return <div key={index}>
        {confirmed && room.roomName && <strong className="rateConditionsRoom">{room.roomName}</strong>}
        <p className="rateConditionsMeal">{meal}</p>
        <p className={`rateConditionsCancel rateConditionsCancel--${cancellation.kind}`}>{cancelText}</p>
        {room.taxesIncluded === true && <p className="rateConditionsTax">{tr('included')}</p>}
        {extras.map((tax, taxIndex) => <p className="rateConditionsExtra" key={taxIndex}><strong>{tr('extra')}: {money(tax.amount, tax.currency, language) || tr('unknownAmount')}</strong>{tax.description && <span>{tax.description}</span>}</p>)}
        <details className="rateConditionsDetails">
          <summary>{tr('details')}</summary>
          <div>
            {room.taxesIncluded === null && <p>{tr('unknownTax')}</p>}
            {(room.cancellationPolicies || []).map((policy, policyIndex) => <p key={policyIndex}>{policy.from ? `${tr('after')} ${formatPolicyDate(policy.from, language)} · ` : ''}{tr('charge')}: {policy.unit === 'amount' ? money(policy.amount, policy.currency, language) || tr('unknownPenalty') : tr('unknownPenalty')}</p>)}
            {(room.remarks || []).map((remark, remarkIndex) => <p key={remarkIndex}>{remark}</p>)}
            {bookingConditions && <p>{bookingConditions}</p>}
            {conditions?.paymentTiming === 'now' && <p>{tr('now')}</p>}
          </div>
        </details>
      </div>;
    })}
  </div>;
}
