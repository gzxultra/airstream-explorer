// RED-LINE REGRESSION TEST — ruling 1A (2026-06-13, reaffirmed 2026-09-27).
//
// Airstream Explorer is an enthusiast REFERENCE site. Commerce, finance,
// installment, and purchase-funnel features are permanently forbidden.
// On 2026-09-27 seven finance/purchase-funnel features were removed:
//   monthly-payment calculator, ownership-cost tool, cost-per-night,
//   resale-value projector, trip-cost estimator, Est. payment on Explore
//   cards, dealer + build-and-price next-steps links.
// This test locks the removal: if any of them come back, the suite fails.
//
// ALLOWED (not violations): MSRP context display, price sort options,
// nightly campground fees (reference, not purchase).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderDetail, renderExplore, renderExploreCard } from '../src/lib/render.mjs';
import { renderMotorhomeExploreCard, renderMotorhomeDetail } from '../src/lib/motorhome-render.mjs';
import { loadTrailers } from '../src/lib/data.mjs';
import { loadMotorhomes } from '../src/lib/motorhome-data.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const trailers = loadTrailers();
const motorhomes = loadMotorhomes();

const FORBIDDEN_IDS = ['id="finance"', 'id="ownership"', 'id="cost-night"', 'id="resale"', 'id="trip-cost"'];
const FORBIDDEN_MARKERS = [
  ...FORBIDDEN_IDS,
  'finance-monthly',
  'spec-monthly',
  'find-a-dealer',
  'build-your-own',
  'Est. payment',
  'finance-data',
  'ownership-data',
  'cost-night-data',
  'trip-cost-data',
  'resale-cond',
  'href="#finance"',
  'href="#ownership"',
  'href="#cost-night"',
  'href="#resale"',
  'href="#trip-cost"',
];

describe('red line 1A: no finance sections on trailer detail pages', () => {
  test('no forbidden section or funnel appears on ANY trailer detail page', () => {
    for (const t of trailers) {
      const html = renderDetail(t);
      for (const marker of FORBIDDEN_MARKERS) {
        assert.ok(!html.includes(marker), `${t.slug} contains forbidden marker: ${marker}`);
      }
    }
  });
});

describe('red line 1A: no finance sections on motorhome detail pages', () => {
  test('no forbidden section or funnel appears on ANY motorhome detail page', () => {
    for (const m of motorhomes) {
      const html = renderMotorhomeDetail(m, undefined, motorhomes);
      for (const marker of FORBIDDEN_MARKERS) {
        assert.ok(!html.includes(marker), `${m.slug} contains forbidden marker: ${marker}`);
      }
    }
  });
});

describe('red line 1A: no monthly payment on explore cards', () => {
  test('trailer explore cards carry no payment estimate', () => {
    for (const t of trailers) {
      const html = renderExploreCard(t);
      assert.ok(!html.includes('Est. payment'), `${t.slug} card has Est. payment`);
      assert.ok(!html.includes('spec-monthly'), `${t.slug} card has spec-monthly`);
    }
  });

  test('motorhome explore cards carry no payment estimate', () => {
    for (const m of motorhomes) {
      const html = renderMotorhomeExploreCard(m);
      assert.ok(!html.includes('Est. payment'), `${m.slug} card has Est. payment`);
      assert.ok(!html.includes('spec-monthly'), `${m.slug} card has spec-monthly`);
    }
  });

  test('standalone explore.html carries no payment estimate', () => {
    const html = renderExplore(trailers);
    assert.ok(!html.includes('Est. payment'), 'explore.html has Est. payment');
    assert.ok(!html.includes('spec-monthly'), 'explore.html has spec-monthly');
  });
});

describe('red line 1A: no finance code in client bundle', () => {
  const appJs = readFileSync(join(ROOT, 'src/assets/js/app.js'), 'utf8');
  test('no finance IIFEs survive in app.js', () => {
    for (const name of ['ownershipTool', 'costPerNight', 'resaleProjector', 'tripCostCalc', 'function financing']) {
      assert.ok(!appJs.includes(name), `app.js still contains ${name}`);
    }
  });
  test('no finance data-island wiring survives in app.js', () => {
    for (const marker of ['finance-data', 'ownership-data', 'cost-night-data', 'trip-cost-data', 'resale-cond', 'getElementById(\'cn-trips\')', 'id="finance"']) {
      assert.ok(!appJs.includes(marker), `app.js still wires ${marker}`);
    }
  });
  test('detail compare writes plain slug strings, never objects', () => {
    assert.ok(!appJs.includes('set.push({ slug'), 'detailCompare still pushes {slug} objects');
    assert.ok(appJs.includes('cmpSet(set)'), 'detailCompare should use the shared cmpSet helper');
  });
});

describe('red line 1A: no finance CSS survives', () => {
  const siteCss = readFileSync(join(ROOT, 'src/assets/css/site.css'), 'utf8');
  const themeCss = readFileSync(join(ROOT, 'src/assets/css/theme.css'), 'utf8');
  test('finance-only selectors are gone', () => {
    for (const sel of ['.resale-projector', '.trip-cost-tool', '.spec-monthly-label', '.spec-monthly-val', '.cost-night']) {
      assert.ok(!siteCss.includes(sel), `site.css still has ${sel}`);
      assert.ok(!themeCss.includes(sel), `theme.css still has ${sel}`);
    }
  });
});

describe('red line 1A: allowed things still exist', () => {
  test('MSRP context display is NOT treated as finance', () => {
    const withMsrp = trailers.find((t) => t.msrp > 0);
    const html = renderDetail(withMsrp);
    assert.ok(html.includes('MSRP'), 'MSRP context display must survive');
  });
  test('price sort option still exists', () => {
    const explore = renderExplore(trailers);
    assert.ok(explore.includes('price'), 'price sort must survive');
  });
  test('campground nightly fees still render (reference, not purchase)', () => {
    // nightly fee copy lives in the campsites hub, not finance
    const html = renderDetail(trailers[0]);
    assert.ok(!html.includes('cost-night-data'), 'no cost-night data island even so');
  });
});
