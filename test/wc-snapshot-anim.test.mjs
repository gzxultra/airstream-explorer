// Tests for weight-class segment bar, fleet snapshot dashboard, and card enter animation.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function readSrc(rel) { return readFileSync(join(root, rel), 'utf8'); }

describe('weight class segment bar', () => {
  it('renderWeightClassBar is exported from render.mjs', () => {
    const src = readSrc('src/lib/render.mjs');
    assert.ok(src.includes('export function renderWeightClassBar'), 'renderWeightClassBar export missing');
  });

  it('weight class bar is present in built index.html', () => {
    const html = readSrc('dist/index.html');
    assert.ok(html.includes('id="weight-class-bar"'), 'weight-class-bar element missing');
    assert.ok(html.includes('data-wc="ultralight"'), 'ultralight segment missing');
    assert.ok(html.includes('data-wc="light"'), 'light segment missing');
    assert.ok(html.includes('data-wc="medium"'), 'medium segment missing');
    assert.ok(html.includes('data-wc="heavy"'), 'heavy segment missing');
  });

  it('segment counts add up to 31 (2026 lineup)', () => {
    const html = readSrc('dist/index.html');
    const flexes = html.match(/class="wc-seg"[^>]*style="flex:(\d+)/g) || [];
    const total = flexes.reduce((s, m) => {
      const n = parseInt(m.match(/flex:(\d+)/)[1], 10);
      return s + n;
    }, 0);
    assert.equal(total, 31, `expected 31 total weight-class models, got ${total}`);
  });

  it('each segment has proper aria-label with count and range', () => {
    const html = readSrc('dist/index.html');
    const segments = html.match(/data-wc="[^"]+"/g) || [];
    assert.ok(segments.length >= 4, 'need at least 4 weight class segments');
    assert.ok(html.includes('aria-label="Ultra-light:'), 'ultralight aria-label missing');
  });

  it('wc-clear button exists and starts hidden', () => {
    const html = readSrc('dist/index.html');
    assert.ok(html.includes('id="wc-clear"'), 'wc-clear button missing');
    assert.ok(html.includes('wc-clear') && html.includes('hidden'), 'wc-clear should start hidden');
  });
});

describe('fleet snapshot dashboard', () => {
  it('fleet-snapshot container is in built index.html', () => {
    const html = readSrc('dist/index.html');
    assert.ok(html.includes('id="fleet-snapshot"'), 'fleet-snapshot container missing');
  });

  it('app.js contains fleetSnapshot IIFE', () => {
    const js = readSrc('src/assets/js/app.js');
    assert.ok(js.includes('function fleetSnapshot()'), 'fleetSnapshot IIFE missing');
    assert.ok(js.includes('fs-card'), 'fs-card class missing from fleetSnapshot');
  });

  it('fleet snapshot computes avg price, weight range, most common sleeps, off-grid champ', () => {
    const js = readSrc('src/assets/js/app.js');
    assert.ok(js.includes('Avg. price'), 'avg price card missing');
    assert.ok(js.includes('Weight range'), 'weight range card missing');
    assert.ok(js.includes('Most common'), 'most common card missing');
    assert.ok(js.includes('Off-grid champ'), 'off-grid champ card missing');
  });
});

describe('card enter animation', () => {
  it('CSS contains @keyframes cardEnter', () => {
    const css = readSrc('src/assets/css/site.css');
    assert.ok(css.includes('@keyframes cardEnter'), 'cardEnter keyframes missing');
    assert.ok(css.includes('.xcard.card-enter'), 'card-enter class rule missing');
  });

  it('staggered animation delays exist for up to 12 cards', () => {
    const css = readSrc('src/assets/css/site.css');
    assert.ok(css.includes('.xcard.card-enter:nth-child(12)'), 'stagger for 12th card missing');
  });

  it('prefers-reduced-motion disables card animation', () => {
    const css = readSrc('src/assets/css/site.css');
    assert.ok(css.includes('prefers-reduced-motion') && css.includes('card-enter'), 'reduced-motion override missing');
  });

  it('app.js contains cardEnterAnim IIFE', () => {
    const js = readSrc('src/assets/js/app.js');
    assert.ok(js.includes('function cardEnterAnim()'), 'cardEnterAnim IIFE missing');
    assert.ok(js.includes('card-enter'), 'card-enter class usage missing from JS');
  });
});

describe('weight class filter JS', () => {
  it('app.js contains weightClassFilter IIFE', () => {
    const js = readSrc('src/assets/js/app.js');
    assert.ok(js.includes('function weightClassFilter()'), 'weightClassFilter IIFE missing');
  });

  it('weight class filter syncs with x-weight select', () => {
    const js = readSrc('src/assets/js/app.js');
    assert.ok(js.includes("getElementById('x-weight')"), 'weight select reference missing');
    assert.ok(js.includes('dispatchEvent'), 'filter dispatch missing');
  });

  it('weight class filter resets on x-reset click', () => {
    const js = readSrc('src/assets/js/app.js');
    assert.ok(js.includes("getElementById('x-reset')"), 'reset button hookup missing');
  });
});

describe('dark mode support for new components', () => {
  it('theme.css has dark mode rules for wc-seg and fs-card', () => {
    const css = readSrc('src/assets/css/theme.css');
    assert.ok(css.includes('.wc-seg'), 'dark mode wc-seg rule missing');
    assert.ok(css.includes('.fs-card'), 'dark mode fs-card rule missing');
  });
});

describe('weight class CSS', () => {
  it('weight class bar has responsive styles', () => {
    const css = readSrc('src/assets/css/site.css');
    assert.ok(css.includes('.weight-class-bar'), 'weight-class-bar rule missing');
    assert.ok(css.includes('.wc-bar'), 'wc-bar rule missing');
    assert.ok(css.includes('.wc-legend'), 'wc-legend rule missing');
  });

  it('fleet snapshot has responsive grid', () => {
    const css = readSrc('src/assets/css/site.css');
    assert.ok(css.includes('.fleet-snapshot'), 'fleet-snapshot rule missing');
    assert.ok(css.includes('.fs-card'), 'fs-card rule missing');
  });
});
