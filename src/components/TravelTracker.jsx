import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { trackTravel } from '../services/analytics';
export default function TravelTracker() {
  const { pathname, key } = useLocation();
  const previous = useRef('');
  useEffect(() => {
    if (previous.current === key) return;
    previous.current = key;
    trackTravel('page_view');
    if (pathname === '/travel/checkout') trackTravel('checkout_view');
  }, [pathname, key]);
  useEffect(() => {
    function click(event) {
      const link = event.target?.closest?.('a[href]');
      if (!link) return;
      let url;
      try { url = new URL(link.href, window.location.origin); } catch { return; }
      const match = url.pathname.match(/^\/travel\/hotels\/([^/]+)$/);
      if (url.origin === window.location.origin && match) trackTravel('hotel_open', { hotelId: decodeURIComponent(match[1]), hotelName: link.closest('article')?.querySelector('h3')?.textContent || '' });
    }
    document.addEventListener('click', click);
    return () => document.removeEventListener('click', click);
  }, []);
  return null;
}
