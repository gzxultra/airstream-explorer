import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { lifestyleFit, deriveAmenities, storageGuide } from '../src/lib/lifestyle.mjs';

// --- lifestyleFit ---

describe('lifestyleFit', () => {
  it('scores a compact lightweight trailer high on weekend + easyTow, low on fulltime', () => {
    const compact = {
      weightLb: 3150, gvwrLb: 3500, lengthFt: 16.25, sleeps: 4,
      freshGal: 23, grayGal: null, blackGal: 30, solarW: 100,
      batteryKwh: 2.5, offGridScore: 39, cccLb: 350,
    };
    const fit = lifestyleFit(compact);
    assert.ok(fit.weekend >= 3, `weekend ${fit.weekend} should be >= 3 for compact trailer`);
    assert.ok(fit.easyTow >= 3, `easyTow ${fit.easyTow} should be >= 3 for light trailer`);
    assert.ok(fit.fulltime <= 2, `fulltime ${fit.fulltime} should be <= 2 for 16\' trailer`);
  });

  it('scores a large luxury trailer high on fulltime + family, low on easyTow', () => {
    const large = {
      weightLb: 8425, gvwrLb: 10000, lengthFt: 33.5, sleeps: 5,
      freshGal: 39, grayGal: 38, blackGal: 38, solarW: 600,
      batteryKwh: 6, offGridScore: 85, cccLb: 1575,
    };
    const fit = lifestyleFit(large);
    assert.ok(fit.fulltime >= 3, `fulltime ${fit.fulltime} should be >= 3 for 33\' trailer`);
    assert.ok(fit.family >= 3, `family ${fit.family} should be >= 3 for sleeps-5`);
    assert.ok(fit.easyTow <= 2, `easyTow ${fit.easyTow} should be <= 2 for 10000lb GVWR`);
  });

  it('returns all scores 0-5', () => {
    const t = { weightLb: 5000, gvwrLb: 6500, lengthFt: 25, sleeps: 4,
      freshGal: 30, grayGal: 25, blackGal: 30, solarW: 200,
      batteryKwh: 3, offGridScore: 55, cccLb: 1500 };
    const fit = lifestyleFit(t);
    for (const k of ['boondocking', 'family', 'weekend', 'fulltime', 'easyTow']) {
      assert.ok(fit[k] >= 0 && fit[k] <= 5, `${k}=${fit[k]} should be 0-5`);
    }
  });

  it('provides reason strings for all categories', () => {
    const t = { weightLb: 5000, gvwrLb: 6500, lengthFt: 25, sleeps: 4,
      freshGal: 30, grayGal: 25, blackGal: 30, solarW: 200,
      batteryKwh: 3, offGridScore: 55, cccLb: 1500 };
    const fit = lifestyleFit(t);
    for (const k of ['boondockReason', 'familyReason', 'weekendReason', 'fulltimeReason', 'easyTowReason']) {
      assert.ok(typeof fit[k] === 'string' && fit[k].length > 0, `${k} should be a non-empty string`);
    }
  });

  it('handles missing specs gracefully', () => {
    const t = { weightLb: 3000 };
    const fit = lifestyleFit(t);
    assert.ok(fit.boondocking >= 0, 'boondocking should be >= 0 even with missing specs');
    assert.ok(fit.family >= 0, 'family should be >= 0 even with missing specs');
  });
});

// --- deriveAmenities ---

describe('deriveAmenities', () => {
  it('extracts bathroom type', () => {
    const t = { description: 'Sleeps up to 4, Rear Primary Bed, Space-Saving Wet Bath, Convertible Booth Style Dinette' };
    const amenities = deriveAmenities(t);
    const bath = amenities.find(a => a.category === 'bath');
    assert.ok(bath, 'should find bath amenity');
    assert.equal(bath.label, 'Wet bath');
  });

  it('extracts bed, kitchen, and dining', () => {
    const t = { description: 'Front Primary Bed, Extended Mid-Ship Galley, Convertible U-Seated Dinette with Lounge' };
    const amenities = deriveAmenities(t);
    const cats = amenities.map(a => a.category);
    assert.ok(cats.includes('bed'), 'should have bed');
    assert.ok(cats.includes('kitchen'), 'should have kitchen');
    assert.ok(cats.includes('dining'), 'should have dining');
    assert.ok(cats.includes('lounge'), 'should have lounge');
  });

  it('returns one per category', () => {
    // Even if multiple patterns match the same category, only first wins
    const t = { description: 'Rear Primary Bed, Front Primary Bed' };
    const amenities = deriveAmenities(t);
    const beds = amenities.filter(a => a.category === 'bed');
    assert.equal(beds.length, 1, 'only one bed amenity');
  });

  it('returns empty for no description', () => {
    assert.deepEqual(deriveAmenities({}), []);
    assert.deepEqual(deriveAmenities({ description: '' }), []);
  });

  it('every result has category, label, icon', () => {
    const t = { description: 'Rear Primary Bed, Space-Saving Wet Bath, Extended Mid-Ship Galley, Smart Control Technology' };
    const amenities = deriveAmenities(t);
    for (const a of amenities) {
      assert.ok(a.category, 'should have category');
      assert.ok(a.label, 'should have label');
      assert.ok(a.icon, 'should have icon');
    }
  });
});

// --- storageGuide ---

describe('storageGuide', () => {
  it('recommends smaller storage for compact trailers', () => {
    const guide = storageGuide({ lengthFt: 16, extWidthFt: 8, extHeightFt: 9.4 });
    assert.ok(guide.storageUnit.includes('20'), 'compact trailer should suggest 20\' unit');
    assert.ok(guide.garageNote.includes('single-car') || guide.garageNote.includes('2-car'),
      'compact trailer may fit a garage');
    assert.ok(guide.maneuverNote.includes('Easy'), 'compact trailer should be easy to maneuver');
    assert.equal(guide.parkingLength, 16);
  });

  it('recommends larger storage for big trailers', () => {
    const guide = storageGuide({ lengthFt: 33, extWidthFt: 8.5, extHeightFt: 10.8 });
    assert.ok(guide.storageUnit.includes('35') || guide.storageUnit.includes('RV lot'),
      'large trailer needs big storage');
    assert.ok(guide.garageNote.includes('RV storage') || guide.garageNote.includes('Too large'),
      'large trailer won\'t fit a garage');
    assert.ok(guide.maneuverNote.includes('Challenging') || guide.maneuverNote.includes('pull-through'),
      'large trailer is hard to maneuver');
  });

  it('returns all required fields', () => {
    const guide = storageGuide({ lengthFt: 25, extWidthFt: 8, extHeightFt: 10 });
    assert.ok(guide.storageUnit);
    assert.ok(guide.garageNote);
    assert.ok(guide.maneuverNote);
    assert.equal(typeof guide.parkingLength, 'number');
    assert.ok(guide.clearanceHeight > 0);
    assert.ok(guide.recommendedSlotFt > 0);
  });

  it('handles missing width/height gracefully', () => {
    const guide = storageGuide({ lengthFt: 22 });
    assert.ok(guide.storageUnit);
    assert.ok(guide.garageNote);
  });
});

// --- Render integration ---

describe('render integration', () => {
  // These test that the new sections appear in the rendered detail HTML
  let renderModule;
  let trailers;

  it('renderDetail includes lifestyle-fit section', async () => {
    // Lazy import to avoid circular/heavy loads unless this test runs
    renderModule = renderModule || await import('../src/lib/render.mjs');
    const { loadTrailers } = await import('../src/lib/data.mjs');
    trailers = trailers || loadTrailers();
    const t = trailers.find(t => t.year === 2026) || trailers[0];
    const html = renderModule.renderDetail(t, undefined, null, null, trailers);
    assert.ok(html.includes('id="lifestyle-fit"'), 'detail page should have lifestyle-fit section');
    assert.ok(html.includes('lf-dot'), 'lifestyle fit should render dots');
    assert.ok(html.includes('lf-row'), 'lifestyle fit should render rows');
  });

  it('renderDetail includes amenity-summary chips', async () => {
    renderModule = renderModule || await import('../src/lib/render.mjs');
    const { loadTrailers } = await import('../src/lib/data.mjs');
    trailers = trailers || loadTrailers();
    // Find a trailer with a description that should produce amenities
    const t = trailers.find(t => t.description && t.description.includes('Bed'));
    if (!t) return; // skip if no suitable trailer
    const html = renderModule.renderDetail(t, undefined, null, null, trailers);
    assert.ok(html.includes('amenity-summary'), 'detail page should have amenity summary');
    assert.ok(html.includes('amenity-chip'), 'amenity summary should have chips');
  });

  it('renderDetail includes storage guide section', async () => {
    renderModule = renderModule || await import('../src/lib/render.mjs');
    const { loadTrailers } = await import('../src/lib/data.mjs');
    trailers = trailers || loadTrailers();
    const t = trailers.find(t => t.year === 2026 && t.lengthFt) || trailers[0];
    const html = renderModule.renderDetail(t, undefined, null, null, trailers);
    assert.ok(html.includes('id="storage"'), 'detail page should have storage section');
    assert.ok(html.includes('sg-card'), 'storage section should have cards');
    assert.ok(html.includes('Storage unit'), 'storage section should mention storage unit');
    assert.ok(html.includes('Garage fit'), 'storage section should mention garage');
    assert.ok(html.includes('Maneuvering'), 'storage section should mention maneuvering');
  });

  it('section nav includes Lifestyle and Storage', async () => {
    renderModule = renderModule || await import('../src/lib/render.mjs');
    const { loadTrailers } = await import('../src/lib/data.mjs');
    trailers = trailers || loadTrailers();
    const t = trailers.find(t => t.year === 2026) || trailers[0];
    const html = renderModule.renderDetail(t, undefined, null, null, trailers);
    assert.ok(html.includes('#lifestyle-fit'), 'secnav should link to lifestyle-fit');
    assert.ok(html.includes('#storage'), 'secnav should link to storage');
  });
});
