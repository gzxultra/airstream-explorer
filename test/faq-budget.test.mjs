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

// ── FAQ Section ──────────────────────────────────────────────────────────────

describe('FAQ section', () => {
  test('every 2026 trailer has an FAQ section with at least 5 questions', () => {
    const t2026 = trailers.filter((t) => t.year === 2026);
    for (const t of t2026) {
      const html = renderDetail(t, undefined, null, trailers);
      assert.match(html, /id="faq"/, `${t.slug} missing FAQ section`);
      const faqItems = html.match(/class="faq-item"/g) || [];
      assert.ok(faqItems.length >= 5, `${t.slug} has only ${faqItems.length} FAQ items (need ≥5)`);
    }
  });

  test('FAQ section is in the page but not the 6-chapter top nav', () => {
    const html = renderDetail(classic, undefined, null, trailers);
    // FAQ exists as an in-page section...
    assert.match(html, /id="faq"/, 'FAQ section should be in the page');
    // ...but the top bar shows 6 chapters only (perf/a11y #31); FAQ is reachable by scrolling
    assert.ok(!html.match(/#faq"[^>]*>FAQ</), 'FAQ should not occupy a top-bar nav slot');
  });

  test('FAQ answers contain real spec data, not placeholders', () => {
    const html = renderDetail(classic, undefined, null, trailers);
    // Classic 33FB weighs 8,425 lb — that number should appear in the FAQ
    assert.match(html, /8,425/, 'FAQ should contain real dry weight');
    assert.match(html, /53 gallons fresh/, 'FAQ should contain real tank size');
  });

  test('FAQ uses native details/summary for progressive enhancement', () => {
    const html = renderDetail(bambi, undefined, null, trailers);
    assert.match(html, /<details class="faq-item"/);
    assert.match(html, /<summary class="faq-q"/);
  });

  test('first FAQ item is open by default', () => {
    const html = renderDetail(bambi, undefined, null, trailers);
    assert.match(html, /<details class="faq-item" open>/);
  });
});

// ── FAQPage JSON-LD ──────────────────────────────────────────────────────────

describe('FAQPage JSON-LD', () => {
  test('every 2026 detail page has FAQPage structured data', () => {
    const t2026 = trailers.filter((t) => t.year === 2026);
    for (const t of t2026) {
      const html = renderDetail(t, undefined, null, trailers);
      assert.match(html, /FAQPage/, `${t.slug} missing FAQPage JSON-LD`);
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
});
