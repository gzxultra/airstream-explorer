import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadTrailers, validateTrailer, validateDataset, groupByModel,
  modelNames, years, filterTrailers, assetPaths, groupByFamily,
  slugify, twinSlug, resolveAssets, loadDecor, resolveDecor,
  officialUrl, OFFICIAL_URLS,
} from '../src/lib/data.mjs';
import { readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, '..', 'public');
const hasAsset = (rel) => existsSync(join(PUBLIC, rel));

const trailers = loadTrailers();

test('dataset loads with 59 floorplans', () => {
  assert.equal(trailers.length, 59);
});

test('dataset passes full validation', () => {
  assert.equal(validateDataset(trailers), true);
});

test('year split is 31x2026 + 28x2025', () => {
  const c = trailers.reduce((m, t) => ((m[t.year] = (m[t.year] || 0) + 1), m), {});
  assert.equal(c[2026], 31);
  assert.equal(c[2025], 28);
});

test('all slugs unique', () => {
  assert.equal(new Set(trailers.map((t) => t.slug)).size, 59);
});

test('CCC always equals GVWR minus dry weight', () => {
  for (const t of trailers) assert.equal(t.cccLb, t.gvwrLb - t.weightLb, t.slug);
});

// The audited specs Ernie explicitly cares about — lock them with tests.
test('audited specs: Classic 33FB 2026', () => {
  const t = trailers.find((x) => x.slug === 'classic-33fb-2026');
  assert.ok(t, 'classic-33fb-2026 exists');
  assert.equal(t.msrp, 222900);
  assert.equal(t.weightLb, 8425);
  assert.equal(t.gvwrLb, 10000);
  assert.equal(t.cccLb, 1575);
});

test('audited specs: Flying Cloud 25FB 2026', () => {
  const t = trailers.find((x) => x.slug === 'flying-cloud-25fb-2026');
  assert.ok(t);
  assert.equal(t.msrp, 118900);
});

test('audited specs: Basecamp 16X 2026', () => {
  const t = trailers.find((x) => x.slug === 'basecamp-16x-2026');
  assert.ok(t);
  // Official airstream.com MY2026 Basecamp 16X: dry 2700, GVWR 3500, hitch 450, NCC 800.
  assert.equal(t.weightLb, 2700);
  assert.equal(t.gvwrLb, 3500);
  assert.equal(t.hitchWeightLb, 450);
  assert.equal(t.cccLb, 800);
  assert.equal(t.msrp, 54900);
});

test('audited specs: Basecamp 20X 2026', () => {
  const t = trailers.find((x) => x.slug === 'basecamp-20x-2026');
  assert.ok(t);
  // Official airstream.com MY2026 Basecamp 20X: dry 3500, GVWR 4300, hitch 535, NCC 800.
  assert.equal(t.weightLb, 3500);
  assert.equal(t.gvwrLb, 4300);
  assert.equal(t.hitchWeightLb, 535);
  assert.equal(t.cccLb, 800);
});

test('validateTrailer catches a ccc mismatch', () => {
  const bad = { slug: 'x-1y-2026', model: 'X', floorplan: '1Y', year: 2026,
    msrp: 1000, weightLb: 100, gvwrLb: 200, cccLb: 999, sleeps: 2 };
  assert.ok(validateTrailer(bad).some((p) => p.includes('ccc mismatch')));
});

test('validateTrailer catches bad slug', () => {
  assert.ok(validateTrailer({ slug: 'Bad Slug!' }).some((p) => p.includes('bad slug')));
});

test('groupByModel covers all 12 families and every trailer', () => {
  const g = groupByModel(trailers);
  assert.equal(g.size, 12);
  assert.equal([...g.values()].reduce((n, a) => n + a.length, 0), 59);
});

test('filterTrailers by year', () => {
  assert.equal(filterTrailers(trailers, { year: 2026 }).length, 31);
  assert.equal(filterTrailers(trailers, { year: 2025 }).length, 28);
  assert.equal(filterTrailers(trailers, { year: 'all' }).length, 59);
});

test('filterTrailers by model + year together', () => {
  const r = filterTrailers(trailers, { year: 2026, model: 'Bambi' });
  assert.ok(r.length > 0);
  assert.ok(r.every((t) => t.year === 2026 && t.model === 'Bambi'));
});

test('modelNames + years', () => {
  assert.equal(modelNames(trailers).length, 12);
  assert.deepEqual(years(trailers), [2026, 2025]);
});

test('assetPaths shape', () => {
  const t = trailers.find((x) => x.slug === 'classic-33fb-2026');
  const a = assetPaths(t);
  assert.equal(a.thumb, 'assets/img/thumbs/classic-33fb-2026.webp');
  assert.equal(a.hero, 'assets/img/heroes/classic.webp');
  assert.equal(a.gallery.length, 3);
});

// --- Image-resolution regressions (the broken-image bugs we fixed) ---

test('slugify maps names to file slugs', () => {
  assert.equal(slugify('Flying Cloud'), 'flying-cloud');
  assert.equal(slugify('Basecamp XE'), 'basecamp-xe');
  assert.equal(slugify('Frank Lloyd Wright Limited Edition'), 'frank-lloyd-wright-limited-edition');
  assert.equal(slugify('Stetson 6666 Special Edition'), 'stetson-6666-special-edition');
});

test('every trailer hero is derived from the model (not heroFamily) and exists on disk', () => {
  for (const t of trailers) {
    const a = assetPaths(t);
    assert.equal(a.hero, `assets/img/heroes/${slugify(t.model)}.webp`, t.slug);
    assert.ok(hasAsset(a.hero), `missing hero file for ${t.slug}: ${a.hero}`);
  }
});

test('all 12 model families have a hero file on disk', () => {
  const families = [...new Set(trailers.map((t) => slugify(t.model)))];
  assert.equal(families.length, 12);
  for (const f of families) {
    assert.ok(hasAsset(`assets/img/heroes/${f}.webp`), `missing hero: ${f}`);
  }
});

test('twinSlug flips the model year', () => {
  assert.equal(twinSlug({ slug: 'bambi-16rb-2026', year: 2026 }), 'bambi-16rb-2025');
  assert.equal(twinSlug({ slug: 'bambi-16rb-2025', year: 2025 }), 'bambi-16rb-2026');
});

test('resolveAssets: every emitted gallery + hero path exists on disk', () => {
  for (const t of trailers) {
    const a = resolveAssets(t, hasAsset);
    if (a.hero) assert.ok(hasAsset(a.hero), `${t.slug} hero ${a.hero}`);
    for (const g of a.gallery) assert.ok(hasAsset(g), `${t.slug} gallery ${g}`);
  }
});

test('resolveAssets: a slug with no own gallery falls back to its 2025 twin', () => {
  // synthetic: only the 2025 twin's gallery files exist on disk
  const t = { slug: 'bambi-16rb-2026', year: 2026 };
  const twinOnly = (p) => p.startsWith('assets/img/gallery/bambi-16rb-2025-');
  const a = resolveAssets(t, twinOnly);
  assert.equal(a.gallery.length, 3);
  assert.ok(a.gallery.every((g) => g.includes('bambi-16rb-2025-')), 'should use 2025 twin files');
});

test('resolveAssets: every one of the 59 floorplans now has its OWN gallery on disk', () => {
  // The official-asset pass gave each floorplan its own photos; none rely on a twin.
  for (const t of trailers) {
    const ownCount = [1, 2, 3].filter((i) =>
      hasAsset(`assets/img/gallery/${t.slug}-${i}.webp`),
    ).length;
    assert.ok(ownCount > 0, `${t.slug} has no own gallery images`);
  }
});

test('resolveAssets: orphan with no gallery + no twin renders hero-only, never broken', () => {
  // synthetic orphan: nothing on disk for it or a twin
  const t = { slug: 'zzz-9zz-2026', model: 'Zzz', floorplan: '9ZZ', year: 2026 };
  const heroOnly = (p) => p === 'assets/img/heroes/zzz.webp';
  const a = resolveAssets(t, heroOnly);
  assert.equal(a.gallery.length, 0);           // no broken <img> emitted
  assert.equal(a.floorplan, null);             // no diagram either
});

test('resolveAssets: no trailer is missing BOTH hero and gallery', () => {
  for (const t of trailers) {
    const a = resolveAssets(t, hasAsset);
    assert.ok(a.hero || a.gallery.length > 0, `${t.slug} would render image-less`);
  }
});

test('resolveAssets: every one of the 59 floorplans resolves an official diagram on disk', () => {
  for (const t of trailers) {
    const a = resolveAssets(t, hasAsset);
    assert.ok(a.floorplan, `${t.slug} has no floor-plan diagram`);
    assert.ok(hasAsset(a.floorplan), `${t.slug} floorplan ${a.floorplan} missing on disk`);
  }
});

test('resolveAssets: a 2026 floorplan with no own diagram falls back to its 2025 twin', () => {
  // synthetic: pretend only the 2025 twin diagram exists on disk
  const t = { slug: 'zzz-9zz-2026', model: 'Zzz', floorplan: '9ZZ', year: 2026 };
  const only2025 = (p) => p === 'assets/img/floorplans/zzz-9zz-2025.webp';
  const a = resolveAssets(t, only2025);
  assert.equal(a.floorplan, 'assets/img/floorplans/zzz-9zz-2025.webp');
});

test('groupByFamily returns 12 families covering every floorplan exactly once', () => {
  const fams = groupByFamily(trailers);
  assert.equal(fams.length, 12);
  const total = fams.reduce((n, f) => n + f.trailers.length, 0);
  assert.equal(total, 59);
});

test('groupByFamily is ordered by entry price descending (priced families)', () => {
  const fams = groupByFamily(trailers).filter((f) => f.priceMin != null);
  const prices = fams.map((f) => f.priceMin);
  assert.deepEqual(prices, [...prices].sort((a, b) => b - a));
});

test('groupByFamily computes correct ranges for Flying Cloud', () => {
  const fc = groupByFamily(trailers).find((f) => f.family === 'Flying Cloud');
  assert.ok(fc, 'Flying Cloud family exists');
  // 10 entries, 5 floorplans, both years
  assert.equal(fc.entryCount, 10);
  assert.equal(fc.floorplanCount, 5);
  assert.deepEqual(fc.years, [2026, 2025]);
  // price range matches min/max over its rows
  const rows = trailers.filter((t) => t.model === 'Flying Cloud');
  assert.equal(fc.priceMin, Math.min(...rows.map((r) => r.msrp)));
  assert.equal(fc.priceMax, Math.max(...rows.map((r) => r.msrp)));
});

test('groupByFamily flags limited/special editions', () => {
  const fams = groupByFamily(trailers);
  const flw = fams.find((f) => /Frank Lloyd Wright/.test(f.family));
  const stetson = fams.find((f) => /Stetson/.test(f.family));
  assert.ok(flw && flw.limited, 'FLW is limited');
  assert.ok(stetson && stetson.limited, 'Stetson is limited');
  const bambi = fams.find((f) => f.family === 'Bambi');
  assert.ok(bambi && !bambi.limited, 'Bambi is not limited');
});

test('every family hero slug matches an on-disk hero file', () => {
  const fams = groupByFamily(trailers);
  for (const f of fams) {
    assert.ok(hasAsset(f.hero), `missing hero for ${f.family}: ${f.hero}`);
  }
});

// ---------------------------------------------------------------------------
// Décor options
// ---------------------------------------------------------------------------

test('loadDecor returns a family-keyed map with schemes', () => {
  const decor = loadDecor();
  assert.ok(decor && typeof decor === 'object');
  assert.ok(Array.isArray(decor.classic), 'classic has décor schemes');
  assert.ok(decor.classic.length >= 1);
  const s = decor.classic[0];
  assert.ok(s.name && typeof s.name === 'string');
  assert.ok(Array.isArray(s.swatches) && s.swatches.length > 0);
  assert.ok(s.swatches[0].kind && s.swatches[0].file);
});

test('every décor swatch file referenced in the map exists on disk', () => {
  const decor = loadDecor();
  for (const [family, schemes] of Object.entries(decor)) {
    for (const s of schemes) {
      for (const sw of s.swatches) {
        assert.ok(
          hasAsset(`assets/img/decor/${sw.file}`),
          `missing décor swatch ${family}/${s.slug}: ${sw.file}`,
        );
      }
    }
  }
});

test('resolveDecor returns schemes for a known family with on-disk paths', () => {
  const decor = loadDecor();
  const classic = trailers.find((t) => t.model === 'Classic');
  const schemes = resolveDecor(classic, decor, hasAsset);
  assert.ok(schemes.length >= 1);
  assert.match(schemes[0].swatches[0].src, /^assets\/img\/decor\/.*\.webp$/);
});

test('resolveDecor drops swatches whose files are missing', () => {
  const fakeMap = {
    bambi: [{ name: 'X', slug: 'x', description: '', swatches: [{ kind: 'Cabinetry', file: 'does-not-exist.webp' }] }],
  };
  const bambi = trailers.find((t) => t.model === 'Bambi');
  // scheme has only a missing swatch -> dropped entirely
  assert.deepEqual(resolveDecor(bambi, fakeMap, hasAsset), []);
});

test('resolveDecor returns [] for a family with no décor data', () => {
  const classic = trailers.find((t) => t.model === 'Classic');
  assert.deepEqual(resolveDecor(classic, {}, hasAsset), []);
});

test('every family maps to an official airstream.com URL', () => {
  const fams = [...new Set(trailers.map((t) => t.model))];
  for (const model of fams) {
    const url = officialUrl(model);
    assert.ok(url, `no official URL for family "${model}"`);
    assert.match(url, /^https:\/\/www\.airstream\.com\//, `bad URL for ${model}: ${url}`);
  }
});

test('officialUrl resolves by family slug, not exact string', () => {
  // any floorplan of a family resolves to the same family URL
  assert.equal(officialUrl('Flying Cloud'), OFFICIAL_URLS['flying-cloud']);
  assert.equal(officialUrl('World Traveler'), OFFICIAL_URLS['world-traveler']);
  assert.equal(officialUrl('Basecamp XE'), OFFICIAL_URLS['basecamp-xe']);
});

test('officialUrl returns null for unknown model', () => {
  assert.equal(officialUrl('Nonexistent Model'), null);
});

test('all official URLs are https airstream.com (no guessed/http)', () => {
  for (const [slug, url] of Object.entries(OFFICIAL_URLS)) {
    assert.match(url, /^https:\/\/www\.airstream\.com\/\S+/, `${slug}: ${url}`);
  }
});
