import { hydrateRoot } from 'react-dom/client';
import SeoLanding from './SeoLanding.jsx';
import { trackTravel } from '../services/analytics.js';
import './seo.css';
const page = JSON.parse(document.getElementById('seo-page-data').textContent);
hydrateRoot(document.getElementById('root'), <SeoLanding page={page} />);
trackTravel('page_view');
const heartbeat = setInterval(() => { if (document.visibilityState === 'visible') trackTravel('heartbeat'); }, 45000);
window.addEventListener('pagehide', () => clearInterval(heartbeat), { once: true });
document.addEventListener('click', event => {
 const link = event.target.closest?.('a[href]');
 if (link && page.hotel && new URL(link.href).pathname === `/travel/hotels/${page.hotel.id}`) trackTravel('hotel_open', { hotelId: page.hotel.id, hotelName: page.hotel.name });
});
