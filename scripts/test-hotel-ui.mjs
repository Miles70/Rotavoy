import assert from 'node:assert/strict';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { normalizeRateConditions } from '../server/src/services/hotelRateConditions.js';

const root = process.cwd();
const temporary = await mkdtemp(path.join(root, 'node_modules/.hotel-ui-'));
try {
  await writeFile(path.join(temporary, 'entry.jsx'), `
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LanguageProvider } from '${root}/src/i18n/LanguageContext.jsx';
import RateConditions from '${root}/src/components/RateConditions.jsx';
export function render(language, conditions) {
  globalThis.localStorage = { getItem: () => language };
  return renderToStaticMarkup(<LanguageProvider><RateConditions conditions={conditions} /></LanguageProvider>);
}
`);
  await build({ configFile: false, plugins: [react()], logLevel: 'error', publicDir: false, build: { ssr: path.join(temporary, 'entry.jsx'), outDir: path.join(temporary, 'out'), emptyOutDir: true } });
  const { render } = await import(pathToFileURL(path.join(temporary, 'out/entry.js')));
  const withExtra = normalizeRateConditions({ boardType: 'AI', name: 'Long room name '.repeat(100), cancellationPolicies: { refundableTag: 'NRFN', cancelPolicyInfos: [] }, retailRate: { taxesAndFees: [{ included: false, amount: 10.63, currency: 'USD', description: 'City tax' }] } });
  for (const language of ['en', 'tr', 'ru', 'ar', 'zh', 'es', 'pt', 'fr', 'de', 'it']) {
    const html = render(language, { rooms: [withExtra] });
    assert.ok(html.includes('<details') && html.includes('<summary'));
    assert.ok(!html.includes('rateConditions.') && !html.includes('>AI<'));
    assert.ok(html.includes('City tax'));
  }
  const turkish = render('tr', { rooms: [withExtra] });
  assert.ok(turkish.includes('Her Şey Dahil') && turkish.includes('İade edilemez') && turkish.includes('Tesiste ayrıca ödenecek'));
  const unknown = render('tr', { rooms: [normalizeRateConditions({})] });
  assert.ok(!unknown.includes('Ücretsiz iptal') && !unknown.includes('Vergiler ve ücretler dahil'));
  assert.ok(unknown.includes('Yemek planı belirtilmedi') && unknown.includes('Vergi dökümü sağlanmadı'));
  const expired = render('tr', { rooms: [normalizeRateConditions({ boardType: 'RO', cancellationPolicies: { refundableTag: 'RFN', cancelPolicyInfos: [{ cancelTime: '2000-01-01 00:00:00', amount: 100, currency: 'USD', type: 'amount', timezone: 'GMT' }] } })] });
  assert.ok(expired.includes('İptalde ücret uygulanır') && !expired.includes('Ücretsiz iptal'));
  console.log('Hotel UI: 10 languages, accessible disclosures, mandatory fees, unknown fields and expired cancellation passed.');
} finally {
  await rm(temporary, { recursive: true, force: true });
  delete globalThis.localStorage;
}
