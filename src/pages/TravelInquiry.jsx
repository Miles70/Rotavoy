import { useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import Seo from '../components/Seo/Seo';
import './TravelInquiry.css';
export default function TravelInquiry() {
 const {language} = useLanguage(); const tr = language === 'tr';
 const {state,pathname} = useLocation(); const [params] = useSearchParams();
 const kind = params.get('kind') || (pathname.startsWith('/flights') ? 'flight' : 'hotel');
 const [form,setForm] = useState({kind,name:'',email:'',phone:'',destination:params.get('destination') || state?.hotel?.name || '',hotelId:params.get('hotelId') || state?.hotel?.hotelId || '',origin:params.get('origin') || '',startDate:params.get('startDate') || state?.checkin || '',endDate:params.get('endDate') || state?.checkout || '',adults:params.get('adults') || state?.adults || 2,children:params.get('children') || 0,notes:''});
 const [busy,setBusy] = useState(false); const [error,setError] = useState(''); const [reference,setReference] = useState('');
 const text = (a,b) => tr ? a : b;
 async function submit(e) { e.preventDefault(); setBusy(true); setError(''); try {
  const response = await fetch(`${String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/,'')}/api/inquiries`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});
  const data = await response.json().catch(()=>({})); if (!response.ok) throw new Error(data.message || text('Talep gönderilemedi. Tekrar dene.','Unable to send request. Please retry.'));
  setReference(data.reference);
 } catch(err) { setError(err.message); } finally { setBusy(false); } }
 return <main className="inquiryPage"><Seo path="/request" noIndex title={text('Rezervasyon talebi | Rotavoy','Reservation request | Rotavoy')} /><section className="inquiryCard">
 <h1>{text('Seyahat talebini gönder','Send your travel request')}</h1>
 <p>{text('Tarihlerini ve tercihlerini paylaş. Fiyat ve müsaitlik kontrolünden sonra e-posta üzerinden sana ulaşacağız. Bu aşamada ödeme alınmaz ve rezervasyon kesinleşmez.','Share your dates and preferences. We will contact you by email after checking price and availability. No payment is collected and no booking is confirmed at this stage.')}</p>
 {reference ? <div role="status"><h2>{text('Talebin alındı','Request received')}</h2><p>{reference}</p><p>{text('Bu numara talep referansındır; otel veya uçuş onay numarası değildir.','This is your request reference, not a hotel or flight confirmation.')}</p><Link to="/">{text('Ana sayfaya dön','Back to home')}</Link></div> : <form onSubmit={submit}><fieldset disabled={busy}>
 {[['name',text('Ad soyad','Full name'),'text'],['email',text('E-posta','Email'),'email'],['phone',text('Telefon (isteğe bağlı)','Phone (optional)'),'tel'],...(kind === 'flight' ? [['origin',text('Kalkış','Origin'),'text']] : []),['destination',text(kind === 'hotel' ? 'Otel / destinasyon' : 'Varış / destinasyon','Hotel / destination'),'text'],['startDate',text('Başlangıç tarihi','Start date'),'date'],['endDate',text(kind === 'flight' ? 'Dönüş (isteğe bağlı)' : 'Bitiş tarihi','End / return date'),'date'],['adults',text('Yetişkin','Adults'),'number'],['children',text('Çocuk','Children'),'number']].map(([key,label,type])=><label key={key}>{label}<input type={type} required={!['phone','children'].includes(key) && (key !== 'endDate' || kind === 'hotel')} min={type === 'number' ? key === 'adults' ? 1 : 0 : type === 'date' ? key === 'endDate' ? form.startDate : new Date().toISOString().slice(0,10) : undefined} max={type === 'number' ? 20 : undefined} maxLength={type === 'number' || type === 'date' ? undefined : key === 'email' ? 254 : 200} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})} /></label>)}
 <label>{text('Tercihlerin / notun','Preferences / notes')}<textarea maxLength={2000} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
 <p><Link to="/privacy">{text('Gizlilik bilgileri','Privacy information')}</Link></p><button>{busy ? text('Gönderiliyor…','Sending…') : text('Rezervasyon talebi gönder','Send reservation request')}</button></fieldset>{error && <p role="alert">{error}</p>}</form>}
 </section></main>;
}
