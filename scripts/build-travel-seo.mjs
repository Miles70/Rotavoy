import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { SITE_URL, TRAVEL_LANDINGS, travelAlternates, languageTag } from '../shared/travelSeo.js';
import { travelSeoCopy } from '../shared/travelSeoCopy.js';
import { seoHeadHtml } from '../shared/seoHead.js';
const root = process.cwd();
const temporary = await mkdtemp(path.join(root, 'node_modules/.travel-seo-'));
try {
  await writeFile(path.join(temporary, 'entry.jsx'), `import React from 'react';\nimport { renderToStaticMarkup } from 'react-dom/server';\nimport TravelGuide from '${root}/src/components/Seo/TravelGuide.jsx';\nexport const render = (category, language) => renderToStaticMarkup(<TravelGuide category={category} language={language} initialHtml />);`);
  await build({ configFile: false, plugins: [react()], publicDir: false, logLevel: 'error', build: { ssr: path.join(temporary, 'entry.jsx'), outDir: path.join(temporary, 'out'), emptyOutDir: true } });
  const { render } = await import(pathToFileURL(path.join(temporary, 'out/entry.js')));
  const template = await readFile('dist/index.html', 'utf8');
  const baseHead = template.replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '').replace(/<meta\b[^>]*name="description"[^>]*>/gi, '');
  for (const page of TRAVEL_LANDINGS) {
    const copy = travelSeoCopy(page.category, page.language);
    const head = seoHeadHtml({ ...copy, path: page.path, alternates: travelAlternates(page.category), jsonLd: { '@context': 'https://schema.org', '@type': 'WebPage', name: copy.heading, description: copy.description, url: SITE_URL + page.path, inLanguage: languageTag(page.language), isPartOf: { '@type': 'WebSite', name: 'Rotavoy', url: SITE_URL } } });
    const html = baseHead.replace('<html lang="en">', `<html lang="${languageTag(page.language)}" dir="${page.language === 'ar' ? 'rtl' : 'ltr'}">`).replace('</head>', `${head}\n</head>`).replace('<div id="root"></div>', `<div id="root"><main>${render(page.category, page.language)}</main></div>`);
    const destination = path.join('dist', `${page.path.slice(1)}.html`);
    await mkdir(path.dirname(destination), { recursive: true }); await writeFile(destination, html);
  }
  // Style the same content in the initial HTML while the application bundle loads.
  const css = await readFile('src/components/Seo/TravelGuide.css', 'utf8');
  for (const page of TRAVEL_LANDINGS) {
    const destination = path.join('dist', `${page.path.slice(1)}.html`);
    const html = await readFile(destination, 'utf8');
    await writeFile(destination, html.replace('</head>', `<style data-rv-seo-fallback>${css}</style></head>`));
  }
  console.log(`Travel SEO: ${TRAVEL_LANDINGS.length} localized HTML landing pages generated without provider calls.`);
} finally { await rm(temporary, { recursive: true, force: true }); }
