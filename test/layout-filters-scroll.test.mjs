import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { deriveLayoutFeatures, LAYOUT_META } from '../src/lib/data.mjs';
import { renderExploreCard, renderExploreSections, page } from '../src/lib/render.mjs';

// ---------------------------------------------------------------------------
// Layout feature derivation
// ---------------------------------------------------------------------------
describe('deriveLayoutFeatures', () => {
  it('detects rear bed from description', () => {
    const t = { slug: 'bambi-16rb-2026', description: 'Sleeps up to 4, Rear Primary Bed, Space-Saving Wet Bath' };
    const features = deriveLayoutFeatures(t);
    assert.ok(features.includes('rear-bed'));
  });

  it('detects front bed', () => {
    const t = { slug: 'bambi-20fb-2026', description: 'Sleeps up to 4, Front Primary Bed, Combined Corner Shower' };
    const features = deriveLayoutFeatures(t);
    assert.ok(features.includes('front-bed'));
    assert.ok(!features.includes('rear-bed'));
  });

  it('detects wet bath', () => {
    const t = { slug: 'basecamp-16x-2026', description: 'Rear Convertible Bed, Space-Saving Wet Bath' };
    const features = deriveLayoutFeatures(t);
    assert.ok(features.includes('wet-bath'));
    assert.ok(features.includes('rear-bed'));
  });

  it('detects bunk from slug when not in description', () => {
    const t = { slug: 'flying-cloud-30fb-bunk-2026', description: 'Sleeps up to 8, Front Primary Bed, Combined Corner Shower' };
    const features = deriveLayoutFeatures(t);
    assert.ok(features.includes('bunk'));
    assert.ok(features.includes('front-bed'));
  });

  it('detects rear hatch', () => {
    const t = { slug: 'flw-28rb-2026', description: 'Rear Primary Bed, Rear Hatch for Indoor-Outdoor Living' };
    const features = deriveLayoutFeatures(t);
    assert.ok(features.includes('rear-hatch'));
    assert.ok(features.includes('rear-bed'));
  });

  it('detects u-seat dinette', () => {
    const t = { slug: 'bambi-22fb-2026', description: 'Front Primary Bed, Convertible U-Seated Dinette' };
    const features = deriveLayoutFeatures(t);
    assert.ok(features.includes('u-dinette'));
    assert.ok(features.includes('front-bed'));
  });

  it('detects rear convertible bed', () => {
    const t = { slug: 'basecamp-20x-2026', description: 'Rear Convertible Bed, Space-Saving Wet Bath' };
    const features = deriveLayoutFeatures(t);
    assert.ok(features.includes('rear-bed'));
  });

  it('detects rear v-shape twin beds', () => {
    const t = { slug: 'wt-22rb-2026', description: 'Rear V-Shape Twin Beds, Combined Mid-Ship Shower' };
    const features = deriveLayoutFeatures(t);
    assert.ok(features.includes('rear-bed'));
  });

  it('returns empty for missing description', () => {
    const features = deriveLayoutFeatures({ slug: 'test' });
    assert.deepStrictEqual(features, []);
  });
});

// ---------------------------------------------------------------------------
// LAYOUT_META is complete
// ---------------------------------------------------------------------------
describe('LAYOUT_META', () => {
  it('has all expected layout keys', () => {
    const keys = LAYOUT_META.map(m => m.key);
    assert.ok(keys.includes('rear-bed'));
    assert.ok(keys.includes('front-bed'));
    assert.ok(keys.includes('wet-bath'));
    assert.ok(keys.includes('bunk'));
    assert.ok(keys.includes('rear-hatch'));
    assert.ok(keys.includes('u-dinette'));
  });

  it('each entry has a key and label', () => {
    for (const m of LAYOUT_META) {
      assert.ok(m.key, 'should have key');
      assert.ok(m.label, 'should have label');
    }
  });
});

// ---------------------------------------------------------------------------
// Explore card carries data-layout attribute
// ---------------------------------------------------------------------------
describe('explore card data-layout', () => {
  it('includes layout features in data-layout attribute', () => {
    const t = {
      slug: 'bambi-16rb-2026', model: 'Bambi', floorplan: '16RB', year: 2026,
      lengthFt: 16.25, weightLb: 3150, gvwrLb: 3500, hitchWeightLb: 475,
      cccLb: 350, sleeps: 4, msrp: 68900, offGridScore: 39,
      freshGal: 23, grayGal: null, blackGal: 30, solarW: 100, batteryKwh: 2.5,
      tags: ['solo'], description: 'Rear Primary Bed, Space-Saving Wet Bath',
    };
    const resolve = () => ({ thumb: 't.webp', hero: 'h.webp', gallery: [], galleryCutout: [] });
    const html = renderExploreCard(t, resolve);
    assert.ok(html.includes('data-layout="rear-bed wet-bath"'), 'should have rear-bed wet-bath in data-layout');
  });
});

// ---------------------------------------------------------------------------
// Explore sections contain layout filter chips
// ---------------------------------------------------------------------------
describe('explore layout filter chips', () => {
  it('renders layout filter buttons', () => {
    const t = {
      slug: 'test-2026', model: 'Test', floorplan: '20FB', year: 2026,
      lengthFt: 20, weightLb: 3500, gvwrLb: 4000, hitchWeightLb: 500,
      cccLb: 500, sleeps: 4, msrp: 70000, offGridScore: 40,
      freshGal: 25, grayGal: 18, blackGal: 18, solarW: 100, batteryKwh: 2.5,
      tags: ['solo'], description: 'Front Primary Bed', solarStandard: false,
    };
    const resolve = () => ({ thumb: 't.webp', hero: 'h.webp', gallery: [], galleryCutout: [] });
    const html = renderExploreSections([t], resolve);
    assert.ok(html.includes('layoutfilter'), 'should have layout filter buttons');
    assert.ok(html.includes('data-layout-key="rear-bed"'), 'should have rear-bed chip');
    assert.ok(html.includes('data-layout-key="front-bed"'), 'should have front-bed chip');
    assert.ok(html.includes('data-layout-key="wet-bath"'), 'should have wet-bath chip');
    assert.ok(html.includes('xc-row-3'), 'should have layout row');
  });
});

// ---------------------------------------------------------------------------
// Active filter summary container
// ---------------------------------------------------------------------------
describe('active filter summary', () => {
  it('renders the active-filters container', () => {
    const t = {
      slug: 'test-2026', model: 'Test', floorplan: '20FB', year: 2026,
      lengthFt: 20, weightLb: 3500, gvwrLb: 4000, hitchWeightLb: 500,
      cccLb: 500, sleeps: 4, msrp: 70000, offGridScore: 40,
      freshGal: 25, grayGal: 18, blackGal: 18, solarW: 100, batteryKwh: 2.5,
      tags: ['solo'], description: 'Front Primary Bed', solarStandard: false,
    };
    const resolve = () => ({ thumb: 't.webp', hero: 'h.webp', gallery: [], galleryCutout: [] });
    const html = renderExploreSections([t], resolve);
    assert.ok(html.includes('id="active-filters"'), 'should have active-filters container');
  });
});

// ---------------------------------------------------------------------------
// Scroll-to-top button in page shell
// ---------------------------------------------------------------------------
describe('scroll-to-top button', () => {
  it('is present in the trailer page shell', () => {
    const html = page({ title: 'Test', description: 'Test', body: '<p>test</p>' });
    assert.ok(html.includes('id="scroll-top"'), 'should have scroll-top button');
    assert.ok(html.includes('scroll-top'), 'should have scroll-top class');
    assert.ok(html.includes('Back to top'), 'should have title');
  });
});
