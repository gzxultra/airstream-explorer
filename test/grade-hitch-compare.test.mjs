import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { computeGradeForces, recommendHitch, renderDetail, renderCompare } from '../src/lib/render.mjs';
import { loadTrailers } from '../src/lib/data.mjs';

const trailers = loadTrailers();
const sample = trailers.find((t) => t.gvwrLb > 5000) || trailers[0];

// =========================================================================
// 1. Grade climbing calculator — pure function tests
// =========================================================================
describe('computeGradeForces', () => {
  test('returns grade force proportional to grade %', () => {
    const r6 = computeGradeForces(7000, 6);
    const r3 = computeGradeForces(7000, 3);
    assert.ok(r6.gradeForce > r3.gradeForce, 'steeper grade → more force');
    assert.ok(r6.gradeForce > 0);
    assert.ok(r3.gradeForce > 0);
  });

  test('grade force ≈ GVWR × grade/100 for small angles', () => {
    const r = computeGradeForces(10000, 5);
    // sin(arctan(0.05)) ≈ 0.04998, so force ≈ 500
    assert.ok(r.gradeForce >= 498 && r.gradeForce <= 502, `expected ~500, got ${r.gradeForce}`);
  });

  test('rolling resistance is ~1.5% of GVWR', () => {
    const r = computeGradeForces(10000, 5);
    assert.equal(r.rollResist, 150);
  });

  test('total force = grade + rolling', () => {
    const r = computeGradeForces(8000, 6);
    assert.equal(r.totalForce, r.gradeForce + r.rollResist);
  });

  test('speed recommendation decreases with steeper grade', () => {
    const r3 = computeGradeForces(7000, 3);
    const r7 = computeGradeForces(7000, 7);
    const r10 = computeGradeForces(7000, 10);
    assert.ok(r3.maxSpeed > r7.maxSpeed, '3% faster than 7%');
    assert.ok(r7.maxSpeed > r10.maxSpeed, '7% faster than 10%');
  });

  test('rating categories', () => {
    assert.equal(computeGradeForces(7000, 3).rating, 'moderate');
    assert.equal(computeGradeForces(7000, 5).rating, 'challenging');
    assert.equal(computeGradeForces(7000, 8).rating, 'severe');
  });
});

// =========================================================================
// 2. Hitch recommendation — pure function tests
// =========================================================================
describe('recommendHitch', () => {
  test('recommends correct class for light trailer', () => {
    const r = recommendHitch(3000, 350);
    assert.equal(r.hitchClass.cls, 'II');
    assert.equal(r.needsWdh, true); // 350 lb tongue > 300 threshold
  });

  test('recommends correct class for heavy trailer', () => {
    const r = recommendHitch(8500, 850);
    assert.equal(r.hitchClass.cls, 'IV');
    assert.equal(r.needsWdh, true);
    assert.equal(r.needsAntiSway, true);
  });

  test('no WDH for very light trailer', () => {
    const r = recommendHitch(3000, 200);
    assert.equal(r.needsWdh, false);
  });

  test('anti-sway recommended above 6000 lb', () => {
    assert.equal(recommendHitch(5900, 500).needsAntiSway, false);
    assert.equal(recommendHitch(6100, 500).needsAntiSway, true);
  });
});

// =========================================================================
// 3. Detail page renders grade-climb and hitch-guide sections
// =========================================================================
describe('detail page new sections', () => {
  test('grade-climb section renders with slider and pass buttons', () => {
    const html = renderDetail(sample);
    assert.ok(html.includes('id="grade-climb"'), 'has grade-climb section');
    assert.ok(html.includes('id="grade-pct"'), 'has grade slider');
    assert.ok(html.includes('grade-pass-btn'), 'has mountain pass buttons');
    assert.ok(html.includes('Eisenhower'), 'includes Eisenhower pass');
    assert.ok(html.includes('Donner'), 'includes Donner pass');
    assert.ok(html.includes('grade-climb-data'), 'has data island');
  });

  test('hitch-guide section renders with hitch class', () => {
    const html = renderDetail(sample);
    assert.ok(html.includes('id="hitch-guide"'), 'has hitch-guide section');
    assert.ok(html.includes('Class '), 'mentions hitch class');
    assert.ok(html.includes('Brake controller'), 'mentions brake controller');
    assert.ok(html.includes('7-pin trailer connector'), 'mentions connector');
  });

  test('section nav includes Journey and Tow Setup entries', () => {
    const html = renderDetail(sample);
    assert.ok(html.includes('#journey'), 'nav has journey link');
    assert.ok(html.includes('#tow-setup'), 'nav has tow-setup link');
  });
});

// =========================================================================
// 4. Compare data island includes floorplan image paths
// =========================================================================
describe('compare floorplan', () => {
  test('compact compare data includes floorplanImg', () => {
    const html = renderCompare(trailers);
    const match = html.match(/<script type="application\/json" id="cmp-data">([\s\S]*?)<\/script>/);
    assert.ok(match, 'has cmp-data island');
    const data = JSON.parse(match[1].replace(/\\u003c/g, '<'));
    const withFp = data.filter((d) => d.floorplanImg && d.floorplanImg.length > 0);
    assert.ok(withFp.length > 0, 'at least some trailers have floorplanImg in compare data');
  });

  test('app.js has compare floorplan row code', () => {
    const app = readFileSync('src/assets/js/app.js', 'utf8');
    assert.ok(app.includes('cmp-floorplan-row'), 'app.js builds floorplan row in compare');
    assert.ok(app.includes('cmp-floorplan-img'), 'app.js has floorplan img class');
  });
});

// =========================================================================
// 5. Client JS contains gradeClimb IIFE
// =========================================================================
describe('client JS', () => {
  test('app.js contains gradeClimb IIFE', () => {
    const app = readFileSync('src/assets/js/app.js', 'utf8');
    assert.ok(app.includes('function gradeClimb'), 'has gradeClimb IIFE');
    assert.ok(app.includes('grade-climb-data'), 'reads grade-climb-data island');
    assert.ok(app.includes('grade-pass-btn'), 'handles pass buttons');
  });
});
