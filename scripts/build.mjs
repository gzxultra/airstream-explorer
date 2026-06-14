#!/usr/bin/env node
// Build the static site into dist/. Zero dependencies — Node built-ins only.
// Pipeline: validate data -> render index + 59 detail pages -> copy assets.

import { mkdirSync, writeFileSync, readFileSync, rmSync, cpSync, existsSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { loadTrailers, validateDataset, groupByFamily, resolveAssets } from '../src/lib/data.mjs';
import { renderIndex, renderFamily, renderDetail, renderExplore, renderCompare, page } from '../src/lib/render.mjs';
import { loadCommunityPhotos, validateCommunity, renderCommunityBody, renderCreditsBody } from '../src/lib/community.mjs';
import { loadCampgrounds, validateCampgrounds } from '../src/lib/campgrounds.mjs';
import { renderCampgroundsPage } from '../src/lib/campgrounds-render.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');
const PUBLIC = join(ROOT, 'public');

function log(...a) { console.log('[build]', ...a); }

// Existence check against the source-of-truth public/ tree.
const hasAsset = (rel) => existsSync(join(PUBLIC, rel));
const resolve = (t) => resolveAssets(t, hasAsset);

// 1. Load + validate (fail the build on any data problem)
const trailers = loadTrailers();
validateDataset(trailers);
const families = groupByFamily(trailers);
log(`data ok: ${trailers.length} floorplans in ${families.length} families`);

// 1b. Load + validate community photos (fail the build if any attribution is missing)
const community = loadCommunityPhotos();
validateCommunity(community);
log(`community photos ok: ${community.length} (all attributed)`);

// 1c. Load + validate campground dataset (Recreation.gov, baked static JSON)
const campData = loadCampgrounds();
validateCampgrounds(campData);
const campgrounds = campData.campgrounds;
log(`campgrounds ok: ${campgrounds.length} RV-capable sites in ${campData.stats.states} states`);

// 2. Clean dist
rmSync(DIST, { recursive: true, force: true });
mkdirSync(join(DIST, 'm'), { recursive: true });
mkdirSync(join(DIST, 'f'), { recursive: true });

// 3. Index (family grid)
writeFileSync(join(DIST, 'index.html'), renderIndex(families));
log('wrote index.html (family grid)');

// 3b. Family pages
for (const fam of families) {
  writeFileSync(join(DIST, 'f', `${fam.slug}.html`), renderFamily(fam, resolve));
}
log(`wrote ${families.length} family pages`);

// 4. Detail pages
for (const t of trailers) {
  writeFileSync(join(DIST, 'm', `${t.slug}.html`), renderDetail(t, resolve, campgrounds));
}
log(`wrote ${trailers.length} detail pages`);

// 4a. Explore & match + Compare (root-level, relRoot = '')
writeFileSync(join(DIST, 'explore.html'), renderExplore(trailers, resolve));
writeFileSync(join(DIST, 'compare.html'), renderCompare(trailers, resolve));
log('wrote explore.html + compare.html');

// 4a2. Campground Finder (national, map + list)
{
  const { body, payload } = renderCampgroundsPage(campgrounds, trailers);
  // The campground dataset (~905 KB baked) is written to its OWN file rather
  // than inlined into the HTML. Inlining forced every visit to re-download the
  // whole dataset (HTML is no-cache) and blocked first paint on a 900 KB parse.
  // As a standalone file it's fingerprinted + immutable-cached (step 6/8): one
  // download, cached forever, fetched async by app.js without blocking the list.
  mkdirSync(join(DIST, 'assets', 'data'), { recursive: true });
  writeFileSync(join(DIST, 'assets', 'data', 'campgrounds.json'), JSON.stringify(payload));
  log(`wrote campground dataset (${(JSON.stringify(payload).length / 1024).toFixed(0)} KB, external + cacheable)`);
  // MapLibre (~940 KB) is the heaviest asset on the site. We DON'T load it
  // render-blocking here — app.js lazy-loads it after the campground list is on
  // screen, so a slow/blocked/aborted map download can never stop the list from
  // rendering. Keep the CSS (small) and preload the JS at low priority so it's
  // usually warm by the time app.js asks for it.
  const head = '<link rel="stylesheet" href="assets/vendor/maplibre/maplibre-gl.css">\n'
    + '<link rel="preload" href="assets/vendor/maplibre/maplibre-gl.js" as="script">\n';
  writeFileSync(
    join(DIST, 'campgrounds.html'),
    page({
      title: 'Campground Finder — where your Airstream fits',
      description: `Find RV-friendly campgrounds nationwide matched to your Airstream's real length. ${campgrounds.length} campgrounds across ${campData.stats.states} states from Recreation.gov, with posted max-length limits, ratings, and prices.`,
      body,
      head,
      active: 'campgrounds',
    }),
  );
  log('wrote campgrounds.html (national finder)');
}

// 4b. Community gallery + credits pages (root-level, so relRoot = '')
writeFileSync(
  join(DIST, 'community.html'),
  page({
    title: 'Airstream in the Wild — real community photos',
    description: 'Real, freely-licensed photographs of Airstream travel trailers from photographers via Wikimedia Commons, grouped by model and setting. Every photo credited.',
    body: renderCommunityBody(community, ''),
    active: 'community',
  }),
);
writeFileSync(
  join(DIST, 'credits.html'),
  page({
    title: 'Photo credits & licenses — Airstream Explorer',
    description: 'Full attribution for every community photograph: photographer, license, and original source.',
    body: renderCreditsBody(community, ''),
    active: 'community',
  }),
);
log('wrote community.html + credits.html');

// 5. Static assets: CSS/JS from src, images from public
cpSync(join(ROOT, 'src', 'assets', 'css'), join(DIST, 'assets', 'css'), { recursive: true });
cpSync(join(ROOT, 'src', 'assets', 'js'), join(DIST, 'assets', 'js'), { recursive: true });
if (existsSync(join(ROOT, 'src', 'assets', 'vendor'))) {
  cpSync(join(ROOT, 'src', 'assets', 'vendor'), join(DIST, 'assets', 'vendor'), { recursive: true });
  log('copied vendor assets (maplibre)');
}
// Self-hosted webfonts (woff2 + fonts.css). Served from this origin so pages
// render where Google Fonts is blocked/throttled (e.g. mainland China).
if (existsSync(join(ROOT, 'src', 'assets', 'fonts'))) {
  cpSync(join(ROOT, 'src', 'assets', 'fonts'), join(DIST, 'assets', 'fonts'), { recursive: true });
  log(`copied ${readdirSync(join(DIST, 'assets', 'fonts')).length} self-hosted font files`);
}
// Self-hosted map basemap: US-states GeoJSON + Open Sans glyph stack. The map
// has ZERO external dependency now — no CARTO/CDN — so it loads anywhere the
// page does. Glyph/GeoJSON paths are templated by MapLibre at runtime, so these
// keep stable names (NOT fingerprinted); they're foundational and rarely change.
if (existsSync(join(ROOT, 'src', 'assets', 'map'))) {
  cpSync(join(ROOT, 'src', 'assets', 'map'), join(DIST, 'assets', 'map'), { recursive: true });
  log('copied self-hosted map basemap (us-states.json + glyphs)');
}
if (existsSync(join(PUBLIC, 'assets', 'img'))) {
  cpSync(join(PUBLIC, 'assets', 'img'), join(DIST, 'assets', 'img'), { recursive: true });
  const counts = ['thumbs', 'heroes', 'gallery', 'floorplans'].map((d) => {
    const p = join(DIST, 'assets', 'img', d);
    return `${d}:${existsSync(p) ? readdirSync(p).length : 0}`;
  });
  log('copied images', counts.join(' '));
}

// 6. CONTENT FINGERPRINTING (cache-busting).
//    Images are served with `immutable, max-age=1yr`. If a hero/gallery file
//    keeps the same name (basecamp.jpg) but its bytes change, browsers + the CDN
//    keep serving the OLD cached copy forever — the exact bug where an updated
//    hero never reached returning visitors. Fix: rename every image to include a
//    short content hash (basecamp.a1b2c3d4.jpg). New bytes -> new name -> new URL,
//    so immutable caching is now safe AND always fresh.
{
  const manifest = new Map(); // canonical "assets/<kind>/.." -> hashed "assets/<kind>/.."
  // Fingerprint EVERY cacheable asset (images AND js/css). JS/CSS were the bug:
  // they shipped with stable names ('app.js') under `immutable, max-age=1yr`, so
  // a returning visitor's browser/CDN held the OLD copy for a year and never saw
  // updates (this is exactly how the removed 月供/finance code kept showing up).
  // Content-hashing the name (app.<hash>.js) means new bytes -> new URL -> fresh.
  const counts = {};
  const fingerprintTree = (subdir, extRe) => {
    const root = join(DIST, 'assets', subdir);
    if (!existsSync(root)) return;
    let n = 0;
    const walk = (dir) => {
      for (const name of readdirSync(dir)) {
        const abs = join(dir, name);
        if (statSync(abs).isDirectory()) { walk(abs); continue; }
        if (!extRe.test(name)) continue;
        const bytes = readFileSync(abs);
        const hash = createHash('sha1').update(bytes).digest('hex').slice(0, 8);
        const dot = name.lastIndexOf('.');
        const hashedName = `${name.slice(0, dot)}.${hash}${name.slice(dot)}`;
        const hashedAbs = join(dir, hashedName);
        writeFileSync(hashedAbs, bytes);
        rmSync(abs);
        const canonRel = `assets/${subdir}/` + relative(root, abs).split('\\').join('/');
        const hashedRel = `assets/${subdir}/` + relative(root, hashedAbs).split('\\').join('/');
        manifest.set(canonRel, hashedRel);
        n++;
      }
    };
    walk(root);
    counts[subdir] = n;
  };
  fingerprintTree('img', /\.(jpe?g|png|webp|avif|gif|svg)$/i);
  fingerprintTree('js', /\.js$/i);
  fingerprintTree('css', /\.css$/i);
  // The campground dataset (assets/data/campgrounds.json) is large, immutable
  // per build, and referenced once (in campgrounds.html via #cg-data[data-src]).
  // Fingerprinting it makes it safe to cache forever AND fresh on every rebuild.
  fingerprintTree('data', /\.json$/i);
  log(`fingerprinted ${counts.img || 0} images, ${counts.js || 0} js, ${counts.css || 0} css, ${counts.data || 0} data`);

  // Rewrite every emitted HTML file's image references to the hashed names.
  // References appear as ".../assets/img/<...>" with varying relRoot prefixes
  // ('', '../'); match the canonical tail and swap to the hashed tail.
  const htmlFiles = [
    join(DIST, 'index.html'),
    join(DIST, 'explore.html'),
    join(DIST, 'compare.html'),
    join(DIST, 'campgrounds.html'),
    join(DIST, 'community.html'),
    join(DIST, 'credits.html'),
    ...families.map((f) => join(DIST, 'f', `${f.slug}.html`)),
    ...trailers.map((t) => join(DIST, 'm', `${t.slug}.html`)),
  ];
  let rewrites = 0;
  for (const file of htmlFiles) {
    if (!existsSync(file)) continue;
    let html = readFileSync(file, 'utf8');
    for (const [canon, hashed] of manifest) {
      // replace the canonical path wherever it appears (prefix-agnostic: the
      // 'assets/img/..' tail is identical regardless of '../' relRoot)
      if (html.includes(canon)) {
        html = html.split(canon).join(hashed);
        rewrites++;
      }
    }
    writeFileSync(file, html);
  }
  log(`rewrote image refs in HTML (${rewrites} path-substitutions)`);
}

// 7. GUARDRAIL: every <img src> emitted into dist must resolve to a real file
//    in dist. A missing file is what Cloudflare serves as fallback HTML and the
//    browser renders as a broken image — so we fail the build instead of shipping it.
{
  const pages = [
    { file: join(DIST, 'index.html'), base: DIST },
    { file: join(DIST, 'explore.html'), base: DIST },
    { file: join(DIST, 'compare.html'), base: DIST },
    { file: join(DIST, 'campgrounds.html'), base: DIST },
    { file: join(DIST, 'community.html'), base: DIST },
    { file: join(DIST, 'credits.html'), base: DIST },
    ...families.map((f) => ({ file: join(DIST, 'f', `${f.slug}.html`), base: join(DIST, 'f') })),
    ...trailers.map((t) => ({ file: join(DIST, 'm', `${t.slug}.html`), base: join(DIST, 'm') })),
  ];
  const broken = [];
  let checked = 0;
  for (const { file, base } of pages) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/<img[^>]*\ssrc="([^"]+)"/g)) {
      const ref = m[1];
      if (/^(https?:)?\/\//.test(ref) || ref.startsWith('data:')) continue; // external/data URIs
      checked++;
      // resolve ref relative to the page's directory, then check under dist
      const abs = join(base, ref);
      if (!existsSync(abs)) broken.push(`${file.replace(DIST + '/', '')} -> ${ref}`);
    }
  }
  if (broken.length) {
    throw new Error(
      `Image guardrail failed: ${broken.length} <img> reference(s) point at files missing from dist/:\n` +
      broken.map((b) => '  ' + b).join('\n'),
    );
  }
  log(`image guardrail ok: ${checked} <img> references all resolve on disk`);
}

// 8. CF Pages caching headers.
//    - Images/CSS/JS are content-fingerprinted (step 6), so they're safe to
//      cache forever as immutable.
//    - HTML is NOT fingerprinted (stable URLs users bookmark), so it must be
//      revalidated every time — otherwise a cached HTML page keeps pointing at
//      old hashed asset URLs and updates never appear. `no-cache` = always
//      revalidate with the CDN (cheap 304 when unchanged), never serve stale.
writeFileSync(join(DIST, '_headers'), `/assets/*
  Cache-Control: public, max-age=31536000, immutable
/*.html
  Cache-Control: public, no-cache, must-revalidate
/
  Cache-Control: public, no-cache, must-revalidate
`);

log('build complete →', DIST);
