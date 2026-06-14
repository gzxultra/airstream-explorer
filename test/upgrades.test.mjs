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
