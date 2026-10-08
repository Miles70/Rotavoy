import { useEffect, useState } from 'react';
import { copy, languageNames } from '../../seo/copy.js';
import { languagePath } from '../../seo/model.js';
export default function SeoLanding({ page }) {
 const c = copy[page.lang];
 const [dark, setDark] = useState(false);
 useEffect(() => {
  try { setDark(localStorage.getItem('rotavoy_seo_theme') === 'dark'); localStorage.setItem('language', page.lang); } catch { /* Browsing works without storage. */ }
 }, [page.lang]);
 function toggleTheme() { setDark(value => { try { localStorage.setItem('rotavoy_seo_theme', value ? 'light' : 'dark'); } catch { /* Optional. */ } return !value; }); }
 const cards = page.cards || [];
 return <div className={`seoSite${dark ? ' seoDark' : ''}`}>
  <header className="seoHeader"><a className="seoBrand" href={languagePath(page.lang)}><img src="/brand/rotavoy-favicon.png" width="36" height="36" alt="" /><strong>Rotavoy</strong></a><nav aria-label={c.home}><a href={languagePath(page.lang, 'hotels')}>{c.hotels}</a><a href={languagePath(page.lang, 'flights')}>{c.flights}</a><button type="button" onClick={toggleTheme} aria-label={c.theme}>◐</button></nav></header>
  <main className="seoMain">
   <nav className="seoBreadcrumb" aria-label={c.home}><a href={languagePath(page.lang)}>{c.home}</a>{page.kind !== 'home' && <><span aria-hidden="true"> / </span><span>{page.title}</span></>}</nav>
   <section className="seoHero"><div><p className="seoEyebrow">ROTAVOY TRAVEL</p><h1>{page.title}</h1><p>{page.intro}</p>{page.cta && <a className="seoCta" href={page.cta.href}>{page.cta.title} →</a>}</div>{page.hotel && <img className="seoHeroImage" src={page.hotel.image} alt={page.hotel.name} width="800" height="600" fetchPriority="high" />}</section>
   {page.hotel && <section className="seoPanel"><h2>{c.hotelInfo}</h2><dl><dt>{c.address}</dt><dd>{page.hotel.address}, {page.hotel.city}, {page.hotel.country}</dd>{Number.isFinite(page.hotel.stars) && page.hotel.stars > 0 && <><dt>{c.stars}</dt><dd>{page.hotel.stars} ★</dd></>}</dl><p>{c.sourceNote}</p><p>{c.hotelHelp}</p></section>}
   {page.route && <section className="seoPanel"><h2>{c.airports}</h2><dl><dt>{c.outbound}</dt><dd>{page.route.originName} — {page.route.originAirport} ({page.route.from}) → {page.route.destinationName} — {page.route.destinationAirport} ({page.route.to})</dd></dl><p>{c.stepsText}</p></section>}
   {cards.length > 0 && <section><h2>{page.kind === 'route' ? c.related : page.kind === 'flights' ? c.routes : c.hotels}</h2><div className="seoCards">{cards.map(card => <article className="seoCard" key={card.href}>{card.image && <a href={card.href} tabIndex={-1} aria-hidden="true"><img src={card.image} width="480" height="320" loading="lazy" alt="" /></a>}<div><h3><a href={card.href}>{card.title}</a></h3>{card.stars > 0 && <span>{card.stars} ★</span>}{card.text && <p>{card.text}</p>}</div></article>)}</div></section>}
   {page.pagination?.length > 1 && <nav className="seoLanguages" aria-label={c.hotels}>{page.pagination.map(link => <a key={link.href} href={link.href} aria-current={link.href === page.path ? "page" : undefined}>{link.title}</a>)}</nav>}
   <section className="seoPanel"><h2>{c.steps}</h2><p>{c.stepsText}</p><div className="seoLinkColumns"><div><h3>{c.destinations}</h3>{page.destinationLinks.map(link => <a key={link.href} href={link.href}>{link.title}</a>)}</div><div><h3>{c.routes}</h3>{page.routeLinks.map(link => <a key={link.href} href={link.href}>{link.title}</a>)}</div></div></section>
  </main>
  <footer className="seoFooter"><strong>Rotavoy</strong><nav aria-label="Language" className="seoLanguages">{page.alternates.filter(a => a.language !== 'x-default').map(a => <a lang={a.language} hrefLang={a.language} href={a.path} key={a.language} aria-current={a.language === page.lang ? 'page' : undefined}>{languageNames[a.language]}</a>)}</nav></footer>
 </div>;
}
