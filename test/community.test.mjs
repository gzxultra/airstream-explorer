import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadCommunityPhotos, validatePhoto, validateCommunity,
  groupByBucket, sectionsForGallery, renderCommunityBody, renderCreditsBody,
} from '../src/lib/community.mjs';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, '..', 'public');

const photos = loadCommunityPhotos();

test('community dataset loads and is non-empty', () => {
  assert.ok(Array.isArray(photos));
  assert.ok(photos.length >= 20, `expected a real gallery, got ${photos.length}`);
});

test('community dataset passes full validation', () => {
  assert.equal(validateCommunity(photos), true);
});

// THE LEGAL CONTRACT — every photo must carry complete, linkable attribution.
// This is locked exactly like the audited spec tests. Do not weaken it.
test('every photo has complete attribution (artist, license, license URL, source URL)', () => {
  for (const p of photos) {
    assert.ok(p.artist && p.artist.trim(), `${p.id}: missing artist`);
    assert.ok(p.license && p.license.trim(), `${p.id}: missing license`);
    assert.match(p.licenseUrl || '', /^https?:\/\//, `${p.id}: license URL not a link`);
    assert.match(p.sourceUrl || '', /^https?:\/\//, `${p.id}: source URL not a link`);
    assert.ok(p.source && p.source.trim(), `${p.id}: missing source name`);
  }
});

test('every photo uses a free license (CC or public domain)', () => {
  for (const p of photos) {
    assert.match(
      p.license,
      /(CC0|CC BY|public domain)/i,
      `${p.id}: license "${p.license}" is not recognizably free`,
    );
  }
});

test('all photo ids are unique', () => {
  assert.equal(new Set(photos.map((p) => p.id)).size, photos.length);
});

test('every referenced image file exists on disk (thumb)', () => {
  for (const p of photos) {
    assert.ok(existsSync(join(PUBLIC, p.thumb)), `missing thumb: ${p.thumb}`);
  }
});

test('validatePhoto flags a record missing attribution', () => {
  const bad = { id: 'x', thumb: 't.jpg', bucket: 'b', source: 'S', sourceUrl: 'https://e.org' };
  const problems = validatePhoto(bad);
  assert.ok(problems.some((p) => /artist/.test(p)));
  assert.ok(problems.some((p) => /license/.test(p)));
});

test('groupByBucket partitions every photo exactly once', () => {
  const groups = groupByBucket(photos);
  const total = groups.reduce((n, g) => n + g.photos.length, 0);
  assert.equal(total, photos.length);
});

test('sectionsForGallery keeps every photo and never leaves a sparse section', () => {
  const sections = sectionsForGallery(photos);
  // no photo lost or duplicated
  const total = sections.reduce((n, s) => n + s.photos.length, 0);
  assert.equal(total, photos.length);
  // the whole point of the merge: the small per-model buckets are gone, folded
  // into one "By model" section big enough to fill a multi-column masonry.
  // Every section must carry enough photos to populate the 3-column grid.
  for (const s of sections) {
    assert.ok(s.photos.length >= 3, `section "${s.bucket}" too sparse: ${s.photos.length}`);
  }
});

test('sectionsForGallery folds named model buckets into a single "By model" section', () => {
  const sections = sectionsForGallery(photos);
  const names = sections.map((s) => s.bucket);
  assert.ok(names.includes('By model'), 'expected a "By model" section');
  // none of the individual model names survive as their own section
  for (const model of ['Bambi', 'Caravel', 'Flying Cloud', 'Safari', 'International', 'Trade Wind']) {
    assert.ok(!names.includes(model), `model bucket "${model}" should be merged away`);
  }
  // the thematic buckets are preserved as their own sections
  assert.ok(names.includes('Vintage & classic'));
  assert.ok(names.includes('Interiors & details'));
  assert.ok(names.includes('On the road & campsites'));
});

test('sectionsForGallery leads with "By model"', () => {
  const sections = sectionsForGallery(photos);
  assert.equal(sections[0].bucket, 'By model');
});

// The rendered credits page must actually contain each artist's name —
// attribution that isn't rendered isn't attribution.
test('credits page renders every photographer name', () => {
  const html = renderCreditsBody(photos, '');
  for (const p of photos) {
    // artist may contain HTML-escapable chars; check an escaped-safe fragment
    const safe = p.artist.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    assert.ok(html.includes(safe), `credits missing artist: ${p.artist}`);
  }
});

test('credits page links every license and source', () => {
  const html = renderCreditsBody(photos, '');
  for (const p of photos) {
    assert.ok(html.includes(`href="${p.licenseUrl}"`), `credits missing license link for ${p.id}`);
    assert.ok(html.includes(`href="${p.sourceUrl}"`), `credits missing source link for ${p.id}`);
  }
});

test('gallery page shows a visible per-photo credit for every photo', () => {
  const html = renderCommunityBody(photos, '');
  // every photo's credit line ("Photo: <artist> · <license>") must be present
  for (const p of photos) {
    const safeArtist = p.artist.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    assert.ok(html.includes(safeArtist), `gallery missing credit for ${p.id}`);
  }
});

// XSS / escaping safety — no raw data-driven angle brackets leak into markup.
test('rendered community + credits HTML escapes data-driven content', () => {
  const evil = [{
    id: 'evil', thumb: 'assets/img/community/evil-thumb.webp',
    bucket: 'Bambi', title: '<script>alert(1)</script>', caption: '"><img onerror=x>',
    artist: '<b>hax</b>', license: 'CC BY 4.0', licenseUrl: 'https://x.org',
    source: 'Wikimedia Commons', sourceUrl: 'https://x.org/file',
  }];
  const g = renderCommunityBody(evil, '');
  const c = renderCreditsBody(evil, '');
  assert.ok(!g.includes('<script>alert(1)</script>'));
  assert.ok(!c.includes('<script>alert(1)</script>'));
  assert.ok(!g.includes('<b>hax</b>'));
  assert.ok(g.includes('&lt;script&gt;'));
});
