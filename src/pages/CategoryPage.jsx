import { trackTravel } from '../services/analytics';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CarFront, MapPinned, ArrowRight } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import categoryCopy from '../i18n/categoryTranslations';
import './CategoryPage.css';

function today() { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
export default function CategoryPage({ category, embedded = false }) {
  const { t, language } = useLanguage();
  const copy = categoryCopy(language);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [location, setLocation] = useState(() => embedded ? '' : params.get('location') || '');
  const [date, setDate] = useState(() => embedded ? today() : params.get('date') || today());
  const [end, setEnd] = useState(() => embedded ? today() : params.get('end') || today());
  const [people, setPeople] = useState(() => Math.max(1, Math.min(20, Number(embedded ? 1 : params.get('people')) || 1)));
  const Icon = category === 'cars' ? CarFront : MapPinned;
  const title = t(`travelPage.services.${category}.label`);
  const Container = embedded ? 'div' : 'main';
  function submit(event) {
    event.preventDefault();
    trackTravel(category === 'cars' ? 'car_plan' : 'activity_plan', { destination: location.trim(), checkin: date, checkout: category === 'cars' ? end : '', adults: people, category });
    const query = new URLSearchParams({ location: location.trim(), date, ...(category === 'cars' ? { end } : { people: String(people) }), plan: '1' });
    navigate(`/${category}?${query}`);
  }
  return <Container className={`categoryPage${embedded ? ' categoryPage--embedded' : ''}`}>
    {!embedded && <nav className="categoryBreadcrumb"><Link to="/">{copy.home}</Link><span> / {title}</span></nav>}
    <div className="categoryHeading"><Icon size={28} />{embedded ? <h2>{title}</h2> : <h1>{title}</h1>}</div>
    {!embedded && <p>{copy[`${category}Text`]}</p>}
    <form className="categoryForm" onSubmit={submit}>
      <label>{t(`travelPage.services.${category}.locationLabel`)}<input required maxLength={160} value={location} onChange={(event) => setLocation(event.target.value)} placeholder={t(`travelPage.services.${category}.locationPlaceholder`)} /></label>
      <div className="categoryFields">
        <label>{category === 'cars' ? copy.pickup : copy.date}<input required type="date" min={today()} value={date} onChange={(event) => { setDate(event.target.value); if (end < event.target.value) setEnd(event.target.value); }} /></label>
        {category === 'cars' ? <label>{copy.dropoff}<input required type="date" min={date || today()} value={end} onChange={(event) => setEnd(event.target.value)} /></label> : <label>{copy.people}<input required type="number" min="1" max="20" value={people} onChange={(event) => setPeople(Number(event.target.value))} /></label>}
      </div>
      <p className="categoryNotice">{copy.unavailable}</p>
      <button type="submit">{copy.plan}<ArrowRight size={18} /></button>
    </form>
    {!embedded && <section className="categoryDetails"><h2>{params.get('plan') === '1' ? copy.summary : copy.details}</h2>
      {params.get('plan') === '1' ? <><p>{copy.notice}</p><dl><dt>{t(`travelPage.services.${category}.locationLabel`)}</dt><dd>{params.get('location')}</dd><dt>{category === 'cars' ? copy.pickup : copy.date}</dt><dd>{params.get('date')}</dd><dt>{category === 'cars' ? copy.dropoff : copy.people}</dt><dd>{params.get(category === 'cars' ? 'end' : 'people')}</dd></dl></> : <p>{copy[`${category}Text`]}</p>}
      <Link to="/hotels">{copy.hotel}<ArrowRight size={16} /></Link>
    </section>}
  </Container>;
}
