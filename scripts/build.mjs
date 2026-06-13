#!/usr/bin/env node
// Build the static site into dist/. Zero dependencies — Node built-ins only.
// Pipeline: validate data -> render index + 59 detail pages -> copy assets.

import { mkdirSync, writeFileSync, rmSync, cpSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadTrailers, validateDataset, modelNames } from '../src/lib/data.mjs';
import { renderIndex, renderDetail } from '../src/lib/render.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');

function log(...a) { console.log('[build]', ...a); }

// 1. Load + validate (fail the build on any data problem)
const trailers = loadTrailers();
validateDataset(trailers);
log(`data ok: ${trailers.length} floorplans`);

// 2. Clean dist
rmSync(DIST, { recursive: true, force: true });
mkdirSync(join(DIST, 'm'), { recursive: true });

// 3. Index
writeFileSync(join(DIST, 'index.html'), renderIndex(trailers, modelNames(trailers)));
log('wrote index.html');

// 4. Detail pages
for (const t of trailers) {
  writeFileSync(join(DIST, 'm', `${t.slug}.html`), renderDetail(t));
}
log(`wrote ${trailers.length} detail pages`);

// 5. Static assets: CSS/JS from src, images from public
cpSync(join(ROOT, 'src', 'assets', 'css'), join(DIST, 'assets', 'css'), { recursive: true });
cpSync(join(ROOT, 'src', 'assets', 'js'), join(DIST, 'assets', 'js'), { recursive: true });
if (existsSync(join(ROOT, 'public', 'assets', 'img'))) {
  cpSync(join(ROOT, 'public', 'assets', 'img'), join(DIST, 'assets', 'img'), { recursive: true });
  const counts = ['thumbs', 'heroes', 'gallery'].map((d) => {
    const p = join(DIST, 'assets', 'img', d);
    return `${d}:${existsSync(p) ? readdirSync(p).length : 0}`;
  });
  log('copied images', counts.join(' '));
}

// 6. CF Pages niceties: SPA-style 404 + headers
writeFileSync(join(DIST, '_headers'), `/assets/*
  Cache-Control: public, max-age=31536000, immutable
/
  Cache-Control: public, max-age=3600
`);

log('build complete →', DIST);
