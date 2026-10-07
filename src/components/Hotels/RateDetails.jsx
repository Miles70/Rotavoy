const mealNames = { RO: 'Sadece Oda', BB: 'Kahvaltı Dahil', HB: 'Yarım Pansiyon', FB: 'Tam Pansiyon', AI: 'Her Şey Dahil', UAI: 'Ultra Her Şey Dahil' };
const taxName = value => ({ Tax: 'Vergi', OTHERS: 'Diğer zorunlu ücretler' })[value] || value || '';
const money = (amount, currency) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency }).format(amount);
function deadline(policy) {
  const first = (policy?.cancelPolicyInfos || []).filter(p => Number(p.amount) > 0 && p.cancelTime).sort((a, b) => a.cancelTime.localeCompare(b.cancelTime))[0];
  if (!first) return null;
  const date = new Date(first.cancelTime.replace(' ', 'T') + (first.timezone === 'GMT' ? 'Z' : ''));
  if (first.timezone !== 'GMT' || !Number.isFinite(date.getTime())) return null;
  return { date, label: `${new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(date)} (UTC)` };
}
export default function RateDetails({ terms }) {
  return <>{terms?.bookingConditions && <details className="rateFacts"><summary>Rezervasyon koşulları</summary><p>{terms.bookingConditions}</p></details>}{terms?.rooms?.map((room, index) => {
    const policy = room.cancellation;
    const limit = deadline(policy);
    const free = policy?.refundableTag === 'RFN' && limit && limit.date > new Date();
    const extra = room.taxes.filter(tax => tax.included === false);
    const penalties = policy?.cancelPolicyInfos || [];
    return <div key={index} className="rateFacts">
      {(mealNames[room.meal] || room.mealName) && <p>{mealNames[room.meal] || room.mealName}</p>}
      {policy?.refundableTag === 'NRFN' ? <p>İade Edilemez</p> : free ? <p className="rateFactsFree">Ücretsiz iptal · {limit.label} tarihine kadar</p> : policy && <p>İptal koşulları için detayları incele</p>}
      {extra.map((tax, i) => <p key={i}>Ek vergi/ücret: {tax.amount != null && Number.isFinite(Number(tax.amount)) && tax.currency ? money(tax.amount, tax.currency) : 'Tutar detaylarda belirtilir'}{tax.description ? ` · ${taxName(tax.description)}` : ''} · Toplama dahil değil</p>)}
      {(penalties.length > 0 || room.remarks || room.taxes.length > 0 || policy?.hotelRemarks?.length > 0) && <details><summary>Fiyat ve iptal detayları</summary>
        {room.taxes.map((tax, i) => <p key={i}>{tax.included === true ? 'Fiyata dahil vergi/ücret' : tax.included === false ? 'Ek vergi/ücret' : 'Vergi/ücret'}{tax.description ? ` · ${taxName(tax.description)}` : ''}{tax.amount != null && tax.currency ? `: ${money(tax.amount, tax.currency)}` : ''}</p>)}
        {penalties.map((penalty, i) => <p key={i}>{penalty.cancelTime} {penalty.timezone || ''} itibarıyla iptal bedeli: {penalty.type === 'amount' && penalty.currency ? money(penalty.amount, penalty.currency) : `${penalty.amount} ${penalty.type || ''}`}</p>)}
        {room.remarks && <p>{room.remarks}</p>}
        {policy?.hotelRemarks?.filter(x => typeof x === 'string').map((remark, i) => <p key={i}>{remark.replace(/<[^>]*>/g, ' ')}</p>)}
      </details>}
    </div>;
  })}</>;
}
