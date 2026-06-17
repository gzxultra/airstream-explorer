import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadBoondocking, validateBoondocking, renderCampsitesBody, LENS_META,
} from '../src/lib/campsites.mjs';
import { loadOvernight } from '../src/lib/overnight.mjs';

const boon = loadBoondocking();
const over = loadOvernight();

// A minimal valid boondocking site, so each negative test changes exactly one thing.
function okSite(over = {}) {
  return Object.assign({
    id: 'osm-123', name: 'Test Flat Dispersed', agency: 'USFS', state: 'Utah',
    lat: 38.5, lon: -111.5, fee: 'free', reservation: 'first-come', hookups: 'none',
    maxLengthFt: null, capacity: null, elevationFt: 6000, surface: null, access: null,
    rating: null, reviews: null, photo: null,
    source: 'OpenStreetMap', sourceLicense: 'ODbL', verified: false,
    osmUrl: 'https://www.openstreetmap.org/node/123',
  }, over);
}
function wrap(sites) { return { sites }; }

test('boondocking dataset loads with a real list of sites', () => {
  assert.ok(boon && Array.isArray(boon.sites));
  assert.ok(boon.sites.length >= 50, `expected the full set, got ${boon.sites.length}`);
});

test('the shipped boondocking dataset passes the provenance contract', () => {
  const problems = validateBoondocking(boon);
  assert.deepEqual(problems, [], problems.join('\n'));
});

test('every shipped boondocking site is OSM-sourced and unverified', () => {
  for (const s of boon.sites) {
    assert.equal(s.source, 'OpenStreetMap', `${s.name}: source`);
    assert.equal(s.verified, false, `${s.name}: verified flag`);
    assert.match(s.osmUrl, /openstreetmap\.org/, `${s.name}: osmUrl`);
  }
});

// THE ACCURACY BAR: a community site must never carry fabricated gov-grade data.
test('a boondocking site with a fabricated rating fails validation', () => {
  const p = validateBoondocking(wrap([okSite({ rating: 4.8 })]));
  assert.ok(p.some((x) => /must not carry a rating/.test(x)), p.join('\n'));
});
test('a boondocking site with a fabricated photo fails validation', () => {
  const p = validateBoondocking(wrap([okSite({ photo: 'https://cdn.recreation.gov/x_700.webp' })]));
  assert.ok(p.some((x) => /must not carry a photo/.test(x)), p.join('\n'));
});
test('a boondocking site with fabricated reviews fails validation', () => {
  const p = validateBoondocking(wrap([okSite({ reviews: 200 })]));
  assert.ok(p.some((x) => /must not carry reviews/.test(x)), p.join('\n'));
});

test('a boondocking site claiming hookups fails validation', () => {
  const p = validateBoondocking(wrap([okSite({ hookups: 'full' })]));
  assert.ok(p.some((x) => /can't have hookups/.test(x)), p.join('\n'));
});
test('a boondocking site claiming a reservation fails validation', () => {
  const p = validateBoondocking(wrap([okSite({ reservation: 'reservable' })]));
  assert.ok(p.some((x) => /first-come/.test(x)), p.join('\n'));
});
test('a site missing coordinates fails validation', () => {
  const p = validateBoondocking(wrap([okSite({ lat: null })]));
  assert.ok(p.some((x) => /missing coords/.test(x)), p.join('\n'));
});
test('a site with a non-OSM source fails validation', () => {
  const p = validateBoondocking(wrap([okSite({ source: 'Campendium' })]));
  assert.ok(p.some((x) => /source must be OpenStreetMap/.test(x)), p.join('\n'));
});
test('a site marked verified:true fails validation', () => {
  const p = validateBoondocking(wrap([okSite({ verified: true })]));
  assert.ok(p.some((x) => /verified:false/.test(x)), p.join('\n'));
});
test('a duplicate id fails validation', () => {
  const p = validateBoondocking(wrap([okSite(), okSite()]));
  assert.ok(p.some((x) => /duplicate id/.test(x)), p.join('\n'));
});
test('coords outside the US fail validation', () => {
  const p = validateBoondocking(wrap([okSite({ lat: 12.3, lon: 100.0 })]));
  assert.ok(p.some((x) => /out of US range/.test(x)), p.join('\n'));
});

// LENS_META contract
test('LENS_META has exactly the three lenses in display order', () => {
  assert.deepEqual(Object.keys(LENS_META), ['view', 'utility', 'boondock']);
  assert.equal(LENS_META.view.tier, 'verified');
  assert.equal(LENS_META.utility.tier, 'verified');
  assert.equal(LENS_META.boondock.tier, 'community');
});

// Render contract
test('renderCampsitesBody merges all three lenses into one grid', () => {
  const html = renderCampsitesBody(over, boon, '');
  assert.ok(html.includes('data-value="view"'));
  assert.ok(html.includes('data-value="utility"'));
  assert.ok(html.includes('data-value="boondock"'));
  // one boondock card per site, one verified card per stay
  const boonCards = (html.match(/ov-card--boondock/g) || []).length;
  const govCards = (html.match(/data-tier="verified"/g) || []).length;
  assert.equal(boonCards, boon.sites.length, 'a card per boondock site');
  assert.equal(govCards, over.stays.length, 'a card per gov stay');
});

test('boondocking cards never emit a star rating or a photo img', () => {
  const html = renderCampsitesBody({ stays: [] }, boon, '');
  // With only boondock data, there must be NO rating spans and NO <img> at all.
  assert.ok(!/ov-rating/.test(html), 'no rating widgets on boondock-only render');
  assert.ok(!/<img/.test(html), 'no photo imgs on boondock-only render');
  // and the honest provenance line is present on each
  const prov = (html.match(/bd-provenance/g) || []).length;
  assert.equal(prov, boon.sites.length, 'provenance line on every boondock card');
});

test('campsites render carries no raw recreation.gov CDN links', () => {
  const html = renderCampsitesBody(over, boon, '');
  assert.ok(!html.includes('cdn.recreation.gov'), 'gov photos must route through /cdn/ proxy');
});
