// Regression tests for the 2026-09-27 hero/gallery/lightbox remediation:
//  1. detail-hero scrim (.detail-hero-shade, home-hero gradient stops; .hero-zoom visible)
//  2. cutout thumbnails fill the same fixed 16:9 frame as photos
//  3. "View all photos" lives in .gallery-head (right-aligned, normal flow)
//  4. .dsec anchor sections clear the fixed nav (scroll-margin-top: 84px)
//  5. lightbox data-lb-group: gallery group slides == "N photos" == grid items;
//     dark fullscreen lightbox CSS; app.js groups triggers by data-lb-group
//  6. hero files exist and are 1280x720 (±2px)
//
// (a)/(b) iterate EVERY trailer + motorhome detail page. The renders use the
// default (non-existence-aware) asset resolvers so counts are deterministic;
// the hero file check hits disk with a short retry because images under
// public/assets/ may be swapped concurrently by another worker.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadTrailers } from '../src/lib/data.mjs';
import { loadMotorhomes } from '../src/lib/motorhome-data.mjs';
import { renderDetail } from '../src/lib/render.mjs';
import { renderMotorhomeDetail } from '../src/lib/motorhome-render.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const siteCss = fs.readFileSync(join(root, 'src/assets/css/site.css'), 'utf8');
const themeCss = fs.readFileSync(join(root, 'src/assets/css/theme.css'), 'utf8');
const appJs = fs.readFileSync(join(root, 'src/assets/js/app.js'), 'utf8');

const trailers = loadTrailers();
const motorhomes = loadMotorhomes();

function trailerPages() {
  return trailers.map((t) => ({ slug: t.slug, kind: 'trailer', html: renderDetail(t) }));
}
function motorhomePages() {
  return motorhomes.map((m) => ({ slug: m.slug, kind: 'motorhome', html: renderMotorhomeDetail(m) }));
}

function countButtons(html, group) {
  const re = new RegExp(`<button[^>]*data-lb-group="${group}"`, 'g');
  return (html.match(re) || []).length;
}
function gridItems(html) {
  return (html.match(/<button[^>]*class="gallery-img-wrap/g) || []).length;
}

// --------------------------------------------------------------------------
// 5a. Lightbox group consistency across every detail page.
// --------------------------------------------------------------------------
test('lightbox gallery group slides == "N photos" == gallery grid items (all pages)', async (t) => {
  for (const page of [...trailerPages(), ...motorhomePages()]) {
    await t.test(`${page.kind} ${page.slug}`, () => {
      const groupCount = countButtons(page.html, 'gallery');
      const gridCount = gridItems(page.html);
      assert.ok(gridCount > 0, 'gallery grid must render items');
      assert.equal(groupCount, gridCount,
        `gallery lightbox group (${groupCount}) != grid items (${gridCount})`);
      if (page.kind === 'trailer') {
        const label = page.html.match(/<span class="gallery-count">(\d+) photos<\/span>/);
        assert.ok(label, 'trailer gallery must show "N photos"');
        assert.equal(Number(label[1]), gridCount,
          `"N photos" (${label[1]}) != grid items (${gridCount})`);
      }
    });
  }
});

test('mosaic data-lb-open indices are group-local and in range (trailer pages)', async (t) => {
  for (const page of trailerPages()) {
    await t.test(page.slug, () => {
      const gridCount = gridItems(page.html);
      const opens = [...page.html.matchAll(/data-lb-open="(\d+)"/g)].map((m) => Number(m[1]));
      assert.ok(opens.length > 0, 'mosaic must render preview buttons');
      assert.ok(opens.length <= 5, 'mosaic shows at most 5 previews');
      opens.forEach((v, k) => {
        assert.equal(v, k, `mosaic data-lb-open[${k}] must be group-local index ${k}, got ${v}`);
        assert.ok(v < gridCount, `mosaic index ${v} out of gallery range`);
      });
    });
  }
});

test('hero/floorplan lightbox groups are single-slide with group-local index 0', async (t) => {
  for (const page of trailerPages()) {
    await t.test(page.slug, () => {
      assert.equal(countButtons(page.html, 'hero'), 1, 'exactly one hero trigger');
      assert.match(page.html, /data-lb-group="hero"[^>]*data-index="0"/, 'hero index is 0');
      assert.equal(countButtons(page.html, 'floorplan'), 1, 'exactly one floorplan trigger');
      assert.match(page.html, /data-lb-group="floorplan"[^>]*data-index="0"/, 'floorplan index is 0');
      // No page-wide index leakage: every trigger index must be < gallery size.
      const gridCount = gridItems(page.html);
      for (const m of page.html.matchAll(/data-lightbox[^>]*data-index="(\d+)"/g)) {
        assert.ok(Number(m[1]) < gridCount, `page-wide index leak: data-index="${m[1]}"`);
      }
    });
  }
  for (const page of motorhomePages()) {
    await t.test(page.slug, () => {
      assert.equal(countButtons(page.html, 'hero'), 0, 'motorhome hero is not a lightbox trigger');
      assert.equal(countButtons(page.html, 'floorplan'), 0, 'motorhome has no floorplan trigger');
    });
  }
});

test('app.js groups lightbox triggers by data-lb-group', () => {
  assert.ok(appJs.includes("getAttribute('data-lb-group')"), 'lightbox() must read data-lb-group');
  assert.ok(appJs.includes("querySelectorAll('[data-lb-group=\"gallery\"]')"),
    'slideshow must address the gallery group directly');
  assert.ok(!appJs.includes('counter counts from hero'),
    'stale "counter counts from hero" comment must be gone');
  assert.ok(appJs.includes("querySelector('.lightbox-counter')"),
    'slideshow must read the real .lightbox-counter element');
});

// --------------------------------------------------------------------------
// 1. Detail hero scrim.
// --------------------------------------------------------------------------
test('detail hero has a scrim with the home-hero gradient stops; zoom icon stays on top', () => {
  assert.match(siteCss, /\.detail-hero-shade\s*\{/,
    'missing .detail-hero-shade rule');
  assert.ok(siteCss.includes('rgba(20,16,12,.86)'),
    'scrim must reuse the home-hero gradient stops');
  const zoomRule = siteCss.match(/\.hero-zoom\s*\{[^}]*\}/);
  assert.ok(zoomRule, 'missing .hero-zoom rule');
  const zoomZ = Number((zoomRule[0].match(/z-index:\s*(\d+)/) || [])[1]);
  const shadeRule = siteCss.match(/\.detail-hero-shade\s*\{[^}]*\}/);
  const shadeZ = Number((shadeRule[0].match(/z-index:\s*(\d+)/) || [])[1]);
  assert.ok(zoomZ > shadeZ, `.hero-zoom (z ${zoomZ}) must paint above the shade (z ${shadeZ})`);
  // Markup: shade span sits between the hero img and the zoom icon.
  const html = renderDetail(trailers[0]);
  assert.match(html, /detail-hero-img"[^>]*><span class="detail-hero-shade"/,
    'trailer hero button must include the shade span');
  const mmHtml = renderMotorhomeDetail(motorhomes[0]);
  assert.match(mmHtml, /<div class="detail-hero"><span class="detail-hero-shade"/,
    'motorhome hero must include the shade span');
});

// --------------------------------------------------------------------------
// 2. Cutout thumbnails fill the same fixed frame as photos.
// --------------------------------------------------------------------------
test('cutout thumbnails use the same fixed 16:9 frame + cover as photos', () => {
  const cutout = siteCss.match(/\.gallery-img--cutout\s*\{[^}]*\}/);
  assert.ok(cutout, 'missing .gallery-img--cutout rule');
  assert.match(cutout[0], /aspect-ratio:\s*920\s*\/\s*518/, 'cutout needs the fixed frame');
  assert.match(cutout[0], /object-fit:\s*cover/, 'cutout needs object-fit: cover');
  assert.match(cutout[0], /mix-blend-mode:\s*darken/, 'cutout must keep the darken blend');
});

// --------------------------------------------------------------------------
// 3. "View all photos" lives in .gallery-head, right-aligned, in normal flow.
// --------------------------------------------------------------------------
test('"View all photos" button is inside .gallery-head (not floating between sections)', () => {
  const headRule = siteCss.match(/\.gallery-head \.gallery-show-all\s*\{[^}]*\}/);
  assert.ok(headRule, 'missing .gallery-head .gallery-show-all rule');
  assert.match(headRule[0], /margin-left:\s*auto/, 'button must be right-aligned in the head row');
  assert.ok(!/position:\s*(absolute|fixed)/.test(headRule[0]), 'button must not float/overlap');
  const baseRule = siteCss.match(/\.gallery-show-all\s*\{[^}]*\}/);
  assert.ok(baseRule && !/position:\s*(absolute|fixed)/.test(baseRule[0]),
    '.gallery-show-all must not float/overlap');
  for (const page of trailerPages()) {
    const headIdx = page.html.indexOf('class="gallery-head"');
    const btnIdx = page.html.indexOf('data-gallery-all');
    const mosaicIdx = page.html.indexOf('class="gallery-mosaic"');
    assert.ok(headIdx > -1 && btnIdx > headIdx && btnIdx < mosaicIdx,
      `${page.slug}: show-all button must sit inside .gallery-head before the mosaic`);
  }
  // The expand handler still finds the button by attribute.
  assert.ok(appJs.includes("querySelector('[data-gallery-all]')"),
    'galleryMosaic() must still wire [data-gallery-all]');
});

// --------------------------------------------------------------------------
// 4. Anchor sections clear the fixed nav.
// --------------------------------------------------------------------------
test('.dsec anchor sections get scroll-margin-top: 84px like .up-sec/.mt-sec', () => {
  assert.match(siteCss, /\.up-sec\s*\{[^}]*scroll-margin-top:\s*84px/,
    'precondition: .up-sec has 84px scroll-margin');
  assert.match(siteCss, /\.dsec\s*\{[^}]*scroll-margin-top:\s*84px/,
    '.dsec must clear the fixed nav with 84px scroll-margin-top');
  const html = renderDetail(trailers[0]);
  assert.match(html, /<section class="dsec[^"]*" id="gallery"/, '#gallery is a .dsec section');
  assert.match(html, /<section class="dsec[^"]*" id="floorplan"/, '#floorplan is a .dsec section');
});

// --------------------------------------------------------------------------
// 5b. Dark fullscreen lightbox visuals.
// --------------------------------------------------------------------------
test('lightbox is dark fullscreen: near-black backdrop, large image, quiet caption', () => {
  const backdrop = themeCss.match(/\.lightbox-backdrop\s*\{[^}]*\}/);
  assert.ok(backdrop && /background:\s*#111/.test(backdrop[0]),
    'backdrop must be near-black #111');
  const img = themeCss.match(/\.lightbox-img\s*\{[^}]*\}/);
  assert.ok(img, 'missing .lightbox-img rule');
  assert.match(img[0], /max-width:\s*94vw/, 'image must fill ~92vw+');
  assert.match(img[0], /max-height:\s*88vh/, 'image must fill ~92vh level');
  const cap = themeCss.match(/\.lightbox-caption\s*\{[^}]*\}/);
  assert.ok(cap && /rgba\(255,255,255,\.55\)/.test(cap[0]),
    'caption must be subdued (dim white)');
});

// --------------------------------------------------------------------------
// 6. Hero files exist and are 1280x720 (±2px).
// --------------------------------------------------------------------------
function webpDimensions(buf) {
  if (buf.length < 30) return null;
  if (buf.toString('ascii', 0, 4) !== 'RIFF') return null;
  if (buf.toString('ascii', 8, 12) !== 'WEBP') return null;
  const fourcc = buf.toString('ascii', 12, 16);
  if (fourcc === 'VP8X') {
    return {
      w: 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16)),
      h: 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16)),
    };
  }
  if (fourcc === 'VP8 ') {
    const d = 20;
    if (!(buf[d + 3] === 0x9d && buf[d + 4] === 0x01 && buf[d + 5] === 0x2a)) return null;
    return {
      w: buf[d + 6] | ((buf[d + 7] & 0x3f) << 8),
      h: buf[d + 8] | ((buf[d + 9] & 0x3f) << 8),
    };
  }
  if (fourcc === 'VP8L') {
    const d = 20;
    if (buf[d] !== 0x2f) return null;
    const b1 = buf[d + 1], b2 = buf[d + 2], b3 = buf[d + 3], b4 = buf[d + 4];
    return {
      w: 1 + (b1 | ((b2 & 0x3f) << 8)),
      h: 1 + ((b2 >> 6) | (b3 << 2) | ((b4 & 0x0f) << 10)),
    };
  }
  return null;
}

// Images under public/assets/ may be swapped concurrently by another worker;
// retry briefly on read/parse failure so a torn write can't flake the test.
function readWebpDimsWithRetry(absPath) {
  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const dims = webpDimensions(fs.readFileSync(absPath));
      if (dims) return dims;
      lastErr = new Error('unparseable WebP header');
    } catch (e) {
      lastErr = e;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 150);
  }
  throw lastErr;
}

function heroRef(page) {
  if (page.kind === 'trailer') {
    const m = page.html.match(/<button[^>]*data-lb-group="hero"[^>]*data-full="([^"]+)"/);
    assert.ok(m, `${page.slug}: hero trigger must expose data-full`);
    return m[1];
  }
  const tag = page.html.match(/<img[^>]*class="detail-hero-img"[^>]*>/);
  assert.ok(tag, `${page.slug}: hero img must render`);
  const src = tag[0].match(/src="([^"]+)"/);
  assert.ok(src, `${page.slug}: hero img must have src`);
  return src[1];
}

test('every detail hero references an existing 1280x720 heroes/*.webp (no -640/-960)', async (t) => {
  for (const page of [...trailerPages(), ...motorhomePages()]) {
    await t.test(`${page.kind} ${page.slug}`, () => {
      const ref = heroRef(page);
      assert.ok(!/-(640|960)\.webp$/.test(ref), `must reference the full hero, got ${ref}`);
      assert.match(ref, /^\.\.\/assets\/img\/heroes\/[^/]+\.webp$/,
        `unexpected hero path shape: ${ref}`);
      const absPath = join(root, 'public', ref.replace(/^\.\.\//, ''));
      assert.ok(fs.existsSync(absPath), `hero file missing: ${absPath}`);
      const { w, h } = readWebpDimsWithRetry(absPath);
      assert.ok(Math.abs(w - 1280) <= 2 && Math.abs(h - 720) <= 2,
        `${path.basename(absPath)} is ${w}x${h}, expected 1280x720 (±2px)`);
    });
  }
});
