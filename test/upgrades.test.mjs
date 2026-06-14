import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadUpgrades, validateUpgrades, renderUpgradesBody,
} from '../src/lib/upgrades.mjs';

const data = loadUpgrades();

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
