// Tests for FAQ section + FAQPage JSON-LD and Budget Alternatives features.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTrailers } from '../src/lib/data.mjs';
import { renderDetail } from '../src/lib/render.mjs';
import { faqJsonLd } from '../src/lib/seo.mjs';

const trailers = loadTrailers();
const classic = trailers.find((t) => t.slug === 'classic-33fb-2026');
const bambi = trailers.find((t) => t.slug === 'bambi-16rb-2026');
const basecamp = trailers.find((t) => t.slug === 'basecamp-16x-2026');

// ── FAQ Section (REMOVED from detail pages 2026-09-27) ───────────────────────
// The visible FAQ section was removed in the detail redesign. These tests lock
// the removal with negative assertions.

describe('FAQ section', () => {
  test('no 2026 trailer has an FAQ section (redesign 2026-09-27: removed)', () => {
    const t2026 = trailers.filter((t) => t.year === 2026);
    for (const t of t2026) {
      const html = renderDetail(t, undefined, null, trailers);
      assert.ok(!html.includes('id="faq"'), `${t.slug} should not have FAQ section`);
      assert.ok(!html.includes('class="faq-item"'), `${t.slug} should not have FAQ items`);
    }
  });

  test('no FAQ anchor in the page (redesign 2026-09-27)', () => {
    const html = renderDetail(classic, undefined, null, trailers);
    assert.ok(!html.includes('id="faq"'), 'FAQ section should not be in the page');
    assert.ok(!html.includes('#faq'), 'no #faq anchor anywhere');
  });

  test('no FAQ details/summary markup (redesign 2026-09-27)', () => {
    const html = renderDetail(bambi, undefined, null, trailers);
    assert.ok(!html.includes('class="faq-item"'), 'no faq-item details');
    assert.ok(!html.includes('class="faq-q"'), 'no faq-q summary');
  });
});

// ── FAQPage JSON-LD (REMOVED from detail pages 2026-09-27) ──────────────────
// faqJsonLd still exists in seo.mjs (unit-tested below); it is just no longer
// emitted on detail pages.

describe('FAQPage JSON-LD', () => {
  test('no 2026 detail page has FAQPage structured data (redesign 2026-09-27)', () => {
    const t2026 = trailers.filter((t) => t.year === 2026);
    for (const t of t2026) {
      const html = renderDetail(t, undefined, null, trailers);
      assert.ok(!html.includes('FAQPage'), `${t.slug} should not have FAQPage JSON-LD`);
    }
  });

  test('faqJsonLd produces valid JSON-LD with correct schema', () => {
    const faqs = [
      { question: 'How heavy?', answer: 'Very heavy.' },
      { question: 'How long?', answer: 'Pretty long.' },
    ];
    const result = faqJsonLd(faqs);
    assert.match(result, /application\/ld\+json/);
    // Extract and parse the JSON
    const json = result.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
    const data = JSON.parse(json);
    assert.equal(data['@type'], 'FAQPage');
    assert.equal(data.mainEntity.length, 2);
    assert.equal(data.mainEntity[0]['@type'], 'Question');
    assert.equal(data.mainEntity[0].acceptedAnswer['@type'], 'Answer');
  });

  test('faqJsonLd returns empty string for empty input', () => {
    assert.equal(faqJsonLd([]), '');
    assert.equal(faqJsonLd(null), '');
  });

  test('faqJsonLd neutralizes </ in content', () => {
    const faqs = [{ question: 'Test</script>', answer: 'Bad</script>' }];
    const result = faqJsonLd(faqs);
    assert.ok(!result.includes('</script></script>'), 'should neutralize script close');
  });
});

// ── Budget Alternatives (REMOVED) ────────────────────────────────────────────
// The "In your price range" cross-family budget section was removed in the
// 2026-09 remediation (purchase-funnel cleanup). These tests lock the removal.

describe('Budget alternatives', () => {
  test('Classic 33FB has no budget alternatives section (removed)', () => {
    const html = renderDetail(classic, undefined, null, trailers);
    assert.ok(!html.includes('id="budget"'), 'budget section should be gone');
    assert.ok(!html.includes('In your price range'), 'budget heading should be gone');
  });

  test('no budget cards render (feature removed)', () => {
    const html = renderDetail(classic, undefined, null, trailers);
    assert.ok(!html.includes('budget-card'), 'no budget cards should render');
  });

  test('budget section does not appear in section nav (removed)', () => {
    const html = renderDetail(classic, undefined, null, trailers);
    assert.ok(!html.includes('#budget'), 'no #budget in section nav');
  });

  test('no FAQ structured data in any 2026 detail page (redesign 2026-09-27)', () => {
    const t2026 = trailers.filter((t) => t.year === 2026);
    for (const t of t2026.slice(0, 5)) {
      const html = renderDetail(t, undefined, null, trailers);
      assert.ok(!html.includes('FAQPage'), `${t.slug} should not have FAQPage JSON-LD`);
    }
  });

  test('FAQ removal does not break the More to explore section (redesign 2026-09-27)', () => {
    const html = renderDetail(classic, undefined, null, trailers);
    assert.ok(html.includes('id="more"'), 'more section still present');
    assert.ok(!html.includes('id="faq"'), 'faq still absent');
  });
});
