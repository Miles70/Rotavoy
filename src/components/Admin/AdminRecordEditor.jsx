import { useState } from 'react';
import { adminRequest } from '../../services/adminApi';
const labels = { title: 'Başlık', subject: 'Konu', destination: 'Destinasyon', body: 'İçerik', email: 'Müşteri e-postası', clientReference: 'Rezervasyon referansı', note: 'Operasyon notu (yalnız ekip)', reply: 'Müşteriye yanıt', type: 'Tür', status: 'Durum', priority: 'Öncelik' };
export const statusLabels = { draft: 'Taslak', ready: 'Yayına hazır', archived: 'Arşiv', open: 'Açık', in_progress: 'İşlemde', waiting_provider: 'Sağlayıcı bekleniyor', resolved: 'Çözüldü', normal: 'Normal', high: 'Yüksek', urgent: 'Acil', support: 'Destek', cancellation: 'İptal talebi', refund: 'İade talebi', payment: 'Ödeme', provider: 'Sağlayıcı', destination: 'Destinasyon', campaign: 'Kampanya', guide: 'Gezi rehberi', awaiting_payment: 'Ödeme bekliyor', processing: 'İşleniyor', confirmed: 'Onaylandı', failed: 'Başarısız', expired: 'Süresi doldu', unpaid: 'Ödenmedi', pending: 'Bekliyor', paid: 'Ödendi' };
export default function AdminRecordEditor({ kind, record, onClose, onSaved }) {
  const tickets = kind === 'tickets';
  const [form, setForm] = useState(() => record || (tickets ? { subject: '', email: '', clientReference: '', type: 'support', status: 'open', priority: 'normal', note: '' } : { title: '', type: 'destination', destination: '', body: '', status: 'draft' }));
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const fields = tickets ? ['subject', 'email', 'clientReference', 'type', 'status', 'priority', 'note', 'reply'] : ['title', 'type', 'destination', 'body', 'status'];
  const choices = tickets ? { type: ['support', 'cancellation', 'refund', 'payment', 'provider'], status: ['open', 'in_progress', 'waiting_provider', 'resolved'], priority: ['normal', 'high', 'urgent'] } : { type: ['destination', 'campaign', 'guide'], status: ['draft', 'ready', 'archived'] };
  async function save(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { await adminRequest(`/${kind}${record?._id ? `/${record._id}` : ''}`, { method: record?._id ? 'PUT' : 'POST', body: Object.fromEntries(fields.map(field => [field, form[field] || ''])) }); onSaved(); } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <section className="adminEditor" aria-label={tickets ? 'Destek kaydı' : 'İçerik kaydı'}><div className="adminSectionHeading"><h2>{record ? 'Kaydı düzenle' : 'Yeni kayıt'}</h2><button type="button" onClick={onClose}>Kapat</button></div>
    <p className="adminHint">{tickets ? 'İptal ve iade talepleri operasyon kaydıdır. Sağlayıcı iptali veya para transferi bu formdan yapılmaz.' : 'İçerikler editoryal çalışma alanında saklanır. “Yayına hazır” durumu, içeriği sitede otomatik yayınlamaz.'}</p>
    {tickets && record?.message && <div className="adminPanel"><h3>Müşterinin mesajı</h3><p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{record.message}</p></div>}
    <form onSubmit={save}><fieldset disabled={busy}><div className="adminFormGrid">{fields.map(field => <label key={field}>{labels[field]}{choices[field] ? <select value={form[field]} onChange={event => setForm({ ...form, [field]: event.target.value })}>{choices[field].map(value => <option key={value} value={value}>{statusLabels[value]}</option>)}</select> : ['body', 'note', 'reply'].includes(field) ? <textarea rows="5" maxLength="5000" value={form[field] || ''} onChange={event => setForm({ ...form, [field]: event.target.value })} /> : <input required={['subject', 'title'].includes(field)} type={field === 'email' ? 'email' : 'text'} maxLength="254" value={form[field] || ''} onChange={event => setForm({ ...form, [field]: event.target.value })} />}</label>)}</div><button className="adminPrimary" type="submit">{busy ? 'Kaydediliyor…' : 'Kaydet'}</button></fieldset>{error && <p role="alert" className="adminError">{error}</p>}</form>
  </section>;
}
