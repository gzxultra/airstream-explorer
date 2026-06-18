import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadResourcePoints,
  validateResourcePoints,
  nearestResources,
  haversineKm,
  RESOURCE_TYPES,
} from '../src/lib/boondock-resources.mjs';

// ---------------------------------------------------------------------------
// Boondocking Resource Proximity — water fill stations and dump stations near
// boondocking locations.
//
// Data source: OpenStreetMap (ODbL) — amenity=drinking_water and
// amenity=sanitary_dump_station tags. Pre-extracted at build time via Overpass
// API into a static JSON file. Community-sourced, so we label it honestly.
//
// The module provides:
//  1. A validated static dataset of water/dump points (pre-built)
//  2. Distance calculation (haversine) from any boondocking site to nearest
//  3. A "nearest N" lookup for rendering proximity info on boondock cards
// ---------------------------------------------------------------------------

// Haversine distance tests (pure math, no data dependency)
test('haversineKm: known distance between two US cities', () => {
  // Denver (39.7392, -104.9903) to Colorado Springs (38.8339, -104.8214)
  // Real distance ~101 km
  const d = haversineKm(39.7392, -104.9903, 38.8339, -104.8214);
  assert.ok(d > 95 && d < 110, `Denver-CoSprings should be ~101km, got ${d.toFixed(1)}`);
});

test('haversineKm: same point returns 0', () => {
  assert.equal(haversineKm(40, -105, 40, -105), 0);
});

test('haversineKm: short distance accuracy', () => {
  // ~1.1 km (about 0.01 degree latitude)
  const d = haversineKm(40.0, -105.0, 40.01, -105.0);
  assert.ok(d > 1.0 && d < 1.2, `0.01° lat should be ~1.1km, got ${d.toFixed(3)}`);
});

// Resource types
test('RESOURCE_TYPES defines water and dump with labels', () => {
  assert.ok('water' in RESOURCE_TYPES);
  assert.ok('dump' in RESOURCE_TYPES);
  assert.equal(typeof RESOURCE_TYPES.water.label, 'string');
  assert.equal(typeof RESOURCE_TYPES.dump.label, 'string');
  assert.equal(typeof RESOURCE_TYPES.water.osmTag, 'string');
  assert.equal(typeof RESOURCE_TYPES.dump.osmTag, 'string');
});

// Dataset validation
test('validateResourcePoints rejects points outside US range', () => {
  const bad = [{ id: 'w1', type: 'water', lat: 10, lon: 50, name: 'X' }];
  const problems = validateResourcePoints(bad);
  assert.ok(problems.length > 0);
  assert.ok(problems.some((p) => /out of US range/.test(p)));
});

test('validateResourcePoints rejects points with missing coords', () => {
  const bad = [{ id: 'w1', type: 'water', lat: null, lon: -105, name: 'X' }];
  const problems = validateResourcePoints(bad);
  assert.ok(problems.length > 0);
});

test('validateResourcePoints rejects unknown resource types', () => {
  const bad = [{ id: 'w1', type: 'propane', lat: 40, lon: -105, name: 'X' }];
  const problems = validateResourcePoints(bad);
  assert.ok(problems.length > 0);
  assert.ok(problems.some((p) => /invalid type/.test(p)));
});

test('validateResourcePoints accepts valid water and dump points', () => {
  const good = [
    { id: 'w1', type: 'water', lat: 40.0, lon: -105.0, name: 'Town Park Spigot' },
    { id: 'd1', type: 'dump', lat: 39.5, lon: -104.5, name: 'Rest Area Dump' },
  ];
  const problems = validateResourcePoints(good);
  assert.deepEqual(problems, []);
});

// Nearest-resource lookup
test('nearestResources returns sorted by distance', () => {
  const points = [
    { id: 'w1', type: 'water', lat: 40.0, lon: -105.0, name: 'Near' },
    { id: 'w2', type: 'water', lat: 42.0, lon: -105.0, name: 'Far' },
    { id: 'w3', type: 'water', lat: 40.5, lon: -105.0, name: 'Mid' },
  ];
  const results = nearestResources({ lat: 40.0, lon: -105.0 }, points, { type: 'water', limit: 3 });
  assert.equal(results.length, 3);
  assert.equal(results[0].id, 'w1'); // nearest
  assert.equal(results[1].id, 'w3'); // mid
  assert.equal(results[2].id, 'w2'); // farthest
  // Each result has a distanceKm
  for (const r of results) {
    assert.equal(typeof r.distanceKm, 'number');
    assert.ok(r.distanceKm >= 0);
  }
});

test('nearestResources filters by type', () => {
  const points = [
    { id: 'w1', type: 'water', lat: 40.0, lon: -105.0, name: 'Water' },
    { id: 'd1', type: 'dump', lat: 40.0, lon: -105.0, name: 'Dump' },
  ];
  const water = nearestResources({ lat: 40.0, lon: -105.0 }, points, { type: 'water', limit: 5 });
  assert.equal(water.length, 1);
  assert.equal(water[0].type, 'water');
  const dump = nearestResources({ lat: 40.0, lon: -105.0 }, points, { type: 'dump', limit: 5 });
  assert.equal(dump.length, 1);
  assert.equal(dump[0].type, 'dump');
});

test('nearestResources respects limit parameter', () => {
  const points = Array.from({ length: 20 }, (_, i) => ({
    id: `w${i}`, type: 'water', lat: 40 + i * 0.1, lon: -105, name: `Point ${i}`,
  }));
  const results = nearestResources({ lat: 40, lon: -105 }, points, { type: 'water', limit: 3 });
  assert.equal(results.length, 3);
});

test('nearestResources with no matching type returns empty array', () => {
  const points = [{ id: 'w1', type: 'water', lat: 40, lon: -105, name: 'W' }];
  const results = nearestResources({ lat: 40, lon: -105 }, points, { type: 'dump', limit: 3 });
  assert.deepEqual(results, []);
});

// Load the real dataset (if it exists)
test('loadResourcePoints loads the shipped dataset', () => {
  const points = loadResourcePoints();
  assert.ok(Array.isArray(points));
  assert.ok(points.length >= 50, `expected at least 50 resource points, got ${points.length}`);
  // Validate the shipped data
  const problems = validateResourcePoints(points);
  assert.deepEqual(problems, [], problems.join('\n'));
});

test('shipped resource points include both water and dump types', () => {
  const points = loadResourcePoints();
  const types = new Set(points.map((p) => p.type));
  assert.ok(types.has('water'), 'dataset includes water points');
  assert.ok(types.has('dump'), 'dataset includes dump stations');
});
