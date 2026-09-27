// Tests for:
//   1. Tow headroom displayed in pounds (client-side, tested via string format)
//   2. Section heading anchor links on detail pages (client-side IIFE)
//   3. Red line: NO monthly payment estimates on explore cards (ruling 1A)
//
// The monthly-payment card feature was removed 2026-09-27 per ruling 1A
// (2026-06-13, reaffirmed); the full finance regression test is no-finance.test.mjs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderExploreCard } from '../src/lib/render.mjs';
import { renderMotorhomeExploreCard } from '../src/lib/motorhome-render.mjs';
import { loadTrailers } from '../src/lib/data.mjs';
import { loadMotorhomes } from '../src/lib/motorhome-data.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------------------
// 1. Red line: explore cards have NO monthly payment (trailer + motorhome)
// ---------------------------------------------------------------------------

test('no trailer explore card has a monthly payment line', () => {
  const trailers = loadTrailers();
  const withMsrp = trailers.filter(t => t.msrp > 0);
  assert.ok(withMsrp.length > 50, 'should have 50+ trailers with MSRP');

  for (const t of withMsrp) {
    const html = renderExploreCard(t);
    assert.doesNotMatch(html, /spec-monthly-label/, `${t.slug} has monthly label`);
    assert.doesNotMatch(html, /spec-monthly-val/, `${t.slug} has monthly value`);
    assert.doesNotMatch(html, /Est\. payment/, `${t.slug} has Est. payment`);
  }
});

test('no motorhome explore card has a monthly payment line', () => {
  const motorhomes = loadMotorhomes();
  const withMsrp = motorhomes.filter(m => m.msrp > 0);
  assert.ok(withMsrp.length >= 1, 'should have at least 1 motorhome with MSRP');

  for (const m of withMsrp) {
    const html = renderMotorhomeExploreCard(m);
    assert.doesNotMatch(html, /spec-monthly-label/, `${m.slug} has monthly label`);
    assert.doesNotMatch(html, /spec-monthly-val/, `${m.slug} has monthly value`);
    assert.doesNotMatch(html, /Est\. payment/, `${m.slug} has Est. payment`);
  }
});

// ---------------------------------------------------------------------------
// 2. Tow headroom in lb (client-side JS): verify the app.js source has the
//    correct format strings with lb units, not the old generic labels
// ---------------------------------------------------------------------------

test('app.js tow verdict shows lb headroom/margin/over, not generic labels', () => {
  const appJs = readFileSync(join(ROOT, 'src/assets/js/app.js'), 'utf8');
  // Three format patterns we expect (unicode chars: ✓ △ ✕)
  assert.match(appJs, /\\u2713.*lb headroom/, 'comfortable: should show "✓ ... lb headroom"');
  assert.match(appJs, /\\u25b3.*lb margin/, 'within: should show "△ ... lb margin"');
  assert.match(appJs, /\\u2715.*lb over/, 'over: should show "✕ ... lb over"');
  // Old generic labels should NOT appear as the tow-fit text
  // (towFitLabel in explore.mjs is still fine — we check only the card display path)
  assert.doesNotMatch(
    appJs.substring(appJs.indexOf('var headroom = state.tow'), appJs.indexOf('var headroom = state.tow') + 600),
    /Comfortable tow|Within limit|Exceeds rating/,
    'card display path should use lb numbers, not old generic labels'
  );
});

// ---------------------------------------------------------------------------
// 3. Section anchor links IIFE present in app.js
// ---------------------------------------------------------------------------

test('app.js contains sectionAnchors IIFE with copy-to-clipboard', () => {
  const appJs = readFileSync(join(ROOT, 'src/assets/js/app.js'), 'utf8');
  assert.match(appJs, /function sectionAnchors/, 'sectionAnchors IIFE must exist');
  assert.match(appJs, /section-anchor/, 'must add section-anchor class');
  assert.match(appJs, /anchor-toast/, 'must include toast element');
  assert.match(appJs, /clipboard\.writeText/, 'must use clipboard API');
  assert.match(appJs, /Copied!/, 'must show Copied! feedback');
  assert.match(appJs, /aria-label/, 'anchor must have aria-label for a11y');
});

// ---------------------------------------------------------------------------
// 4. CSS rules for section anchors exist; monthly-payment styles are gone
// ---------------------------------------------------------------------------

test('site.css has section anchor styles and no monthly-payment styles', () => {
  const css = readFileSync(join(ROOT, 'src/assets/css/site.css'), 'utf8');
  assert.match(css, /\.section-anchor/, 'missing .section-anchor rule');
  assert.match(css, /\.anchor-toast/, 'missing .anchor-toast rule');
  assert.doesNotMatch(css, /\.spec-monthly-label/, '.spec-monthly-label CSS must be gone');
  assert.doesNotMatch(css, /\.spec-monthly-val/, '.spec-monthly-val CSS must be gone');
});

// ---------------------------------------------------------------------------
// 5. Tow tool: combobox + manual overrides + hash (wave-3 #32/#33)
// ---------------------------------------------------------------------------

test('detail tow tool uses a searchable combobox, not a raw select', async () => {
  const { renderDetail } = await import('../src/lib/render.mjs');
  const { loadTrailers } = await import('../src/lib/data.mjs');
  const trailers = loadTrailers();
  const t = trailers.find((x) => x.slug === 'bambi-16rb-2026');
  const html = renderDetail(t, undefined, null, null, trailers);
  assert.match(html, /id="tow-vehicle" type="text" role="combobox"/, 'combobox input');
  assert.match(html, /<datalist id="tow-vehicle-list">/, 'datalist present');
  assert.doesNotMatch(html, /<select id="tow-vehicle"/, 'no raw select');
});

test('tow tool emits declaration bar, 3 override inputs and copy-link button', async () => {
  const { renderDetail } = await import('../src/lib/render.mjs');
  const { loadTrailers } = await import('../src/lib/data.mjs');
  const trailers = loadTrailers();
  const t = trailers.find((x) => x.slug === 'bambi-16rb-2026');
  const html = renderDetail(t, undefined, null, null, trailers);
  assert.match(html, /id="tow-declare"/, 'manufacturer-rating declaration bar');
  assert.match(html, /id="tow-maxtow"/, 'max-tow override input');
  assert.match(html, /id="tow-payload"/, 'payload override input');
  assert.match(html, /id="tow-gcwr"/, 'GCWR override input');
  assert.match(html, /id="tow-copylink"/, 'copy-link button');
  assert.match(html, /Curb weight always comes from the selected preset/, 'curb weight caveat stated');
});

test('app.js tow hash: overrides included, curb never, copy forces hash sync', () => {
  const appJs = readFileSync(join(ROOT, 'src/assets/js/app.js'), 'utf8');
  assert.match(appJs, /parts\.push\('maxtow=' \+ overrides\.maxtow\)/, 'hash carries maxtow override');
  assert.match(appJs, /parts\.push\('payload=' \+ overrides\.payload\)/, 'hash carries payload override');
  assert.match(appJs, /parts\.push\('gcwr=' \+ overrides\.gcwr\)/, 'hash carries gcwr override');
  assert.doesNotMatch(appJs, /parts\.push\('curb/, 'curb weight never in hash');
  assert.match(appJs, /syncTowHash\(true\)/, 'copy-link forces hash sync');
  assert.match(appJs, /labelToId\[v\.name/, 'label-to-id map for datalist labels');
});
