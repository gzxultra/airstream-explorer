import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

describe('size ladder', () => {
  it('renderSizeLadder exports and returns HTML for real data', async () => {
    const { renderSizeLadder } = await import('../src/lib/render.mjs');
    const { loadTrailers, groupByFamily } = await import('../src/lib/data.mjs');
    assert.equal(typeof renderSizeLadder, 'function');
    const trailers = loadTrailers();
    const families = groupByFamily(trailers);
    const html = renderSizeLadder(families, trailers);
    assert.ok(html.includes('size-ladder'), 'should have size-ladder section');
    assert.ok(html.includes('sl-bar'), 'should have bar elements');
    assert.ok(html.includes('sl-heading'), 'should have heading');
  });

  it('returns empty string for empty input', async () => {
    const { renderSizeLadder } = await import('../src/lib/render.mjs');
    assert.equal(renderSizeLadder([], []), '');
    assert.equal(renderSizeLadder(null), '');
  });

  it('produces one bar per family with 2026 models', async () => {
    const { renderSizeLadder } = await import('../src/lib/render.mjs');
    const { loadTrailers, groupByFamily } = await import('../src/lib/data.mjs');
    const trailers = loadTrailers();
    const families = groupByFamily(trailers);
    const html = renderSizeLadder(families, trailers);
    // Count bars — should equal number of families with 2026 models
    const barCount = (html.match(/class="sl-bar"/g) || []).length;
    const familiesWith2026 = families.filter(f =>
      trailers.some(t => t.model === f.family && t.year === 2026)
    ).length;
    assert.equal(barCount, familiesWith2026, `should have ${familiesWith2026} bars`);
  });

  it('bars are sorted smallest to largest', async () => {
    const { renderSizeLadder } = await import('../src/lib/render.mjs');
    const { loadTrailers, groupByFamily } = await import('../src/lib/data.mjs');
    const trailers = loadTrailers();
    const families = groupByFamily(trailers);
    const html = renderSizeLadder(families, trailers);
    // Extract family names from bars in order
    const names = [...html.matchAll(/sl-bar-name">([^<]+)<\/span>/g)].map(m => m[1]);
    assert.ok(names.length > 1, 'should have multiple bars');
    // Basecamp should come before Classic (shortest vs longest)
    const basecampIdx = names.indexOf('Basecamp');
    const classicIdx = names.indexOf('Classic');
    if (basecampIdx !== -1 && classicIdx !== -1) {
      assert.ok(basecampIdx < classicIdx, 'Basecamp (shortest) should appear before Classic (longest)');
    }
  });

  it('bars link to family pages', async () => {
    const { renderSizeLadder } = await import('../src/lib/render.mjs');
    const { loadTrailers, groupByFamily } = await import('../src/lib/data.mjs');
    const trailers = loadTrailers();
    const families = groupByFamily(trailers);
    const html = renderSizeLadder(families, trailers);
    assert.ok(html.includes('data-href="f/'), 'bars should link to family pages');
  });

  it('size ladder is embedded in the built index page', () => {
    const html = readFileSync(join(DIST, 'index.html'), 'utf8');
    assert.ok(html.includes('size-ladder'), 'built index should contain size ladder');
    assert.ok(html.includes('sl-bar'), 'built index should contain bar elements');
  });

  // --- app.js client code ---
  it('app.js contains sizeLadder IIFE', () => {
    const js = readFileSync(join(ROOT, 'src', 'assets', 'js', 'app.js'), 'utf8');
    assert.ok(js.includes('function sizeLadder()'), 'should have sizeLadder function');
    assert.ok(js.includes('sl-bar--dim'), 'should handle bar dimming');
  });

  // --- CSS ---
  it('site.css has size ladder styles', () => {
    const css = readFileSync(join(ROOT, 'src', 'assets', 'css', 'site.css'), 'utf8');
    assert.ok(css.includes('.size-ladder'), 'should have size-ladder');
    assert.ok(css.includes('.sl-bar'), 'should have sl-bar');
    assert.ok(css.includes('.sl-bar-fill'), 'should have sl-bar-fill');
    assert.ok(css.includes('.sl-bar--dim'), 'should have dim state');
  });
});
