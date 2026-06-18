import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadMotorhomes, validateMotorhome, validateMotorhomeDataset,
  groupMotorhomesByFamily, motorhomeFamilyNames,
  MOTORHOME_OFFICIAL_URLS, motorhomeOfficialUrl,
  MOTORHOME_OFFICIAL_URLS_BY_SLUG, motorhomeOfficialUrlBySlug,
} from '../src/lib/motorhome-data.mjs';
import {
  renderMotorhomeDetail, renderMotorhomeFamily, renderMotorhomeIndex,
  renderMotorhomeExploreCard,
} from '../src/lib/motorhome-render.mjs';
import { estimateOffGrid } from '../src/lib/estimate.mjs';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, '..', 'public');
const hasAsset = (rel) => existsSync(join(PUBLIC, rel));

const motorhomes = loadMotorhomes();

// ---------------------------------------------------------------------------
// Dataset integrity
// ---------------------------------------------------------------------------

test('motorhome dataset loads with 11 entries', () => {
  assert.equal(motorhomes.length, 11);
});

test('motorhome dataset passes full validation', () => {
  assert.equal(validateMotorhomeDataset(motorhomes), true);
});

test('all motorhome slugs are unique', () => {
  assert.equal(new Set(motorhomes.map((m) => m.slug)).size, motorhomes.length);
});

test('every motorhome has type "motorhome"', () => {
  for (const m of motorhomes) assert.equal(m.type, 'motorhome', m.slug);
});

test('NCC always equals GVWR minus base weight for motorhomes', () => {
  for (const m of motorhomes) {
    assert.equal(m.nccLb, m.gvwrLb - m.weightLb, `${m.slug}: NCC mismatch`);
  }
});

// ---------------------------------------------------------------------------
// Audited specs — lock critical numbers from airstream.com
// ---------------------------------------------------------------------------

test('audited specs: Atlas 25MS 2027', () => {
  const m = motorhomes.find((x) => x.slug === 'atlas-25ms-2027');
  assert.ok(m, 'atlas-25ms-2027 exists');
  assert.equal(m.msrp, 335900);
  assert.equal(m.gvwrLb, 12125);
  assert.equal(m.weightLb, 10227);
  assert.equal(m.nccLb, 1898);
  assert.equal(m.freshGal, 23);
  assert.equal(m.batteryKwh, 10.3);
  assert.equal(m.solarW, 400);
});

test('audited specs: Interstate 24GT 2027', () => {
  const m = motorhomes.find((x) => x.slug === 'interstate-24gt-2027');
  assert.ok(m);
  assert.equal(m.msrp, 285900);
  assert.equal(m.gvwrLb, 11030);
  assert.equal(m.drivetrain, 'AWD');
});

test('audited specs: Rangeline 21PS 2027', () => {
  const m = motorhomes.find((x) => x.slug === 'rangeline-21ps-2027');
  assert.ok(m);
  assert.equal(m.msrp, 161400);
  assert.equal(m.gvwrLb, 9350);
  assert.equal(m.fuelType, 'Gas');
  assert.equal(m.chassis, 'RAM ProMaster 3500');
});

test('factory solar standard/optional matches official airstream.com', () => {
  // Per airstream.com (Specifications → ENERGY & POWER → Solar Charging System),
  // 10 of 11 touring coaches ship solar as standard; the ONLY optional one is
  // the Atlas 25RT (400 W rooftop is a $3,500 add-on, tagged "(Optional)").
  const standard = motorhomes.filter((x) => x.solarStandard === true);
  const optional = motorhomes.filter((x) => x.solarStandard === false);
  assert.equal(standard.length, 10, 'exactly 10 motorhomes have standard solar');
  assert.equal(optional.length, 1, 'exactly 1 motorhome has optional solar');
  assert.equal(optional[0].slug, 'atlas-25rt-2027', 'the optional-solar model is the Atlas 25RT');
  // Every motorhome that publishes wattage must declare its status.
  for (const m of motorhomes) {
    if (m.solarW > 0) {
      assert.equal(typeof m.solarStandard, 'boolean', `${m.slug} declares solarStandard`);
    }
  }
});


// ---------------------------------------------------------------------------
// Validation logic
// ---------------------------------------------------------------------------

test('validateMotorhome catches bad slug', () => {
  const bad = { slug: 'Bad Slug!' };
  assert.ok(validateMotorhome(bad).some((p) => p.includes('bad slug')));
});

test('validateMotorhome catches NCC mismatch', () => {
  const bad = {
    slug: 'x-1y-2027', model: 'X', floorplan: '1Y', year: 2027,
    type: 'motorhome', msrp: 1000, weightLb: 100, gvwrLb: 200, nccLb: 999,
    sleeps: 2, chassis: 'Test', engine: 'Test', fuelType: 'Gas',
  };
  assert.ok(validateMotorhome(bad).some((p) => p.includes('ncc mismatch')));
});

test('validateMotorhome catches missing chassis', () => {
  const bad = {
    slug: 'x-1y-2027', model: 'X', floorplan: '1Y', year: 2027,
    type: 'motorhome', msrp: 1000, weightLb: 100, gvwrLb: 200, nccLb: 100,
    sleeps: 2, engine: 'Test', fuelType: 'Gas',
  };
  assert.ok(validateMotorhome(bad).some((p) => p.includes('chassis')));
});

test('validateMotorhome requires boolean solarStandard when solar is published', () => {
  const bad = {
    slug: 'x-1y-2027', model: 'X', floorplan: '1Y', year: 2027,
    type: 'motorhome', msrp: 1000, weightLb: 100, gvwrLb: 200, nccLb: 100,
    sleeps: 2, chassis: 'Test', engine: 'Test', fuelType: 'Gas',
    solarW: 400, // wattage published but no solarStandard
  };
  assert.ok(validateMotorhome(bad).some((p) => p.includes('solarStandard')));
  // Adding the boolean clears the problem.
  assert.ok(!validateMotorhome({ ...bad, solarStandard: true }).some((p) => p.includes('solarStandard')));
});

// ---------------------------------------------------------------------------
// Grouping and family helpers
// ---------------------------------------------------------------------------

test('groupMotorhomesByFamily covers 4 families', () => {
  const fams = groupMotorhomesByFamily(motorhomes);
  assert.equal(fams.length, 4);
  const names = fams.map((f) => f.family);
  assert.ok(names.includes('Atlas'));
  assert.ok(names.includes('Interstate 24'));
  assert.ok(names.includes('Interstate 19'));
  assert.ok(names.includes('Rangeline'));
});

test('groupMotorhomesByFamily covers all entries', () => {
  const fams = groupMotorhomesByFamily(motorhomes);
  const total = fams.reduce((n, f) => n + f.motorhomes.length, 0);
  assert.equal(total, motorhomes.length);
});

test('groupMotorhomesByFamily is ordered by entry price descending', () => {
  const fams = groupMotorhomesByFamily(motorhomes);
  const prices = fams.map((f) => f.priceMin);
  assert.deepEqual(prices, [...prices].sort((a, b) => b - a));
});

test('motorhomeFamilyNames returns sorted names', () => {
  const names = motorhomeFamilyNames(motorhomes);
  assert.ok(names.length >= 3);
  assert.deepEqual(names, [...names].sort());
});

// ---------------------------------------------------------------------------
// Official URLs
// ---------------------------------------------------------------------------

test('every motorhome family maps to an official airstream.com URL', () => {
  const fams = [...new Set(motorhomes.map((m) => m.model))];
  for (const model of fams) {
    const url = motorhomeOfficialUrl(model);
    assert.ok(url, `no official URL for "${model}"`);
    assert.match(url, /^https:\/\/www\.airstream\.com\//, `bad URL for ${model}`);
  }
});

test('all motorhome official URLs are https airstream.com', () => {
  for (const [slug, url] of Object.entries(MOTORHOME_OFFICIAL_URLS)) {
    assert.match(url, /^https:\/\/www\.airstream\.com\/\S+/, `${slug}: ${url}`);
  }
});

// Regression guard for the broken-link bug (2026-06-18): a subagent had written
// `/touring-coaches/{family}/` URLs that ALL 404'd, with a false "verified"
// comment. The real pattern is `/explore-products/touring-coaches/...` and each
// URL below was curl-verified HTTP 200. Casing on airstream.com is irregular
// (atlas-25MS upper, interstate-24gtx lower, interstate-24GLX upper) — do NOT
// "normalize" these; re-verify with curl if Airstream restructures.
test('every motorhome has a per-slug official URL on the correct /explore-products/ path', () => {
  for (const m of motorhomes) {
    const url = motorhomeOfficialUrlBySlug(m.slug, m.model);
    assert.ok(url, `no official URL for slug "${m.slug}"`);
    assert.match(
      url,
      /^https:\/\/www\.airstream\.com\/explore-products\/touring-coaches\//,
      `${m.slug} must use the /explore-products/touring-coaches/ pattern, got ${url}`,
    );
    // the old broken bare pattern must never come back
    assert.doesNotMatch(
      url,
      /airstream\.com\/touring-coaches\//,
      `${m.slug} regressed to the old 404 pattern: ${url}`,
    );
  }
});

test('per-slug official URLs exactly match the curl-verified (2026-06-18) targets', () => {
  const EXPECTED = {
    'atlas-25ms-2027': 'https://www.airstream.com/explore-products/touring-coaches/atlas/atlas-25MS',
    'atlas-25rt-2027': 'https://www.airstream.com/explore-products/touring-coaches/atlas/atlas-25RT',
    'interstate-24gtx-2026': 'https://www.airstream.com/explore-products/touring-coaches/interstate/interstate-24gtx',
    'interstate-24glx-2027': 'https://www.airstream.com/explore-products/touring-coaches/interstate/interstate-24GLX',
    'interstate-24gt-2027': 'https://www.airstream.com/explore-products/touring-coaches/interstate/interstate-24GT',
    'interstate-24gl-2027': 'https://www.airstream.com/explore-products/touring-coaches/interstate/interstate-24GL',
    'interstate-19gtx-2027': 'https://www.airstream.com/explore-products/touring-coaches/interstate/interstate-19GTX',
    'interstate-19gt-2027': 'https://www.airstream.com/explore-products/touring-coaches/interstate/interstate-19GT',
    'interstate-19x-2027': 'https://www.airstream.com/explore-products/touring-coaches/interstate/interstate-19X',
    'rangeline-21pl-2027': 'https://www.airstream.com/explore-products/touring-coaches/rangeline/rangeline-21pl',
    'rangeline-21ps-2027': 'https://www.airstream.com/explore-products/touring-coaches/rangeline/rangeline-21ps',
  };
  // every model in the dataset has an exact expected URL
  for (const m of motorhomes) {
    assert.equal(
      MOTORHOME_OFFICIAL_URLS_BY_SLUG[m.slug],
      EXPECTED[m.slug],
      `official URL for ${m.slug} drifted from the verified target`,
    );
  }
  // and the map has no stray/extra entries
  assert.equal(Object.keys(MOTORHOME_OFFICIAL_URLS_BY_SLUG).length, Object.keys(EXPECTED).length);
});

test('family-landing official URLs also use the /explore-products/ path', () => {
  for (const [slug, url] of Object.entries(MOTORHOME_OFFICIAL_URLS)) {
    assert.match(
      url,
      /^https:\/\/www\.airstream\.com\/explore-products\/touring-coaches\//,
      `family ${slug} must use /explore-products/ path, got ${url}`,
    );
  }
});

// ---------------------------------------------------------------------------
// Off-grid estimator compatibility (motorhomes use the same estimator)
// ---------------------------------------------------------------------------

test('every motorhome has the fields needed for the off-grid estimator', () => {
  for (const m of motorhomes) {
    assert.ok(m.batteryKwh > 0, `${m.slug} batteryKwh`);
    assert.ok(m.freshGal > 0, `${m.slug} freshGal`);
    assert.ok(m.grayGal > 0, `${m.slug} grayGal`);
    assert.ok(m.blackGal > 0, `${m.slug} blackGal`);
  }
});

test('off-grid estimator works with motorhome data (Atlas 25MS)', () => {
  const m = motorhomes.find((x) => x.slug === 'atlas-25ms-2027');
  const r = estimateOffGrid(m, { people: 2, intensity: 'moderate', season: 'summer', useSolar: true });
  assert.ok(r.days > 0, 'produces a positive estimate');
  assert.ok(r.limiter === 'power' || r.limiter === 'water', 'has a valid limiter');
});

// ---------------------------------------------------------------------------
// Rendering: motorhome detail page
// ---------------------------------------------------------------------------

test('renderMotorhomeDetail produces a valid HTML document', () => {
  const m = motorhomes.find((x) => x.slug === 'atlas-25ms-2027');
  const html = renderMotorhomeDetail(m);
  assert.ok(html.startsWith('<!DOCTYPE html>'));
  assert.ok(html.trimEnd().endsWith('</html>'));
});

test('renderMotorhomeDetail shows motorhome-specific specs', () => {
  const m = motorhomes.find((x) => x.slug === 'atlas-25ms-2027');
  const html = renderMotorhomeDetail(m);
  // Motorhome-specific fields
  assert.match(html, /Chassis/);
  assert.match(html, /Engine/);
  assert.match(html, /Drivetrain/);
  assert.match(html, /Fuel type/);
  // Should NOT have tow calculator (motorhomes are self-propelled)
  assert.doesNotMatch(html, /class="towtool"/);
  // Should have off-grid estimator
  assert.match(html, /class="estimator offgrid-tool"/);
  assert.match(html, /How long off-grid\?/);
});

test('renderMotorhomeDetail shows MSRP and weight', () => {
  const m = motorhomes.find((x) => x.slug === 'atlas-25ms-2027');
  const html = renderMotorhomeDetail(m);
  assert.match(html, /\$335,900/);
  assert.match(html, /12,125 lb/);   // GVWR
  assert.match(html, /10,227 lb/);   // base weight
});

test('renderMotorhomeDetail labels standard vs optional factory solar', () => {
  // Standard-solar model (Atlas 25MS) shows "400 W (standard)".
  const std = motorhomes.find((x) => x.slug === 'atlas-25ms-2027');
  const stdHtml = renderMotorhomeDetail(std);
  assert.match(stdHtml, /400 W \(standard\)/);
  // Optional-solar model (Atlas 25RT) must be explicitly tagged "(optional)" —
  // a bare "400 W" reads identical to the standard-equipped 25MS and hides the
  // $3,500 upgrade. The factory solar is an add-on, so the spec must say so.
  const opt = motorhomes.find((x) => x.slug === 'atlas-25rt-2027');
  const optHtml = renderMotorhomeDetail(opt);
  assert.match(optHtml, /400 W \(optional\)/);
  assert.doesNotMatch(optHtml, /400 W \(standard\)/);
});

test('renderMotorhomeDetail has back link to motorhome family page', () => {
  const m = motorhomes.find((x) => x.slug === 'atlas-25ms-2027');
  const html = renderMotorhomeDetail(m);
  assert.match(html, /href="\.\.\/mf\/atlas\.html"/);
  assert.match(html, /← All Atlas/);
});

test('every motorhome renders a detail page without throwing', () => {
  for (const m of motorhomes) {
    const html = renderMotorhomeDetail(m);
    assert.ok(html.startsWith('<!DOCTYPE html>'), m.slug);
    assert.ok(html.includes('Specifications'), m.slug);
  }
});

// ---------------------------------------------------------------------------
// Rendering: motorhome family page
// ---------------------------------------------------------------------------

test('renderMotorhomeFamily shows all models in the family', () => {
  const fams = groupMotorhomesByFamily(motorhomes);
  const atlas = fams.find((f) => f.family === 'Atlas');
  const html = renderMotorhomeFamily(atlas);
  assert.ok(html.startsWith('<!DOCTYPE html>'));
  assert.match(html, /Atlas/);
  // Should have cards for each motorhome in the family
  const cardCount = (html.match(/class="card"/g) || []).length;
  assert.equal(cardCount, atlas.motorhomes.length);
});

// ---------------------------------------------------------------------------
// Rendering: motorhome index page
// ---------------------------------------------------------------------------

test('renderMotorhomeIndex produces a valid page with family cards', () => {
  const fams = groupMotorhomesByFamily(motorhomes);
  const html = renderMotorhomeIndex(fams, motorhomes);
  assert.ok(html.startsWith('<!DOCTYPE html>'));
  // Should have family cards for Atlas, Interstate 24, Interstate 19, Rangeline
  assert.equal((html.match(/class="fam"/g) || []).length, 4);
});

test('renderMotorhomeIndex has motorhome-specific content', () => {
  const fams = groupMotorhomesByFamily(motorhomes);
  const html = renderMotorhomeIndex(fams, motorhomes);
  assert.match(html, /Touring Coach/i);
  assert.match(html, /Class B/i);
});

// ---------------------------------------------------------------------------
// Rendering: explore card for motorhomes
// ---------------------------------------------------------------------------

test('renderMotorhomeExploreCard carries numeric data attributes', () => {
  const m = motorhomes.find((x) => x.slug === 'atlas-25ms-2027');
  const html = renderMotorhomeExploreCard(m);
  assert.match(html, /data-msrp="335900"/);
  assert.match(html, /data-gvwr="12125"/);
  assert.match(html, /data-sleeps="2"/);
});

// ---------------------------------------------------------------------------
// Navigation: Motorhome entry exists
// ---------------------------------------------------------------------------

test('motorhome index (redirect shim) keeps the unified Explore nav — no Motorhomes top tab', () => {
  const fams = groupMotorhomesByFamily(motorhomes);
  const html = renderMotorhomeIndex(fams, motorhomes);
  // Motorhomes is no longer a top-nav tab — it's a type filter inside Explore.
  const nav = html.match(/<nav class="topnav-links"[^>]*>([\s\S]*?)<\/nav>/);
  assert.ok(nav, 'has a topnav-links nav');
  assert.doesNotMatch(nav[1], /href="[^"]*motorhomes\.html"/);
  // but the page still routes users into the unified Explore hub
  assert.match(html, /index\.html#all&type=motorhome/);
});
