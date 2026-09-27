// P0 FIX VERIFICATION — 2026-09-27 remediation round.
//   1. Compare: detail pages write plain slug strings via shared cmpGet/cmpSet
//      (previously detailCompare wrote {slug,type} objects that the Compare
//      page silently dropped — every detail Compare button was dead).
//   2. Motorhome detail pages now have Compare buttons (were missing on 11/11).
//   3. "What can tow it?" summary uses the same three-limit evaluateTow()
//      verdict as the detailed calculator (previously maxTow-only).
//   4. Combo waste tanks drain at (grayGpd + blackGpd) * people.
//   5. explore.html canonical is explore.html (was index.html).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderDetail, renderExplore, renderWaterAutonomy } from '../src/lib/render.mjs';
import { renderMotorhomeDetail } from '../src/lib/motorhome-render.mjs';
import { loadTrailers } from '../src/lib/data.mjs';
import { loadMotorhomes } from '../src/lib/motorhome-data.mjs';
import { loadVehicles, evaluateTow } from '../src/lib/tow.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const trailers = loadTrailers();
const motorhomes = loadMotorhomes();
const vehicles = loadVehicles();

// ---------------------------------------------------------------------------
// 1. Compare buttons exist on every detail page
// ---------------------------------------------------------------------------
describe('compare buttons on detail pages', () => {
  test('every trailer detail page has a compare button with data-compare-slug', () => {
    for (const t of trailers) {
      const html = renderDetail(t);
      assert.ok(html.includes('id="detail-compare"'), `${t.slug} missing compare button`);
      assert.ok(html.includes(`data-compare-slug="${t.slug}"`), `${t.slug} missing compare slug attr`);
    }
  });

  test('every motorhome detail page has a compare button (11 models)', () => {
    assert.equal(motorhomes.length, 11, 'expected 11 motorhomes');
    for (const m of motorhomes) {
      const html = renderMotorhomeDetail(m, undefined, motorhomes);
      assert.ok(html.includes('id="detail-compare"'), `${m.slug} missing compare button`);
      assert.ok(html.includes(`data-compare-slug="${m.slug}"`), `${m.slug} missing compare slug attr`);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Compare storage format: strings, via shared helpers
// ---------------------------------------------------------------------------
describe('compare storage format is unified (slug strings)', () => {
  const appJs = readFileSync(join(ROOT, 'src/assets/js/app.js'), 'utf8');

  test('detailCompare uses the shared cmpGet()/cmpSet() helpers', () => {
    const block = appJs.slice(appJs.indexOf('function detailCompare'));
    assert.ok(block.includes('cmpGet()'), 'detailCompare must read via cmpGet()');
    assert.ok(block.includes('cmpSet(set)'), 'detailCompare must write via cmpSet()');
  });

  test('detailCompare pushes plain strings, never objects', () => {
    const start = appJs.indexOf('function detailCompare');
    const end = appJs.indexOf('9e-b. GENERIC COLLAPSIBLE');
    const block = appJs.slice(start, end);
    assert.ok(block.length > 500, 'detailCompare block must exist');
    assert.ok(!block.includes('push({'), 'detailCompare must not push objects');
    assert.ok(block.includes('set.push(slug)'), 'detailCompare must push the slug string');
  });

  test('shared helpers keep the 3-item string-array contract', () => {
    assert.ok(appJs.includes("var CMP_KEY = 'compare'"), 'shared CMP_KEY must be the string-array key');
  });
});

// ---------------------------------------------------------------------------
// 3. Combo waste tank formula: comboGal / ((grayGpd + blackGpd) * people)
// ---------------------------------------------------------------------------
describe('combo waste tank formula', () => {
  test('Bambi 16RB (30 gal combo tank) lasts ~2.1 days at 2 people / moderate', () => {
    // 30 / ((5 + 2) * 2) = 2.142... — was wrongly shown as ~7.5 days
    const bambi = trailers.find((t) => t.slug === 'bambi-16rb-2026');
    assert.ok(bambi, 'bambi-16rb-2026 must exist');
    assert.ok(!bambi.grayGal && bambi.blackGal, 'Bambi 16RB must be combo (no gray tank)');
    const html = renderWaterAutonomy(bambi);
    assert.ok(html.includes('2.1 days'), `expected "2.1 days" in water autonomy, got: ${html.slice(0, 400)}`);
  });

  test('separate-tank trailers still use blackGpd alone for the black tank', () => {
    const fc = trailers.find((t) => t.slug === 'flying-cloud-25fb-2026' && t.grayGal);
    assert.ok(fc, 'a separate-tank trailer must exist');
    const html = renderWaterAutonomy(fc);
    // black 39 gal / (2 gpd * 2 people) = 9.75 -> 9.8 days (NOT combo math)
    assert.ok(html.includes('9.8 days') || html.includes('9.7 days'), 'separate-tank black math unchanged');
  });
});

// ---------------------------------------------------------------------------
// 4. "What can tow it?" summary matches the detailed calculator verdict
// ---------------------------------------------------------------------------
describe('tow summary verdict matches detailed calculator', () => {
  test('GMC Hummer EV Pickup x Classic 33FB is OVER in both places', () => {
    // Real divergence case: maxTow-only logic said "tight" (10,000/12,000 = 83%),
    // but the three-limit verdict is OVER on payload (108%). The summary table
    // and the detailed calculator must now agree.
    const v = vehicles.find((x) => /hummer/i.test(x.name));
    const t = trailers.find((x) => x.slug === 'classic-33fb-2026');
    assert.ok(v, 'Hummer EV Pickup must exist in tow dataset');
    assert.ok(t, 'classic-33fb-2026 must exist');
    const ev = evaluateTow(v, t, { truckLoadLb: 300 });
    assert.equal(ev.verdict, 'over', `expected over, got ${ev.verdict} (binding: ${ev.binding.key})`);
    assert.equal(ev.binding.key, 'payload', 'payload must be the binding limit');
    // the summary table must say the same: the Hummer row carries the over verdict class
    const html = renderDetail(t);
    const rowRe = new RegExp(`<tr class="compat-over">[\\s\\S]{0,200}?${v.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
    assert.ok(rowRe.test(html), 'summary table must mark Hummer EV Pickup as Over limit, like the calculator');
  });

  test('summary intro says verdict is the binding of three checks', () => {
    const t = trailers[0];
    const html = renderDetail(t);
    assert.ok(html.includes('binding of three checks'), 'summary intro must explain the three-limit verdict');
  });
});

// ---------------------------------------------------------------------------
// 5. Explore canonical
// ---------------------------------------------------------------------------
describe('explore.html canonical', () => {
  test('explore.html canonicalizes to itself, not index.html', () => {
    const html = renderExplore(trailers);
    assert.ok(html.includes('rel="canonical"'), 'explore.html must have a canonical tag');
    assert.ok(!html.includes('<link rel="canonical" href="index.html"'), 'explore.html canonical must not point at index.html');
    assert.match(html, /<link rel="canonical" href="[^"]*explore\.html"/, 'explore.html canonical must be explore.html');
  });
});
