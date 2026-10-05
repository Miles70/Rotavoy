import { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import { accountRequest } from '../services/customerApi';
export default function HotelFavorite({ hotelId, name, image }) {
  const { isAuthenticated, customerSession, openAuthModal } = useCustomerAuth();
  return <FavoriteButton key={`${customerSession?.token || 'anonymous'}:${hotelId}`} hotelId={hotelId} name={name} image={image} isAuthenticated={isAuthenticated} openAuthModal={openAuthModal} />;
}
function FavoriteButton({ hotelId, name, image, isAuthenticated, openAuthModal }) {
  const [saved, setSaved] = useState(false), [busy, setBusy] = useState(false), [loaded, setLoaded] = useState(!isAuthenticated), [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const controller = new AbortController();
    accountRequest('/preferences', { signal: controller.signal }).then(data => { setSaved(data.favorites.some(f => f.hotelId === hotelId)); setLoaded(true); setError(''); }).catch(e => { if (e.name !== 'AbortError') setError(e.message); });
    return () => controller.abort();
  }, [hotelId, isAuthenticated, attempt]);
  async function toggle() {
    if (!isAuthenticated) { openAuthModal(); return; }
    if (!loaded) { setAttempt(v => v + 1); return; }
    setBusy(true); setError('');
    try { await accountRequest(`/favorites/${encodeURIComponent(hotelId)}`, { method: saved ? 'DELETE' : 'PUT', ...(saved ? {} : { body: JSON.stringify({ name, image }) }) }); setSaved(v => !v); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <div className="hotelFavoriteControl"><button type="button" className={`hotelFavoriteButton${saved ? ' saved' : ''}`} aria-pressed={saved} disabled={busy || (!loaded && !error)} onClick={toggle}><Heart size={18} fill={saved ? 'currentColor' : 'none'} />{busy ? 'Kaydediliyor…' : !loaded && !error ? 'Yükleniyor…' : saved ? 'Favorilerimde' : 'Favorilere kaydet'}</button>{error && <small role="alert">{error}{!loaded && ' · Tekrar denemek için butona bas.'}</small>}</div>;
}
