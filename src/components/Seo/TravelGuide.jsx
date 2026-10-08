import { LANGUAGE_NAMES, SEO_LANGUAGES, travelLandingPath } from '../../../shared/travelSeo';
import { travelSeoCopy } from '../../../shared/travelSeoCopy';
import './TravelGuide.css';
export default function TravelGuide({ category, language, initialHtml = false }) {
  const copy = travelSeoCopy(category, language);
  const other = category === 'hotels' ? 'flights' : 'hotels';
  const otherCopy = travelSeoCopy(other, language);
  return <section className="travelSeoGuide" lang={language === 'pt' ? 'pt-BR' : language} dir={language === 'ar' ? 'rtl' : 'ltr'}>
    {initialHtml ? <><a className="travelSeoBrand" href="/">Rotavoy</a><h1>{copy.heading}</h1></> : <h2>{copy.heading}</h2>}
    <p className="travelSeoIntro">{copy.intro}</p>
    <h2 className="travelSeoGuideTitle">{copy.guide}</h2>
    <div className="travelSeoGuideGrid">{copy.sections.map(section => <article key={section.title}><h3>{section.title}</h3><p>{section.text}</p></article>)}</div>
    <nav className="travelSeoLanguages" aria-label="Languages">{SEO_LANGUAGES.map(code => <a key={code} href={travelLandingPath(category, code)} hrefLang={code === 'pt' ? 'pt-BR' : code} lang={code === 'pt' ? 'pt-BR' : code} aria-current={language === code ? 'page' : undefined}>{LANGUAGE_NAMES[code]}</a>)}</nav>
    <a className="travelSeoRelated" href={travelLandingPath(other, language)}>{otherCopy.heading} →</a>
  </section>;
}
