import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadBoondocking, validateBoondocking, renderCampsitesBody, LENS_META,
  buildCampsiteMapData,
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

// ---- Boondock illustration: varied, self-contained, no cross-card bleed ----
test('every boondock card draws its own illustration with a unique gradient id', () => {
  const html = renderCampsitesBody({ stays: [] }, boon, '');
  const arts = (html.match(/class="bd-art"/g) || []).length;
  assert.equal(arts, boon.sites.length, 'one illustration per boondock card');
  // Each card must scope its own gradient id, or sky gradients bleed across cards.
  const ids = html.match(/id="bdsky-[a-z0-9]+"/gi) || [];
  assert.equal(ids.length, boon.sites.length, 'a gradient id per card');
  assert.equal(new Set(ids).size, ids.length, 'gradient ids must be unique per card');
  // The old single shared id must be gone.
  assert.ok(!/id="bdsky"/.test(html), 'no shared bdsky id (caused cross-card render bleed)');
});

test('boondock illustrations vary by region, not one repeated placeholder', () => {
  // Pull the per-card sky gradient stop colors; a desert AZ card and an alpine
  // CO/high card must not paint the same sky, or the wall looks copy-pasted.
  const html = renderCampsitesBody({ stays: [] }, boon, '');
  const skies = [...html.matchAll(/<linearGradient id="bdsky-[^"]+"[^>]*>\s*<stop offset="0" stop-color="(#[0-9a-f]{6})"/gi)]
    .map((m) => m[1].toLowerCase());
  assert.equal(skies.length, boon.sites.length, 'a sky color per card');
  assert.ok(new Set(skies).size >= 3, `expected several distinct biome skies, got ${new Set(skies).size}`);
});

// ---- All-lenses map ------------------------------------------------------
test('buildCampsiteMapData returns one point per coord-bearing site', () => {
  const pts = buildCampsiteMapData(over, boon);
  const expected = over.stays.filter((s) => typeof s.lat === 'number' && typeof s.lon === 'number').length
    + boon.sites.filter((s) => typeof s.lat === 'number' && typeof s.lon === 'number').length;
  assert.equal(pts.length, expected, 'a map point per site that has coordinates');
});

test('every map point has finite US-range coords, an id, a name and a link', () => {
  const pts = buildCampsiteMapData(over, boon);
  for (const p of pts) {
    assert.ok(Number.isFinite(p.y) && Number.isFinite(p.x), `${p.n}: finite coords`);
    assert.ok(p.y >= 24 && p.y <= 50, `${p.n}: lat in US range`);
    assert.ok(p.x >= -125 && p.x <= -66, `${p.n}: lon in US range`);
    assert.ok(p.i && p.n && p.u, `${p.n}: id+name+url present`);
    assert.ok(['view', 'utility', 'boondock'].includes(p.l), `${p.n}: valid lens`);
  }
});

test('map points carry the lens split that matches the cards', () => {
  const pts = buildCampsiteMapData(over, boon);
  const byLens = pts.reduce((m, p) => { m[p.l] = (m[p.l] || 0) + 1; return m; }, {});
  assert.equal(byLens.boondock, boon.sites.length, 'every boondock site maps');
  assert.equal((byLens.view || 0) + (byLens.utility || 0), over.stays.length, 'every gov stay maps');
});

test('boondock map points stay honest: community tier, no rating, no price', () => {
  const pts = buildCampsiteMapData({ stays: [] }, boon);
  for (const p of pts) {
    assert.equal(p.l, 'boondock');
    assert.equal(p.t, 'community', `${p.n}: community tier`);
    assert.equal(p.r, undefined, `${p.n}: no rating on a community point`);
    assert.equal(p.p, undefined, `${p.n}: no price on a community point`);
    assert.match(p.u, /openstreetmap\.org/, `${p.n}: OSM link`);
  }
});

test('verified gov map points carry their rating and recreation.gov link', () => {
  const pts = buildCampsiteMapData(over, { sites: [] });
  for (const p of pts) {
    assert.equal(p.t, 'verified');
    assert.equal(typeof p.r, 'number', `${p.n}: rating present`);
    assert.match(p.u, /recreation\.gov/, `${p.n}: recreation.gov link`);
  }
});

test('renderCampsitesBody emits the map element and a CSP-safe data island', () => {
  const html = renderCampsitesBody(over, boon, '');
  assert.ok(html.includes('id="cs-map"'), 'map container present');
  assert.ok(html.includes('id="cs-map-data"'), 'json data island present');
  assert.ok(html.includes('type="application/json"'), 'island is a JSON script (no inline JS)');
  // the island must parse and hold the full point set
  const m = html.match(/<script type="application\/json" id="cs-map-data">([\s\S]*?)<\/script>/);
  assert.ok(m, 'island matched');
  const pts = JSON.parse(m[1].replace(/\\u003c/g, '<'));
  assert.equal(pts.length, buildCampsiteMapData(over, boon).length, 'island holds every point');
});

test('the map JSON island neutralizes < so it cannot break out of the script', () => {
  const html = renderCampsitesBody(over, boon, '');
  const m = html.match(/<script type="application\/json" id="cs-map-data">([\s\S]*?)<\/script>/);
  assert.ok(m, 'island matched');
  assert.ok(!m[1].includes('</'), 'no raw </ inside the island');
});

test('the map legend names all three lenses by their dot', () => {
  const html = renderCampsitesBody(over, boon, '');
  assert.ok(html.includes('cs-dot--view'));
  assert.ok(html.includes('cs-dot--utility'));
  assert.ok(html.includes('cs-dot--boondock'));
});
