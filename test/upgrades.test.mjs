import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadUpgrades, validateUpgrades, renderUpgradesBody, TIER_META, PIP_MAX,
} from '../src/lib/upgrades.mjs';

const data = loadUpgrades();

// A minimal valid item factory, so each negative test changes exactly one thing.
function okItem(over = {}) {
  return Object.assign({
    name: 'Y', why: 'z', type: 'Factory',
    image: 'assets/img/upgrades/lithium.webp',
    consensus: 'Near-universal', consensusNote: 'cited',
    useCases: ['Boondocking'],
    sources: [{ label: 'a', url: 'https://a.com' }],
  }, over);
}
function wrap(item, extra = {}) {
  return Object.assign({
    useCaseLegend: { Boondocking: 'b', 'Full-timing': 'f' },
    categories: [{ id: 'x', title: 'X', items: [item] }],
  }, extra);
}

test('upgrades dataset loads with categories and items', () => {
  assert.ok(data && Array.isArray(data.categories));
  assert.ok(data.categories.length >= 4, `expected several categories, got ${data.categories.length}`);
  const total = data.categories.reduce((n, c) => n + c.items.length, 0);
  assert.ok(total >= 15, `expected a real list of upgrades, got ${total}`);
});

test('every item is type-tagged and carries at least one source (the contract)', () => {
  const problems = validateUpgrades(data);
  assert.deepEqual(problems, [], problems.join('\n'));
});

test('validator catches a missing type', () => {
  const bad = { categories: [{ id: 'x', title: 'X', items: [{ name: 'Y', why: 'z', type: 'Nope', sources: [{ label: 'a', url: 'https://a.com' }] }] }] };
  const problems = validateUpgrades(bad);
  assert.ok(problems.some((p) => p.includes('bad type')), problems.join('\n'));
});

test('validator catches a missing source', () => {
  const bad = { categories: [{ id: 'x', title: 'X', items: [{ name: 'Y', why: 'z', type: 'Factory', sources: [] }] }] };
  const problems = validateUpgrades(bad);
  assert.ok(problems.some((p) => p.includes('at least one source')), problems.join('\n'));
});

test('validator catches a non-http source url', () => {
  const bad = { categories: [{ id: 'x', title: 'X', items: [{ name: 'Y', why: 'z', type: 'Both', sources: [{ label: 'a', url: 'ftp://a' }] }] }] };
  const problems = validateUpgrades(bad);
  assert.ok(problems.some((p) => p.includes('not http(s)')), problems.join('\n'));
});

test('the power category carries the factory program table, fully sourced', () => {
  const power = data.categories.find((c) => c.id === 'power');
  assert.ok(power && power.table, 'power category should have a table');
  const t = power.table;
  assert.ok(Array.isArray(t.columns) && t.columns.length >= 3);
  assert.ok(Array.isArray(t.rows) && t.rows.length >= 5, `expected per-model rows, got ${t.rows && t.rows.length}`);
  for (const r of t.rows) assert.equal(r.length, t.columns.length, `row width: ${JSON.stringify(r)}`);
  assert.ok(Array.isArray(t.sources) && t.sources.length >= 1);
  for (const s of t.sources) assert.match(s.url, /^https:\/\//);
  // Trade Wind's standout official numbers must be present and correct.
  const flat = JSON.stringify(t.rows);
  assert.ok(flat.includes('810Ah'), 'Trade Wind 810Ah should be in the table');
  assert.ok(flat.includes('600W'), 'Trade Wind 600W should be in the table');
});

test('validator catches a table row whose width != columns', () => {
  const bad = { categories: [{ id: 'x', title: 'X',
    items: [{ name: 'Y', why: 'z', type: 'Factory', sources: [{ label: 'a', url: 'https://a.com' }] }],
    table: { columns: ['a', 'b'], rows: [['only-one']], sources: [{ label: 's', url: 'https://s.com' }] } }] };
  const problems = validateUpgrades(bad);
  assert.ok(problems.some((p) => p.includes('row width')), problems.join('\n'));
});

test('validator requires a table to carry a source', () => {
  const bad = { categories: [{ id: 'x', title: 'X',
    items: [{ name: 'Y', why: 'z', type: 'Factory', sources: [{ label: 'a', url: 'https://a.com' }] }],
    table: { columns: ['a'], rows: [['v']], sources: [] } }] };
  const problems = validateUpgrades(bad);
  assert.ok(problems.some((p) => p.includes('table: needs at least one source')), problems.join('\n'));
});

test('renderUpgradesBody renders the factory table with headers and Trade Wind row', () => {
  const html = renderUpgradesBody(data, '');
  assert.ok(html.includes('up-table'), 'should emit the table');
  assert.ok(html.includes('Trade Wind'));
  assert.ok(html.includes('810Ah'));
  assert.ok(html.includes('Rooftop solar'));
});

test('renderUpgradesBody emits cards, badges, jump nav and escapes', () => {
  const html = renderUpgradesBody(data, '');
  assert.ok(html.includes('What owners actually add'));
  assert.ok(html.includes('up-card'));
  assert.ok(html.includes('up-badge'));
  assert.ok(html.includes('up-jump'));
  // factory + aftermarket both present in the real dataset
  assert.ok(html.includes('Factory option'));
  assert.ok(html.includes('Aftermarket'));
  // every source url should be rendered as a link
  const firstUrl = data.categories[0].items[0].sources[0].url;
  assert.ok(html.includes(firstUrl));
});

test('renderUpgradesBody escapes HTML in fields', () => {
  const evil = {
    intro: 'safe',
    categories: [{
      id: 'x', title: 'T', blurb: 'b',
      items: [{ name: '<script>', why: 'a & b', type: 'Factory', priceText: '<x>', popular: 'p', sources: [{ label: '<i>', url: 'https://a.com' }] }],
    }],
  };
  const html = renderUpgradesBody(evil, '');
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('a &amp; b'));
});

// --- Community-signal contract -------------------------------------------

test('every real item declares a valid consensus tier + evidence note', () => {
  for (const c of data.categories) {
    for (const it of c.items) {
      assert.ok(TIER_META[it.consensus], `${c.id}/${it.name}: bad tier "${it.consensus}"`);
      assert.ok(it.consensusNote && it.consensusNote.length > 0, `${c.id}/${it.name}: missing consensusNote`);
      assert.ok(Array.isArray(it.useCases), `${c.id}/${it.name}: useCases not array`);
    }
  }
});

test('every item use-case is defined in the legend vocabulary', () => {
  const legend = new Set(Object.keys(data.useCaseLegend || {}));
  for (const c of data.categories) {
    for (const it of c.items) {
      for (const u of it.useCases) assert.ok(legend.has(u), `${c.id}/${it.name}: unknown use-case "${u}"`);
    }
  }
});

test('TIER_META pip counts stay within the meter range', () => {
  for (const m of Object.values(TIER_META)) {
    assert.ok(m.pips >= 1 && m.pips <= PIP_MAX, `tier pips out of range: ${m.pips}`);
  }
});

test('validator catches a bad consensus tier', () => {
  const problems = validateUpgrades(wrap(okItem({ consensus: 'Wildly popular' })));
  assert.ok(problems.some((p) => p.includes('bad consensus tier')), problems.join('\n'));
});

test('validator catches a missing consensusNote', () => {
  const item = okItem(); delete item.consensusNote;
  const problems = validateUpgrades(wrap(item));
  assert.ok(problems.some((p) => p.includes('missing consensusNote')), problems.join('\n'));
});

test('validator catches an unknown use-case', () => {
  const problems = validateUpgrades(wrap(okItem({ useCases: ['Spelunking'] })));
  assert.ok(problems.some((p) => p.includes('unknown useCase')), problems.join('\n'));
});

// --- Image contract -------------------------------------------------------

test('every real item carries a valid upgrades image path', () => {
  const re = /^assets\/img\/upgrades\/[a-z0-9-]+\.webp$/;
  for (const c of data.categories) {
    for (const it of c.items) {
      assert.ok(re.test(it.image || ''), `${c.id}/${it.name}: bad image "${it.image}"`);
    }
  }
});

test('validator catches a missing image', () => {
  const item = okItem(); delete item.image;
  const problems = validateUpgrades(wrap(item));
  assert.ok(problems.some((p) => p.includes('missing image')), problems.join('\n'));
});

test('validator catches a malformed image path', () => {
  const problems = validateUpgrades(wrap(okItem({ image: 'http://x.com/a.png' })));
  assert.ok(problems.some((p) => p.includes('image must be')), problems.join('\n'));
});

test('renderUpgradesBody emits a lazy-loaded card image with relRoot', () => {
  const html = renderUpgradesBody(data, '../');
  assert.ok(html.includes('class="up-media"'), 'has media frame');
  assert.ok(html.includes('src="../assets/img/upgrades/'), 'prefixes relRoot on image src');
  assert.ok(html.includes('loading="lazy"'), 'image is lazy-loaded');
});

test('validator flags a dataset with no useCaseLegend', () => {
  const bad = { categories: [{ id: 'x', title: 'X', items: [okItem()] }] };
  const problems = validateUpgrades(bad);
  assert.ok(problems.some((p) => p.includes('missing useCaseLegend')), problems.join('\n'));
});

test('renderUpgradesBody emits the consensus meter, legend, filter lens and use-case chips', () => {
  const html = renderUpgradesBody(data, '');
  assert.ok(html.includes('up-consensus'), 'card consensus meter');
  assert.ok(html.includes('up-pip'), 'pip elements');
  assert.ok(html.includes('up-legend'), 'consensus legend');
  assert.ok(html.includes('up-lens'), 'filter lens');
  assert.ok(html.includes('data-filter="consensus"'), 'consensus filter chips');
  assert.ok(html.includes('data-filter="uc"'), 'use-case filter chips');
  assert.ok(html.includes('data-consensus='), 'cards carry consensus data attr');
  assert.ok(html.includes('data-uc='), 'cards carry use-case data attr');
  // The lens ships hidden so it never flashes for no-JS readers.
  assert.ok(/id="up-lens"[^>]*hidden/.test(html), 'lens hidden by default');
});

test('cards expose the pip count matching their tier (render ↔ TIER_META)', () => {
  const html = renderUpgradesBody(data, '');
  // Near-universal == PIP_MAX pips; the data-pips attr must reflect it.
  assert.ok(html.includes(`data-pips="${TIER_META['Near-universal'].pips}"`));
});
