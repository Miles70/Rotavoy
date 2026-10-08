import { travelLandingPath } from '../../../shared/travelSeo';
import { useEffect, useId, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Hotel, Plane, CarFront, MapPinned, ChevronDown, Menu } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import categoryCopy from '../../i18n/categoryTranslations';
const categories = [{ key: 'hotels', Icon: Hotel }, { key: 'flights', Icon: Plane }, { key: 'cars', Icon: CarFront }, { key: 'activities', Icon: MapPinned }];
export default function TravelCategoryMenu() {
  const { t, language } = useLanguage();
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const button = useRef(null);
  const id = useId();
  const copy = categoryCopy(language);
  useEffect(() => {
    if (!open) return undefined;
    function outside(event) { if (!root.current?.contains(event.target)) setOpen(false); }
    function key(event) { if (event.key === 'Escape') { setOpen(false); button.current?.focus(); } }
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', key); };
  }, [open]);
  return <div className="travelCategoryControl" ref={root} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button ref={button} type="button" aria-label={copy.menu} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}><span>{copy.menu}</span><ChevronDown className="categoryMenuChevron" size={19} /><Menu className="categoryMenuMobile" size={20} /></button>
    {open && <nav id={id} className="travelCategoryDropdown" aria-label={copy.menu}>{categories.map(({ key, Icon }) => <NavLink key={key} to={travelLandingPath(key, language)} onClick={() => setOpen(false)}><Icon size={20} /><span>{t(`travelPage.services.${key}.label`)}</span></NavLink>)}</nav>}
  </div>;
}
