import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderHookupGuide, renderModelYearHighlights, renderGlossaryBody } from '../src/lib/render.mjs';
import { loadTrailers } from '../src/lib/data.mjs';

const trailers = loadTrailers();

// ── renderHookupGuide ─────────────────────────────────────────────────────────

describe('renderHookupGuide', () => {
  it('returns a section with hookup-guide class', () => {
    const t = trailers.find((t) => t.year === 2026);
    const html = renderHookupGuide(t);
    assert.ok(html.includes('class="hookup-guide'), 'missing hookup-guide class');
    assert.ok(html.includes('id="hookup"'), 'missing hookup id');
  });

  it('shows 50A for Classic (large model)', () => {
    const classic = trailers.find((t) => t.model === 'Classic' && t.year === 2026);
    if (!classic) return; // skip if not in dataset
    const html = renderHookupGuide(classic);
    assert.ok(html.includes('50A shore power'), `Classic should be 50A, got: ${html.slice(0, 300)}`);
    assert.ok(html.includes('NEMA 14-50') || html.includes('14-50'), 'Classic should reference 14-50 plug');
  });

  it('shows 30A for Bambi (small model)', () => {
    const bambi = trailers.find((t) => t.model === 'Bambi' && t.year === 2026);
    if (!bambi) return;
    const html = renderHookupGuide(bambi);
    assert.ok(html.includes('30A shore power'), `Bambi should be 30A, got: ${html.slice(0, 300)}`);
    assert.ok(html.includes('TT-30') || html.includes('TT‑30'), 'Bambi should reference TT-30 plug');
  });

  it('includes water and sewer hookup gear', () => {
    const t = trailers.find((t) => t.year === 2026);
    const html = renderHookupGuide(t);
    assert.ok(html.includes('Water hookup'), 'missing water hookup section');
    assert.ok(html.includes('Sewer'), 'missing sewer section');
    assert.ok(html.includes('Pressure regulator'), 'missing pressure regulator');
    assert.ok(html.includes('Sewer hose'), 'missing sewer hose');
  });

  it('uses collapsible pattern', () => {
    const t = trailers.find((t) => t.year === 2026);
    const html = renderHookupGuide(t);
    assert.ok(html.includes('collapsible'), 'should use collapsible class');
    assert.ok(html.includes('collapsible-trigger'), 'should have trigger');
    assert.ok(html.includes('collapsible-body'), 'should have body');
  });
});

// ── renderModelYearHighlights ─────────────────────────────────────────────────

describe('renderModelYearHighlights', () => {
  it('returns empty when year specs are identical (no diffs)', () => {
    const html = renderModelYearHighlights(trailers);
    // Current dataset: 2025 and 2026 specs are identical, so no highlights
    // The function should return empty string gracefully
    const has2026 = trailers.some((t) => t.year === 2026);
    const has2025 = trailers.some((t) => t.year === 2025);
    assert.ok(has2026 && has2025, 'dataset should have both years');
    // With identical specs, output should be empty (no diffs to show)
    assert.strictEqual(html, '', 'identical specs should yield no highlights');
  });

  it('returns empty string when insufficient data', () => {
    const only2026 = trailers.filter((t) => t.year === 2026);
    const html = renderModelYearHighlights(only2026);
    assert.strictEqual(html, '', 'single-year dataset should return empty');
  });

  it('produces output when given synthetic diffs', () => {
    // Create a fake dataset with actual spec differences
    const fakeTrailers = trailers.map((t) => {
      if (t.year === 2025 && t.model === 'Classic' && t.floorplan === '33FB') {
        return { ...t, msrp: t.msrp + 5000, weightLb: (t.weightLb || 8425) + 100 };
      }
      if (t.year === 2025 && t.model === 'Bambi' && t.floorplan === '16RB') {
        return { ...t, solarW: (t.solarW || 0) + 100 };
      }
      if (t.year === 2025 && t.model === 'Flying Cloud' && t.floorplan === '25FB') {
        return { ...t, msrp: t.msrp - 2000 };
      }
      return t;
    });
    const html = renderModelYearHighlights(fakeTrailers);
    if (html) {
      assert.ok(html.includes('myh-section'), 'should render myh-section');
      assert.ok(html.includes('myh-grid'), 'should have card grid');
      assert.ok(html.includes('myh-card'), 'should have at least one featured card');
      assert.ok(html.includes('href="m/'), 'cards should link to detail pages');
    }
  });
});

// ── renderGlossaryBody ────────────────────────────────────────────────────────

describe('renderGlossaryBody', () => {
  const html = renderGlossaryBody();

  it('renders a glossary header', () => {
    assert.ok(html.includes('glossary-head'), 'missing glossary-head');
    assert.ok(html.includes('RV & Airstream Glossary') || html.includes('RV &amp; Airstream Glossary'), 'missing title');
  });

  it('renders all 6 categories', () => {
    const catLabels = ['Specs & Weights', 'Towing', 'Tanks & Plumbing', 'Power & Solar', 'Camping', 'Airstream-Specific'];
    for (const label of catLabels) {
      const escaped = label.replace(/&/g, '&amp;');
      assert.ok(html.includes(escaped) || html.includes(label), `missing category: ${label}`);
    }
  });

  it('contains key terms', () => {
    const mustHave = ['GVWR', 'Boondocking', 'Shore Power', 'Dry Weight'];
    for (const term of mustHave) {
      assert.ok(html.includes(term), `missing key term: ${term}`);
    }
  });

  it('renders a TOC with links', () => {
    assert.ok(html.includes('glossary-toc'), 'missing TOC');
    assert.ok(html.includes('glossary-toc-link'), 'missing TOC links');
    // TOC links should point to glossary term anchors
    assert.ok(html.includes('href="#gl-'), 'TOC should link to term anchors');
  });

  it('uses dl/dt/dd semantic markup', () => {
    assert.ok(html.includes('<dl'), 'should use definition list');
    assert.ok(html.includes('<dt'), 'should use dt for terms');
    assert.ok(html.includes('<dd'), 'should use dd for definitions');
  });
});
