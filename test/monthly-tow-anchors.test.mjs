// Tests for the three features added in this round:
//   1. Monthly payment estimate on explore cards (trailer + motorhome)
//   2. Tow headroom displayed in pounds (client-side, tested via string format)
//   3. Section heading anchor links on detail pages (client-side IIFE)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  renderExploreCard, FINANCE_DEFAULTS, calculateMonthly,
} from '../src/lib/render.mjs';
import { renderMotorhomeExploreCard } from '../src/lib/motorhome-render.mjs';
import { loadTrailers } from '../src/lib/data.mjs';
import { loadMotorhomes } from '../src/lib/motorhome-data.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------------------
// 1. FINANCE_DEFAULTS exported and sane
// ---------------------------------------------------------------------------

test('FINANCE_DEFAULTS exports downPct, apr, termYears', () => {
  assert.ok(FINANCE_DEFAULTS, 'FINANCE_DEFAULTS should be exported');
  assert.equal(typeof FINANCE_DEFAULTS.downPct, 'number');
  assert.equal(typeof FINANCE_DEFAULTS.apr, 'number');
  assert.equal(typeof FINANCE_DEFAULTS.termYears, 'number');
  assert.ok(FINANCE_DEFAULTS.downPct > 0 && FINANCE_DEFAULTS.downPct <= 100);
  assert.ok(FINANCE_DEFAULTS.apr > 0 && FINANCE_DEFAULTS.apr < 30);
  assert.ok(FINANCE_DEFAULTS.termYears >= 1 && FINANCE_DEFAULTS.termYears <= 30);
});

// ---------------------------------------------------------------------------
// 2. calculateMonthly math spot-check
// ---------------------------------------------------------------------------

test('calculateMonthly returns correct payment for known MSRP', () => {
  // Basecamp 16X: $55,900 → 20% down = $11,180 financed = $44,720
  const r = calculateMonthly(55900, 20, 6.99, 15);
  assert.equal(r.down, 11180);
  assert.equal(r.principal, 44720);
  assert.equal(typeof r.monthly, 'number');
  assert.ok(r.monthly > 300 && r.monthly < 500, `monthly ${r.monthly} outside 300-500`);
  assert.ok(r.totalInterest > 0, 'should have positive interest');
  assert.equal(r.totalCost, r.down + r.monthly * FINANCE_DEFAULTS.termYears * 12);
});

test('calculateMonthly with 0 MSRP returns 0 monthly', () => {
  const r = calculateMonthly(0, 20, 6.99, 15);
  assert.equal(r.monthly, 0);
  assert.equal(r.down, 0);
});

// ---------------------------------------------------------------------------
// 3. Monthly payment appears on every trailer explore card with MSRP > 0
// ---------------------------------------------------------------------------

test('every trailer explore card with MSRP > 0 has monthly payment line', () => {
  const trailers = loadTrailers();
  const withMsrp = trailers.filter(t => t.msrp > 0);
  assert.ok(withMsrp.length > 50, 'should have 50+ trailers with MSRP');

  for (const t of withMsrp) {
    const html = renderExploreCard(t);
    assert.match(html, /spec-monthly-label/, `${t.slug} missing monthly label`);
    assert.match(html, /spec-monthly-val/, `${t.slug} missing monthly value`);
    assert.match(html, /\/mo</, `${t.slug} missing /mo suffix`);
  }
});

// ---------------------------------------------------------------------------
// 4. Monthly payment appears on every motorhome explore card with MSRP > 0
// ---------------------------------------------------------------------------

test('every motorhome explore card with MSRP > 0 has monthly payment line', () => {
  const motorhomes = loadMotorhomes();
  const withMsrp = motorhomes.filter(m => m.msrp > 0);
  assert.ok(withMsrp.length >= 1, 'should have at least 1 motorhome with MSRP');

  for (const m of withMsrp) {
    const html = renderMotorhomeExploreCard(m);
    assert.match(html, /spec-monthly-label/, `${m.slug} missing monthly label`);
    assert.match(html, /spec-monthly-val/, `${m.slug} missing monthly value`);
    assert.match(html, /\/mo</, `${m.slug} missing /mo suffix`);
  }
});

// ---------------------------------------------------------------------------
// 5. Tow headroom in lb (client-side JS): verify the app.js source has the
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
// 6. Section anchor links IIFE present in app.js
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
// 7. CSS rules for monthly payment + section anchors exist
// ---------------------------------------------------------------------------

test('site.css has monthly payment and section anchor styles', () => {
  const css = readFileSync(join(ROOT, 'src/assets/css/site.css'), 'utf8');
  assert.match(css, /\.spec-monthly-label/, 'missing .spec-monthly-label rule');
  assert.match(css, /\.spec-monthly-val/, 'missing .spec-monthly-val rule');
  assert.match(css, /\.section-anchor/, 'missing .section-anchor rule');
  assert.match(css, /\.anchor-toast/, 'missing .anchor-toast rule');
});

// ---------------------------------------------------------------------------
// 8. Built dist index.html has monthly payment on explore cards
// ---------------------------------------------------------------------------

test('built index.html contains monthly payment estimates', () => {
  const distIndex = join(ROOT, 'dist', 'index.html');
  if (!existsSync(distIndex)) return; // skip if dist not built (unit-only run)
  const html = readFileSync(distIndex, 'utf8');
  const matches = html.match(/spec-monthly-val/g);
  assert.ok(matches && matches.length >= 50,
    `expected 50+ monthly payment values in index.html, got ${matches ? matches.length : 0}`);
});
