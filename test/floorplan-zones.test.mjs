// test/floorplan-zones.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FLOORPLAN_ZONES, zonesFor, renderFloorplanZones, renderFloorplanLegend,
} from '../src/lib/floorplan-zones.mjs';

test('zonesFor returns null for unverified / missing floorplans (honest fallback)', () => {
  assert.equal(zonesFor(null), null);
  assert.equal(zonesFor(''), null);
  assert.equal(zonesFor('99ZZ'), null, 'a plan we have not verified gets no markers');
});

test('zonesFor is case-insensitive on the floorplan code', () => {
  assert.ok(zonesFor('25fb'));
  assert.ok(zonesFor('25FB'));
});

test('every defined zone has in-range coordinates and real copy', () => {
  for (const [code, zones] of Object.entries(FLOORPLAN_ZONES)) {
    assert.ok(zones.length >= 3, `${code} should have a few zones`);
    const ids = new Set();
    for (const z of zones) {
      assert.ok(z.id && !ids.has(z.id), `${code}: zone ids unique (${z.id})`);
      ids.add(z.id);
      assert.ok(z.label && z.label.length > 1, `${code}/${z.id}: has a label`);
      assert.ok(z.blurb && z.blurb.length > 12, `${code}/${z.id}: has a real blurb`);
      assert.ok(z.x >= 0 && z.x <= 100, `${code}/${z.id}: x in 0..100 (${z.x})`);
      assert.ok(z.y >= 0 && z.y <= 100, `${code}/${z.id}: y in 0..100 (${z.y})`);
    }
  }
});

test('25FB zones cover the expected fixtures', () => {
  const ids = zonesFor('25FB').map((z) => z.id);
  for (const want of ['bed', 'shower', 'lav', 'wardrobe', 'cooktop', 'galley', 'lounge']) {
    assert.ok(ids.includes(want), `25FB should label the ${want}`);
  }
});

test('renderFloorplanZones emits one marker+dot+popover per zone, no stray legend', () => {
  const html = renderFloorplanZones('25FB');
  const zones = zonesFor('25FB');
  assert.equal((html.match(/class="fp-marker/g) || []).length, zones.length);
  assert.equal((html.match(/class="fp-dot"/g) || []).length, zones.length);
  assert.equal((html.match(/class="fp-pop"/g) || []).length, zones.length);
  // The legend must NOT be inside the overlay (it lives outside the image stage).
  assert.ok(!html.includes('fp-legend'), 'overlay markup carries no legend');
  // Each dot wires aria-controls to its popover id for a11y.
  for (const z of zones) {
    assert.ok(html.includes(`aria-controls="fp-pop-${z.id}"`), `${z.id} aria wired`);
    assert.ok(html.includes(`id="fp-pop-${z.id}"`), `${z.id} popover present`);
  }
});

test('high markers flip their bubble below so it cannot clip off the top', () => {
  const html = renderFloorplanZones('25FB');
  // bed sits at y:20 (<28) → should get the --below modifier.
  assert.ok(html.includes('fp-marker--below'), 'a high zone flips below');
});

test('renderFloorplanLegend emits an ordered list with one item per zone', () => {
  const html = renderFloorplanLegend('25FB');
  const zones = zonesFor('25FB');
  assert.ok(html.startsWith('<ol'), 'legend is an ordered list');
  assert.equal((html.match(/class="fp-leg-item"/g) || []).length, zones.length);
  for (const z of zones) {
    assert.ok(html.includes(`data-fp-leg="${z.id}"`), `${z.id} legend row present`);
  }
});

test('unverified floorplans render neither overlay nor legend (plain image only)', () => {
  assert.equal(renderFloorplanZones('99ZZ'), '');
  assert.equal(renderFloorplanLegend('99ZZ'), '');
});

test('zone copy makes no fabricated hookup/price/spec claims', () => {
  // Guards against drifting into invented numbers — zones describe layout only.
  for (const zones of Object.values(FLOORPLAN_ZONES)) {
    for (const z of zones) {
      assert.ok(!/\$\d/.test(z.blurb), `${z.id}: no prices in a layout blurb`);
      assert.ok(!/\b\d+\s?(gal|lbs?|amp|watt)/i.test(z.blurb), `${z.id}: no spec numbers in a layout blurb`);
    }
  }
});

// --- 2026-06-17: six additional verified floorplan codes ---------------------
// Each code below was coord-read off its canonical official Airstream diagram
// and dot-verified. Codes are shared identically across every trim that uses
// them (e.g. 27FB = Flying Cloud / Globetrotter / International / Stetson /
// Trade Wind), so one verified zone set legitimately covers many trailers.

test('newly verified codes are all present', () => {
  for (const code of ['23FB', '27FB', '30RB', '16RB', '20FB', '22FB']) {
    assert.ok(zonesFor(code), `${code} should be verified and present`);
  }
});

test('each new code labels its defining fixtures', () => {
  const want = {
    '27FB': ['bed', 'shower', 'lav', 'galley', 'lounge'],
    '23FB': ['bed', 'galley', 'lounge', 'shower', 'toilet'],
    '30RB': ['frontlounge', 'galley', 'shower', 'bed'], // rear-bed layout
    '16RB': ['frontseat', 'galley', 'bath', 'bed'],
    '20FB': ['bed', 'galley', 'shower', 'dinette'],
    '22FB': ['bed', 'galley', 'cooktop', 'shower'],
  };
  for (const [code, ids] of Object.entries(want)) {
    const have = zonesFor(code).map((z) => z.id);
    for (const id of ids) assert.ok(have.includes(id), `${code} should label ${id}`);
  }
});

test('rear-bed (30RB) puts the bed in the rear, front-bed (FB codes) put it forward', () => {
  // The bed sits aft on a rear-bed plan and forward on a front-bed plan — a
  // cheap guard that we did not mix up the two opposite skeletons.
  const bed30 = zonesFor('30RB').find((z) => z.id === 'bed');
  assert.ok(bed30.y > 60, '30RB bed is in the rear half');
  for (const code of ['23FB', '27FB', '20FB', '22FB']) {
    const bed = zonesFor(code).find((z) => z.id === 'bed');
    assert.ok(bed.y < 30, `${code} bed is up front`);
  }
});

test('render + legend work for every verified code (not just 25FB)', () => {
  for (const code of Object.keys(FLOORPLAN_ZONES)) {
    const overlay = renderFloorplanZones(code);
    const legend = renderFloorplanLegend(code);
    const n = zonesFor(code).length;
    assert.equal((overlay.match(/class="fp-marker/g) || []).length, n, `${code} markers`);
    assert.equal((legend.match(/class="fp-leg-item"/g) || []).length, n, `${code} legend rows`);
  }
});
