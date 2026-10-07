import test from 'node:test';
import assert from 'node:assert/strict';
import { cancellationInstant, cancellationTimeLabel, extraFacilityKeys, interpolate } from '../../shared/hotelPresentation.js';
import hotelRateTranslations, { facilityExtras } from '../../src/i18n/hotelRateTranslations.js';
import hotelDetailTranslations from '../../src/i18n/hotelDetailTranslations.js';
test('explicit UTC deadlines convert to the user zone without changing the instant', () => {
  const policy = { cancelTime: '2026-11-01 10:00:00', timezone: 'GMT' };
  const tr = cancellationTimeLabel(policy, 'tr', 'Europe/Istanbul');
  assert.equal(tr.date.toISOString(), '2026-11-01T10:00:00.000Z');
  assert.match(tr.label, /13:00/); assert.match(tr.label, /Kasım/); assert.equal(tr.local, true);
  assert.match(cancellationTimeLabel(policy, 'en', 'America/New_York').label, /5:00/);
  assert.equal(cancellationInstant({ cancelTime: '2026-11-01T13:00:00+03:00' }).toISOString(), tr.date.toISOString());
});
test('ambiguous zones and invalid dates never produce guessed deadlines', () => {
  for (const timezone of [undefined, 'CST', 'Europe/Istanbul', 'hotel local']) {
    const p = { cancelTime: '2026-11-01 10:00:00', timezone };
    assert.equal(cancellationInstant(p), null);
    assert.equal(cancellationTimeLabel(p, 'tr', 'Europe/Istanbul').local, false);
  }
  assert.equal(cancellationInstant({ cancelTime: '2026-02-30 10:00:00', timezone: 'GMT' }), null);
  const p = { cancelTime: '2026-11-01 10:00:00', timezone: 'GMT' };
  assert.equal(cancellationTimeLabel(p, 'tr', 'invalid/zone').label, '2026-11-01 10:00:00 GMT');
});
test('all ten languages cover room texts, templates and observed amenity aliases', () => {
  assert.equal(Object.keys(hotelRateTranslations).length, 10);
  const keys = Object.keys(hotelRateTranslations.en).sort();
  for (const [language, labels] of Object.entries(hotelRateTranslations)) {
    assert.deepEqual(Object.keys(labels).sort(), keys);
    for (const value of Object.values(labels)) assert.ok(typeof value === 'string' && value.length);
    for (const key of Object.values(extraFacilityKeys)) assert.ok(hotelDetailTranslations[language].facilities[key]);
    assert.deepEqual(Object.keys(facilityExtras[language]), Object.keys(facilityExtras.en));
    assert.ok(interpolate(labels.freeUntil, { date: 'DATE' }).includes('DATE'));
    assert.ok(interpolate(labels.review, { total: 'TOTAL' }).includes('TOTAL'));
  }
  assert.equal(hotelDetailTranslations.tr.facilities.laundry, 'Çamaşırhane');
  assert.equal(hotelDetailTranslations.tr.facilities.pool, 'Yüzme havuzu');
});
