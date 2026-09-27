import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const { offGridTier } = await import('../src/lib/data.mjs');
const { renderDetail } = await import('../src/lib/render.mjs');
const { renderMotorhomeDetail } = await import('../src/lib/motorhome-render.mjs');
const { loadTrailers } = await import('../src/lib/data.mjs');
const { loadMotorhomes } = await import('../src/lib/motorhome-data.mjs');

describe('offGridTier — visible off-grid displays use three tiers, not raw numbers', () => {
  it('bands: Strong >= 75, Moderate 55-74, Basic < 55', () => {
    assert.equal(offGridTier(93), 'Strong');
    assert.equal(offGridTier(75), 'Strong');
    assert.equal(offGridTier(74), 'Moderate');
    assert.equal(offGridTier(65), 'Moderate');
    assert.equal(offGridTier(55), 'Moderate');
    assert.equal(offGridTier(54), 'Basic');
    assert.equal(offGridTier(39), 'Basic');
  });

  it('returns null for missing/invalid scores', () => {
    assert.equal(offGridTier(0), null);
    assert.equal(offGridTier(null), null);
    assert.equal(offGridTier(undefined), null);
  });

  it('trailer key-stats show the tier with the composite disclosed in the title', () => {
    const trailers = loadTrailers();
    const t = trailers.find((x) => x.slug === 'classic-33fb-2026');
    const html = renderDetail(t);
    // visible value is the tier…
    assert.ok(html.includes('>Moderate</span>'), 'key-stat shows Moderate tier');
    // …with the editorial composite + non-official disclosure in the title
    assert.ok(html.includes('Editorial composite 65/100'), 'title discloses composite');
    assert.ok(html.includes('not an official Airstream rating'), 'title discloses non-official status');
    // raw "65/100" must not appear as a visible value
    assert.ok(!html.includes('>65/100</span>'), 'raw score not shown as visible value');
  });

  it('trailer spec table shows the tier and the glossary discloses the editorial composite', () => {
    const trailers = loadTrailers();
    const t = trailers.find((x) => x.slug === 'classic-33fb-2026');
    const html = renderDetail(t);
    assert.ok(html.includes('Off-grid score'), 'spec row present');
    assert.ok(html.includes('editorial 0–100 composite'), 'glossary discloses editorial composite');
    assert.ok(html.includes('Not an official Airstream rating'), 'glossary discloses non-official status');
  });

  it('motorhome key-stats show the tier, not the raw number', () => {
    const motorhomes = loadMotorhomes();
    const m = motorhomes.find((x) => x.slug === 'interstate-24gl-2027');
    const html = renderMotorhomeDetail(m);
    assert.ok(html.includes(`>${offGridTier(m.offGridScore)}</span>`), 'motorhome key-stat shows tier');
    assert.ok(!html.includes(`>${m.offGridScore}/100</span>`), 'motorhome raw score not shown as visible value');
  });

  it('the data layer keeps the raw numeric score for sorting/quiz/compare', () => {
    const trailers = loadTrailers();
    const t = trailers.find((x) => x.slug === 'classic-33fb-2026');
    assert.equal(typeof t.offGridScore, 'number');
    assert.equal(t.offGridScore, 65);
  });
});
