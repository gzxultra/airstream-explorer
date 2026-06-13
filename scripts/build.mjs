#!/usr/bin/env node
// Build the static site into dist/. Zero dependencies — Node built-ins only.
// Pipeline: validate data -> render index + 59 detail pages -> copy assets.

import { mkdirSync, writeFileSync, readFileSync, rmSync, cpSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadTrailers, validateDataset, groupByFamily, resolveAssets } from '../src/lib/data.mjs';
import { renderIndex, renderFamily, renderDetail, page } from '../src/lib/render.mjs';
import { loadCommunityPhotos, validateCommunity, renderCommunityBody, renderCreditsBody } from '../src/lib/community.mjs';

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
  writeFileSync(join(DIST, 'm', `${t.slug}.html`), renderDetail(t, resolve));
}
log(`wrote ${trailers.length} detail pages`);

// 4b. Community gallery + credits pages (root-level, so relRoot = '')
writeFileSync(
  join(DIST, 'community.html'),
  page({
    title: 'Airstream in the Wild — real community photos',
    description: 'Real, freely-licensed photographs of Airstream travel trailers from photographers via Wikimedia Commons, grouped by model and setting. Every photo credited.',
    body: renderCommunityBody(community, ''),
  }),
);
writeFileSync(
  join(DIST, 'credits.html'),
  page({
    title: 'Photo credits & licenses — Airstream Explorer',
    description: 'Full attribution for every community photograph: photographer, license, and original source.',
    body: renderCreditsBody(community, ''),
  }),
);
log('wrote community.html + credits.html');

// 5. Static assets: CSS/JS from src, images from public
cpSync(join(ROOT, 'src', 'assets', 'css'), join(DIST, 'assets', 'css'), { recursive: true });
cpSync(join(ROOT, 'src', 'assets', 'js'), join(DIST, 'assets', 'js'), { recursive: true });
if (existsSync(join(PUBLIC, 'assets', 'img'))) {
  cpSync(join(PUBLIC, 'assets', 'img'), join(DIST, 'assets', 'img'), { recursive: true });
  const counts = ['thumbs', 'heroes', 'gallery'].map((d) => {
    const p = join(DIST, 'assets', 'img', d);
    return `${d}:${existsSync(p) ? readdirSync(p).length : 0}`;
  });
  log('copied images', counts.join(' '));
}

// 6. GUARDRAIL: every <img src> emitted into dist must resolve to a real file
//    in dist. A missing file is what Cloudflare serves as fallback HTML and the
//    browser renders as a broken image — so we fail the build instead of shipping it.
{
  const pages = [
    { file: join(DIST, 'index.html'), base: DIST },
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

// 7. CF Pages niceties: SPA-style 404 + headers
writeFileSync(join(DIST, '_headers'), `/assets/*
  Cache-Control: public, max-age=31536000, immutable
/
  Cache-Control: public, max-age=3600
`);

log('build complete →', DIST);
