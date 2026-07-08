// Tests for the imperial ↔ metric unit toggle, touch tooltips, and keyboard shortcut.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function readDist(rel) {
  return readFileSync(join(ROOT, 'dist', rel), 'utf8');
}

describe('unit toggle', () => {
  it('every page shell has a #unit-toggle button', () => {
    // Trailer detail
    const detail = readDist('m/classic-33fb-2026.html');
    assert.ok(detail.includes('id="unit-toggle"'), 'detail page missing #unit-toggle');
    // Motorhome detail
    const mm = readDist('mm/atlas-25ms-2027.html');
    assert.ok(mm.includes('id="unit-toggle"'), 'motorhome page missing #unit-toggle');
    // Home
    const home = readDist('index.html');
    assert.ok(home.includes('id="unit-toggle"'), 'home page missing #unit-toggle');
    // Family page
    const fam = readDist('f/classic.html');
    assert.ok(fam.includes('id="unit-toggle"'), 'family page missing #unit-toggle');
  });

  it('detail spec table has data-unit and data-raw on weight/length/tanks', () => {
    const html = readDist('m/classic-33fb-2026.html');
    // Weight specs
    assert.ok(html.includes('data-unit="weight" data-raw="8425"'), 'missing weight data on dry weight');
    assert.ok(html.includes('data-unit="weight" data-raw="10000"'), 'missing weight data on GVWR');
    // Length
    assert.ok(html.includes('data-unit="length" data-raw="33.25"'), 'missing length data');
    // Tanks
    assert.ok(html.includes('data-unit="tanks"'), 'missing tanks data');
  });

  it('key stats section has data-unit on weight and length', () => {
    const html = readDist('m/bambi-16rb-2026.html');
    // Key stat weight
    assert.match(html, /key-stat-value[^>]*data-unit="weight"/);
    // Key stat length
    assert.match(html, /key-stat-value[^>]*data-unit="length"/);
  });

  it('weight bar has data-unit on segments', () => {
    const html = readDist('m/classic-33fb-2026.html');
    assert.match(html, /weight-bar-gvwr[^>]*data-unit="weight"/);
    assert.match(html, /weight-bar-seg-label[^>]*data-unit="weight"/);
  });

  it('tow callout GVWR value has data-unit', () => {
    const html = readDist('m/classic-33fb-2026.html');
    assert.match(html, /tow-callout-value[^>]*>.*data-unit="weight"/s);
  });

  it('explore cards have data-unit on weight and length', () => {
    const html = readDist('index.html');
    assert.match(html, /xcard-specs[^]*data-unit="weight"/);
    assert.match(html, /xcard-specs[^]*data-unit="length"/);
  });

  it('family compare table has data-unit on weight/length/tanks cells', () => {
    const html = readDist('f/classic.html');
    // The fam-compare section should contain td cells with data-unit
    assert.ok(html.includes('fam-compare'), 'family page missing fam-compare section');
    // Check for data-unit attributes inside td tags in the family compare table
    assert.match(html, /<td[^>]*data-unit="weight"/, 'compare table missing weight unit td');
    assert.match(html, /<td[^>]*data-unit="length"/, 'compare table missing length unit td');
    assert.match(html, /<td[^>]*data-unit="tanks"/, 'compare table missing tanks unit td');
  });

  it('unit toggle button shows lb/ft by default', () => {
    const html = readDist('index.html');
    assert.ok(html.includes('id="unit-label">lb/ft</span>'), 'default label should be lb/ft');
  });
});

describe('touch tooltips', () => {
  it('app.js contains the touchTooltips module', () => {
    const js = readFileSync(join(ROOT, 'src/assets/js/app.js'), 'utf8');
    assert.ok(js.includes('touchTooltips'), 'app.js missing touchTooltips module');
    assert.ok(js.includes('is-tip-open'), 'app.js missing is-tip-open class toggle');
  });

  it('CSS has is-tip-open rule for spec tooltips', () => {
    const css = readFileSync(join(ROOT, 'src/assets/css/site.css'), 'utf8');
    assert.ok(css.includes('.spec-tip.is-tip-open'), 'site.css missing .spec-tip.is-tip-open rule');
  });
});

describe('keyboard shortcut u', () => {
  it('keyboard help overlay lists u for metric toggle', () => {
    const html = readDist('index.html');
    assert.ok(html.includes('<kbd>u</kbd>'), 'keyboard help missing u shortcut');
    assert.ok(html.includes('imperial / metric'), 'help text should mention imperial/metric');
  });

  it('app.js handles u keypress for unit toggle', () => {
    const js = readFileSync(join(ROOT, 'src/assets/js/app.js'), 'utf8');
    assert.ok(js.includes("key === 'u'"), 'app.js missing u key handler');
  });
});
