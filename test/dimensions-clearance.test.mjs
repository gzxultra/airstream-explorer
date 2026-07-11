import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatDimFt } from '../src/lib/format.mjs';
import { loadTrailers, assetPaths } from '../src/lib/data.mjs';
import { renderDetail, renderCompare } from '../src/lib/render.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const trailers = loadTrailers();

// --- formatDimFt ---

describe('formatDimFt', () => {
  it('formats whole feet (no inches shown)', () => {
    assert.equal(formatDimFt(8), "8'");
  });
  it('formats feet + fractional inches', () => {
    assert.equal(formatDimFt(9.5), "9' 6\"");
  });
  it('formats real trailer heights', () => {
    const classic = trailers.find((t) => t.slug === 'classic-33fb-2026');
    assert.ok(classic && classic.extHeightFt);
    const result = formatDimFt(classic.extHeightFt);
    assert.match(result, /\d+'/, `expected ft format, got "${result}"`);
  });
  it('returns em-dash for null/undefined', () => {
    assert.equal(formatDimFt(null), '—');
    assert.equal(formatDimFt(undefined), '—');
  });
});

// --- Data validation: all 2026 trailers have dimensions ---

describe('dimension data completeness', () => {
  const t2026 = trailers.filter((t) => t.year === 2026);

  it('every 2026 trailer has extWidthFt', () => {
    for (const t of t2026) {
      assert.ok(typeof t.extWidthFt === 'number' && t.extWidthFt > 0,
        `${t.slug} missing extWidthFt`);
    }
  });

  it('every 2026 trailer has extHeightFt', () => {
    for (const t of t2026) {
      assert.ok(typeof t.extHeightFt === 'number' && t.extHeightFt > 0,
        `${t.slug} missing extHeightFt`);
    }
  });

  it('every 2026 trailer has intHeightFt', () => {
    for (const t of t2026) {
      assert.ok(typeof t.intHeightFt === 'number' && t.intHeightFt > 0,
        `${t.slug} missing intHeightFt`);
    }
  });

  it('dimensions are in sane ranges (width 6-9 ft, ext height 8-12 ft, int 6-8 ft)', () => {
    for (const t of t2026) {
      assert.ok(t.extWidthFt >= 6 && t.extWidthFt <= 9,
        `${t.slug} extWidthFt=${t.extWidthFt} out of range`);
      assert.ok(t.extHeightFt >= 8 && t.extHeightFt <= 12,
        `${t.slug} extHeightFt=${t.extHeightFt} out of range`);
      assert.ok(t.intHeightFt >= 5.5 && t.intHeightFt <= 8,
        `${t.slug} intHeightFt=${t.intHeightFt} out of range`);
    }
  });
});

// --- Spec table has dimension rows ---

describe('detail page spec table includes dimensions', () => {
  const classic = trailers.find((t) => t.slug === 'classic-33fb-2026');
  const html = renderDetail(classic);

  it('has Ext. width row', () => {
    assert.match(html, /Ext\. width/);
  });

  it('has Ext. height row', () => {
    assert.match(html, /Ext\. height/);
  });

  it('has Interior height row', () => {
    assert.match(html, /Interior height/);
  });
});

// --- Clearance fit section ---

describe('clearance fit section', () => {
  const classic = trailers.find((t) => t.slug === 'classic-33fb-2026');
  const html = renderDetail(classic);

  it('renders clearance-fit section for trailers with dimensions', () => {
    assert.match(html, /id="clearance-fit"/);
    assert.match(html, /class="clearance-fit"/);
  });

  it('section nav includes Clearance link', () => {
    assert.match(html, /#clearance-fit/);
  });

  it('shows trailer dimensions in intro text', () => {
    assert.match(html, /Classic 33FB/);
    assert.match(html, /tall \(with A\/C\)/);
    assert.match(html, /wide/);
  });

  it('renders standard garage door, tall garage door, RV garage door, standard overpass, covered campsite', () => {
    assert.match(html, /Standard garage door/);
    assert.match(html, /Tall garage door/);
    assert.match(html, /RV garage door/);
    assert.match(html, /Standard overpass/);
    assert.match(html, /Covered campsite/);
  });

  it('uses correct verdict classes', () => {
    assert.match(html, /clearance-verdict--yes|clearance-verdict--no/);
    assert.match(html, /clearance-row--fits|clearance-row--blocked/);
  });
});

// --- Compare page includes dimensions ---

describe('compare page data includes dimensions', () => {
  const html = renderCompare(trailers);
  // The compact JSON island id is "cmp-data"
  const match = html.match(/<script type="application\/json" id="cmp-data">([\s\S]*?)<\/script>/);
  assert.ok(match, 'compare page must have a cmp-data JSON island');
  const data = JSON.parse(match[1].replace(/\\u003c/g, '<'));

  it('trailer entries have extWidthFt', () => {
    const t = data.find((d) => d.slug === 'classic-33fb-2026');
    assert.ok(t, 'Classic 33FB 2026 must be in compare data');
    assert.ok(typeof t.extWidthFt === 'number', 'extWidthFt must be a number');
  });

  it('trailer entries have extHeightFt', () => {
    const t = data.find((d) => d.slug === 'classic-33fb-2026');
    assert.ok(typeof t.extHeightFt === 'number', 'extHeightFt must be a number');
  });

  it('trailer entries have intHeightFt', () => {
    const t = data.find((d) => d.slug === 'classic-33fb-2026');
    assert.ok(typeof t.intHeightFt === 'number', 'intHeightFt must be a number');
  });
});

// --- Dark theme CSS covers clearance section ---

const theme = readFileSync(join(__dirname, '..', 'src', 'assets', 'css', 'theme.css'), 'utf8');

describe('dark theme clearance CSS', () => {
  it('has dark overrides for clearance-row--fits', () => {
    assert.match(theme, /\[data-theme="dark"\]\s*\.clearance-row--fits/);
  });

  it('has dark overrides for clearance-row--blocked', () => {
    assert.match(theme, /\[data-theme="dark"\]\s*\.clearance-row--blocked/);
  });

  it('has dark overrides for clearance-verdict--yes', () => {
    assert.match(theme, /\[data-theme="dark"\]\s*\.clearance-verdict--yes/);
  });

  it('has dark overrides for clearance-verdict--no', () => {
    assert.match(theme, /\[data-theme="dark"\]\s*\.clearance-verdict--no/);
  });
});
