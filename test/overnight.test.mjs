import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  loadOvernight, validateOvernight, renderOvernightBody, titleCase, LENS_META,
} from '../src/lib/overnight.mjs';

const data = loadOvernight();

// A minimal valid stay, so each negative test changes exactly one thing.
function okStay(over = {}) {
  return Object.assign({
    id: '1', name: 'Test Overlook', lens: 'view', state: 'Oregon',
    city: 'Bend', lat: 44.0, lon: -121.3, rating: 4.6, reviews: 120,
    price: { min: 20, max: 20 }, hookups: 'none', dumpStation: false,
    drinkingWater: true, maxLengthFt: 30, bigRig: false, elevationFt: 6000,
    parent: 'Deschutes National Forest',
    photo: 'https://cdn.recreation.gov/public/x/y_700.webp',
    url: 'https://www.recreation.gov/camping/campgrounds/1',
  }, over);
}
function wrap(stays) { return { byLens: {}, stays }; }

test('overnight dataset loads with a real list of curated stays', () => {
  assert.ok(data && Array.isArray(data.stays));
  assert.ok(data.stays.length >= 50, `expected the full curated set, got ${data.stays.length}`);
});

test('the shipped dataset passes the provenance + hookups contract', () => {
  const problems = validateOvernight(data);
  assert.deepEqual(problems, [], problems.join('\n'));
});

test('every lens is one of the two known intents', () => {
  const valid = new Set(Object.keys(LENS_META));
  for (const s of data.stays) {
    assert.ok(valid.has(s.lens), `${s.name}: unexpected lens ${s.lens}`);
  }
});

test('the hookups contract holds in the shipped data', () => {
  // A "view" pick is off-grid (no hookups); a "utility" pick must have power.
  for (const s of data.stays) {
    if (s.lens === 'view') {
      assert.ok(!s.hookups || s.hookups === 'none', `${s.name}: view site claims hookups ${s.hookups}`);
    } else if (s.lens === 'utility') {
      assert.ok(s.hookups && s.hookups !== 'none', `${s.name}: utility site has no hookups`);
    }
  }
});

test('trailer lengths are believable or null (bus-length figures suppressed)', () => {
  for (const s of data.stays) {
    if (s.maxLengthFt != null) {
      assert.ok(s.maxLengthFt >= 10 && s.maxLengthFt <= 45, `${s.name}: implausible maxLengthFt ${s.maxLengthFt}`);
    } else {
      // when length is unknown/unreliable, the card leans on the bigRig flag
      assert.ok('bigRig' in s, `${s.name}: null length but no bigRig flag`);
    }
  }
});

test('byLens metadata matches the actual records', () => {
  const counted = data.stays.reduce((m, s) => { m[s.lens] = (m[s.lens] || 0) + 1; return m; }, {});
  assert.deepEqual(data.byLens, counted);
});

test('validator: clean fixture passes', () => {
  assert.deepEqual(validateOvernight(wrap([okStay()])), []);
});

test('validator catches a bad lens', () => {
  const problems = validateOvernight(wrap([okStay({ lens: 'glamping' })]));
  assert.ok(problems.some((p) => /bad lens/.test(p)), problems.join('\n'));
});

test('validator enforces the hookups contract both ways', () => {
  // view must not have hookups
  assert.ok(validateOvernight(wrap([okStay({ lens: 'view', hookups: 'full' })])).some((p) => /view site has hookups/.test(p)));
  // utility must have hookups
  assert.ok(validateOvernight(wrap([okStay({ lens: 'utility', hookups: 'none' })])).some((p) => /utility site has no hookups/.test(p)));
});

test('validator catches a missing/invalid Recreation.gov url', () => {
  assert.ok(validateOvernight(wrap([okStay({ url: undefined })])).some((p) => /url/.test(p)));
  assert.ok(validateOvernight(wrap([okStay({ url: 'not-a-url' })])).some((p) => /url/.test(p)));
});

test('validator catches a missing photo', () => {
  assert.ok(validateOvernight(wrap([okStay({ photo: undefined })])).some((p) => /photo/.test(p)));
});

test('validator catches missing coordinates', () => {
  assert.ok(validateOvernight(wrap([okStay({ lat: undefined })])).some((p) => /coords/.test(p)));
});

test('validator catches an implausible (bus-length) maxLengthFt', () => {
  assert.ok(validateOvernight(wrap([okStay({ maxLengthFt: 189 })])).some((p) => /implausible maxLengthFt/.test(p)));
});

test('validator catches duplicate ids within a lens', () => {
  const problems = validateOvernight(wrap([okStay({ id: 'dup' }), okStay({ id: 'dup', name: 'Other' })]));
  assert.ok(problems.some((p) => /duplicate/.test(p)), problems.join('\n'));
});

test('titleCase de-SHOUTs a Recreation.gov name without mangling it', () => {
  assert.equal(titleCase('JENNY LAKE CAMPGROUND'), 'Jenny Lake Campground');
  assert.equal(titleCase('LAKE OF THE WOODS'), 'Lake of the Woods');
  // already mixed-case is trusted as-is
  assert.equal(titleCase('Kirk Creek Campground (Los Padres NF)'), 'Kirk Creek Campground (Los Padres NF)');
});

test('render: every photo is routed through the same-origin /cdn/ proxy (China-safe)', () => {
  const html = renderOvernightBody(data, '');
  // No raw cdn.recreation.gov hot-links may survive into the markup.
  assert.equal(/cdn\.recreation\.gov/.test(html), false, 'a raw CDN hot-link leaked into overnight HTML');
  // And the proxy prefix must actually be used.
  assert.ok(html.includes('src="/cdn/'), 'expected /cdn/ proxied image sources');
});

test('render: emits one card per stay with the filter + sort scaffold', () => {
  const html = renderOvernightBody(data, '');
  const cards = (html.match(/class="ov-card"/g) || []).length;
  assert.equal(cards, data.stays.length, `expected ${data.stays.length} cards, got ${cards}`);
  assert.ok(html.includes('id="ov-main"'));
  assert.ok(html.includes('id="ov-lens"'));
  assert.ok(html.includes('id="ov-sort"'));
  assert.ok(html.includes('id="ov-count"'));
  // an "All" reset chip plus a chip for each present lens
  assert.ok(html.includes('data-value="all"'), 'missing All chip');
  for (const k of Object.keys(data.byLens)) {
    assert.ok(html.includes(`data-value="${k}"`), `missing filter chip for ${k}`);
  }
});

test('render: each card carries the data-attrs the client filter + sort read', () => {
  const html = renderOvernightBody(data, '');
  // lens must be one of the known intents
  for (const m of html.matchAll(/data-lens="([^"]+)"/g)) {
    assert.ok(Object.keys(LENS_META).includes(m[1]), `unknown data-lens ${m[1]}`);
  }
  // sort keys must be present on every card
  for (const attr of ['data-rating', 'data-reviews', 'data-price']) {
    assert.ok(html.includes(attr), `missing ${attr} on cards`);
  }
});

test('CSS hides filtered cards (regression: .ov-card sets display, needs a [hidden] override)', () => {
  // The filter toggles the `hidden` attribute, but .ov-card sets display:flex
  // at equal specificity to the UA [hidden] rule — so without an explicit
  // higher-priority hide rule the count updates but cards stay visible. Guard it.
  const css = readFileSync(new URL('../src/assets/css/site.css', import.meta.url), 'utf8');
  assert.match(css, /\.ov-card\[hidden\]\s*\{[^}]*display:\s*none\s*!important/, 'missing .ov-card[hidden] hide rule');
});

test('the client wires up overnightFilter against the rendered ids', () => {
  // Guard the render↔JS contract: app.js must look up the same ids the
  // renderer emits, or the filter silently no-ops.
  const js = readFileSync(new URL('../src/assets/js/app.js', import.meta.url), 'utf8');
  assert.match(js, /overnightFilter/, 'overnightFilter IIFE missing');
  for (const id of ['ov-lens', 'ov-main', 'ov-sort', 'ov-count', 'ov-empty']) {
    assert.ok(js.includes(`'${id}'`) || js.includes(`"${id}"`), `app.js never references #${id}`);
  }
});
