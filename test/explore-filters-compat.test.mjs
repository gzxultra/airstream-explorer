// Tests for: explore tow vehicle picker, length/weight filters, detail compat table
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderExploreSections, renderDetail } from '../src/lib/render.mjs';
import { loadTrailers } from '../src/lib/data.mjs';
import { loadVehicles } from '../src/lib/tow.mjs';

const trailers = loadTrailers();
const vehicles = loadVehicles();

// --- Explore tow vehicle picker ---

test('explore page has a tow vehicle picker dropdown', () => {
  const html = renderExploreSections(trailers);
  assert.ok(html.includes('id="tow-vehicle-pick"'), 'tow-vehicle-pick select present');
  assert.ok(html.includes('Select a vehicle'), 'default option present');
  assert.ok(html.includes('data-tow='), 'vehicle options carry data-tow');
});

test('explore tow picker has all 20 vehicles sorted by tow rating', () => {
  const html = renderExploreSections(trailers);
  const matches = html.match(/data-tow="(\d+)"/g);
  assert.ok(matches, 'data-tow options found');
  assert.equal(matches.length, vehicles.length, `has ${vehicles.length} vehicle options`);
  // Verify sorted ascending by tow rating
  const ratings = matches.map(m => parseInt(m.match(/\d+/)[0], 10));
  for (let i = 1; i < ratings.length; i++) {
    assert.ok(ratings[i] >= ratings[i - 1], `vehicles sorted ascending: ${ratings[i]} >= ${ratings[i - 1]}`);
  }
});

test('explore tow picker includes manual-entry fallback', () => {
  const html = renderExploreSections(trailers);
  assert.ok(html.includes('value="custom"'), 'custom/manual option exists');
  assert.ok(html.includes('id="tow-input"'), 'manual lb input still present');
});

// --- Length & weight range filters ---

test('explore page has a max-length filter', () => {
  const html = renderExploreSections(trailers);
  assert.ok(html.includes('id="x-length"'), 'length select present');
  assert.ok(html.includes('Max length'), 'label reads Max length');
  // Check that meaningful length thresholds are offered
  assert.ok(html.includes('value="20"'), 'under 20 ft option');
  assert.ok(html.includes('value="25"'), 'under 25 ft option');
  assert.ok(html.includes('value="30"'), 'under 30 ft option');
});

test('explore page has a max-weight filter', () => {
  const html = renderExploreSections(trailers);
  assert.ok(html.includes('id="x-weight"'), 'weight select present');
  assert.ok(html.includes('Max dry weight'), 'label reads Max dry weight');
  assert.ok(html.includes('value="4000"'), 'under 4,000 lb option');
  assert.ok(html.includes('value="5500"'), 'under 5,500 lb option');
  assert.ok(html.includes('value="7000"'), 'under 7,000 lb option');
});

// --- Detail page compatible vehicles panel ---

test('detail page includes a compatible tow vehicles table', () => {
  const t = trailers.find(t => t.slug === 'bambi-16rb-2026');
  const html = renderDetail(t, undefined, null, trailers);
  assert.ok(html.includes('compat-vehicles'), 'compat-vehicles section present');
  assert.ok(html.includes('What can tow it?'), 'section heading present');
  assert.ok(html.includes('compat-table'), 'table rendered');
});

test('compat table has all 20 vehicles with correct verdicts', () => {
  const t = trailers.find(t => t.slug === 'bambi-16rb-2026');
  const html = renderDetail(t, undefined, null, trailers);
  // Bambi 16RB has GVWR 3500 — most vehicles should be compat-ok
  const okCount = (html.match(/compat-ok/g) || []).length;
  const overCount = (html.match(/compat-over/g) || []).length;
  assert.ok(okCount > 15, `most vehicles should be OK for Bambi 16RB (got ${okCount})`);
  // Jeep Wrangler is exactly 3500 — should be tight (within 80-100%)
  assert.ok(html.includes('Jeep Wrangler'), 'Jeep Wrangler listed');
});

test('compat table for heavy trailer shows many over-limit vehicles', () => {
  const t = trailers.find(t => t.slug === 'classic-33fb-2026');
  const html = renderDetail(t, undefined, null, trailers);
  const overCount = (html.match(/compat-over/g) || []).length;
  assert.ok(overCount >= 10, `most vehicles should be OVER for Classic 33FB (got ${overCount})`);
});

test('compat table shows margin with + for safe vehicles', () => {
  const t = trailers.find(t => t.slug === 'bambi-16rb-2026');
  const html = renderDetail(t, undefined, null, trailers);
  assert.ok(html.includes('+'), 'positive margin shown with + prefix');
  assert.ok(html.includes('lb margin'), 'margin units shown');
});

test('detail section nav includes Vehicles link', () => {
  const t = trailers.find(t => t.slug === 'flying-cloud-25fb-2026');
  const html = renderDetail(t, undefined, null, trailers);
  assert.ok(html.includes('#vehicles'), 'vehicles anchor in section nav');
  assert.ok(html.includes('>Vehicles<'), 'Vehicles label in nav');
});
