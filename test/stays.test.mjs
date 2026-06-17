import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  loadStays, validateStays, renderStaysBody, titleCase, TYPE_META,
} from '../src/lib/stays.mjs';

const data = loadStays();

// A minimal valid stay, so each negative test changes exactly one thing.
function okStay(over = {}) {
  return Object.assign({
    id: '1', name: 'Test Lookout', stayType: 'lookout', state: 'Oregon',
    city: 'Bend', lat: 44.0, lon: -121.3, rating: 4.5, reviews: 10,
    price: { min: 40, max: 40 }, reservable: true, maxLengthFt: null,
    photo: 'https://cdn.recreation.gov/public/x/y_700.webp',
    url: 'https://www.recreation.gov/camping/campgrounds/1',
  }, over);
}
function wrap(stays) { return { byType: {}, stays }; }

test('stays dataset loads with a real list of stays', () => {
  assert.ok(data && Array.isArray(data.stays));
  assert.ok(data.stays.length >= 50, `expected the full set, got ${data.stays.length}`);
});

test('the shipped dataset passes the provenance + classification contract', () => {
  const problems = validateStays(data);
  assert.deepEqual(problems, [], problems.join('\n'));
});

test('every stayType is one of the three known types', () => {
  const valid = new Set(Object.keys(TYPE_META));
  for (const s of data.stays) {
    assert.ok(valid.has(s.stayType), `${s.name}: unexpected stayType ${s.stayType}`);
  }
});

test('classification fix held: no stay NAMED a lookout is filed as a cabin', () => {
  // The collector mis-coded 34 lookouts as cabins; reclassify-stays.mjs fixed
  // them by name. Guard against regression: anything named "... lookout" /
  // "fire tower" must be classified as a lookout, never a cabin.
  const re = /\blookouts?\b|\bfire\s*tower\b/i;
  const mis = data.stays.filter((s) => re.test(s.name) && s.stayType !== 'lookout');
  assert.deepEqual(mis.map((s) => s.name), [], 'lookout-named stays mis-filed');
  // And the 7 remaining cabins must NOT be lookouts by name.
  const cabins = data.stays.filter((s) => s.stayType === 'cabin');
  assert.ok(cabins.length >= 1);
  for (const c of cabins) assert.ok(!re.test(c.name), `${c.name} is named a lookout but filed as cabin`);
});

test('byType metadata matches the actual records', () => {
  const counted = data.stays.reduce((m, s) => { m[s.stayType] = (m[s.stayType] || 0) + 1; return m; }, {});
  assert.deepEqual(data.byType, counted);
});

test('validator: clean fixture passes', () => {
  assert.deepEqual(validateStays(wrap([okStay()])), []);
});

test('validator catches a bad stayType', () => {
  const problems = validateStays(wrap([okStay({ stayType: 'mansion' })]));
  assert.ok(problems.some((p) => /bad stayType/.test(p)), problems.join('\n'));
});

test('validator catches a missing/invalid Recreation.gov url', () => {
  assert.ok(validateStays(wrap([okStay({ url: undefined })])).some((p) => /url/.test(p)));
  assert.ok(validateStays(wrap([okStay({ url: 'not-a-url' })])).some((p) => /url/.test(p)));
});

test('validator catches a missing photo', () => {
  assert.ok(validateStays(wrap([okStay({ photo: undefined })])).some((p) => /photo/.test(p)));
});

test('validator catches missing coordinates', () => {
  assert.ok(validateStays(wrap([okStay({ lat: undefined })])).some((p) => /coords/.test(p)));
});

test('validator catches duplicate ids', () => {
  const problems = validateStays(wrap([okStay({ id: 'dup' }), okStay({ id: 'dup', name: 'Other' })]));
  assert.ok(problems.some((p) => /duplicate id/.test(p)), problems.join('\n'));
});

test('titleCase de-SHOUTs a Recreation.gov name without mangling it', () => {
  assert.equal(titleCase('GARNET MOUNTAIN FIRE LOOKOUT'), 'Garnet Mountain Fire Lookout');
  assert.equal(titleCase('LAKE OF THE WOODS LOOKOUT'), 'Lake of the Woods Lookout');
  // already mixed-case is trusted as-is
  assert.equal(titleCase('Cold Springs Cabin - Ochoco NF (OR)'), 'Cold Springs Cabin - Ochoco NF (OR)');
});

test('render: every photo is routed through the same-origin /cdn/ proxy (China-safe)', () => {
  const html = renderStaysBody(data, '');
  // No raw cdn.recreation.gov hot-links may survive into the markup.
  assert.equal(/cdn\.recreation\.gov/.test(html), false, 'a raw CDN hot-link leaked into stays HTML');
  // And the proxy prefix must actually be used.
  assert.ok(html.includes('src="/cdn/'), 'expected /cdn/ proxied image sources');
});

test('render: emits one card per stay with the filter scaffold', () => {
  const html = renderStaysBody(data, '');
  const cards = (html.match(/class="stay-card"/g) || []).length;
  assert.equal(cards, data.stays.length, `expected ${data.stays.length} cards, got ${cards}`);
  assert.ok(html.includes('id="stay-main"'));
  assert.ok(html.includes('id="stay-lens"'));
  // type filter chips for each present type
  for (const t of Object.keys(data.byType)) {
    assert.ok(html.includes(`data-value="${t}"`), `missing filter chip for ${t}`);
  }
});

test('render: each card carries a data-type the client filter can match', () => {
  const html = renderStaysBody(data, '');
  for (const m of html.matchAll(/data-type="([^"]+)"/g)) {
    assert.ok(Object.keys(TYPE_META).includes(m[1]), `unknown data-type ${m[1]}`);
  }
});

test('CSS hides filtered cards (regression: .stay-card sets display, needs a [hidden] override)', () => {
  // The filter toggles the `hidden` attribute, but .stay-card sets display:flex
  // at equal specificity to the UA [hidden] rule — so without an explicit
  // higher-priority hide rule the count updates but cards stay visible. Guard it.
  const css = readFileSync(new URL('../src/assets/css/site.css', import.meta.url), 'utf8');
  assert.match(css, /\.stay-card\[hidden\]\s*\{[^}]*display:\s*none\s*!important/, 'missing .stay-card[hidden] hide rule');
});
