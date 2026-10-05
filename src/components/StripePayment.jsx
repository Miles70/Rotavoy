import { useEffect, useRef, useState } from 'react';
let sdkPromise;
function loadStripe() {
  if (window.Stripe) return Promise.resolve(window.Stripe);
  if (!sdkPromise) sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = 'https://js.stripe.com/v3/'; script.async = true;
    const timer = setTimeout(() => { sdkPromise = null; script.remove(); reject(new Error('Kart ödeme servisine ulaşılamadı.')); }, 20000);
    script.onload = () => { clearTimeout(timer); if (window.Stripe) resolve(window.Stripe); else { sdkPromise = null; reject(new Error('Kart ödeme formu yüklenemedi.')); } };
    script.onerror = () => { clearTimeout(timer); sdkPromise = null; script.remove(); reject(new Error('Kart ödeme servisine ulaşılamadı.')); }; document.head.appendChild(script);
  });
  return sdkPromise;
}
export default function StripePayment({ session, returnUrl }) {
  const target = useRef(null), payment = useRef(null);
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    let active = true, element;
    setReady(false); setError('');
    loadStripe().then(Stripe => {
      if (!active) return;
      const stripe = Stripe(session.publishableKey);
      const elements = stripe.elements({ clientSecret: session.secretKey, appearance: { theme: 'stripe' } });
      element = elements.create('payment'); element.mount(target.current);
      element.on('ready', () => { if (active) setReady(true); });
      element.on('loaderror', e => { if (active) setError(e.error?.message || 'Ödeme formu yüklenemedi.'); });
      payment.current = { stripe, elements };
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; element?.destroy(); payment.current = null; };
  }, [session.publishableKey, session.secretKey]);
  async function pay(e) {
    e.preventDefault(); if (!ready || busy || !payment.current) return;
    setBusy(true); setError('');
    try { const { error: failure } = await payment.current.stripe.confirmPayment({ elements: payment.current.elements, confirmParams: { return_url: returnUrl } }); if (failure) setError(failure.message || 'Ödeme tamamlanamadı.'); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <form className="accountForm" onSubmit={pay}><h2>Kartla güvenli ödeme</h2><p>{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: session.currency }).format(session.amount)}</p><div ref={target} />{!ready && !error && <p role="status">Ödeme formu yükleniyor…</p>}{error && <p role="alert" className="accountError">{error}</p>}<button className="accountPrimary" disabled={!ready || busy}>{busy ? 'Ödeme işleniyor…' : 'Ödemeyi tamamla'}</button></form>;
}
