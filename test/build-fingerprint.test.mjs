// Regression guard for the cache trap that kept shipping stale JS/CSS:
// every cacheable asset (img/js/css) is served `immutable, max-age=1yr`, so its
// filename MUST be content-fingerprinted or returning visitors keep the old copy
// forever. This bug is exactly why removed 月供/finance code lingered for days.
// We run the real build into a temp dist and assert the emitted HTML references
// hashed asset names only — never a bare `assets/js/app.js` or `assets/css/site.css`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

// Build once (CI and local both have node + the build script).
execFileSync('node', ['scripts/build.mjs'], { cwd: ROOT, stdio: 'pipe' });

const htmlFiles = [];
const collect = (dir) => {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, name.name);
    if (name.isDirectory()) { if (name.name !== 'assets') collect(abs); }
    else if (name.name.endsWith('.html')) htmlFiles.push(abs);
  }
};
if (existsSync(DIST)) collect(DIST);

test('build emits at least the core HTML pages', () => {
  assert.ok(htmlFiles.length >= 60, `expected 60+ html pages, got ${htmlFiles.length}`);
});

test('no HTML references a bare (unhashed) app.js or site.css', () => {
  const offenders = [];
  for (const f of htmlFiles) {
    const html = readFileSync(f, 'utf8');
    if (/(href|src)="[^"]*assets\/(js\/app\.js|css\/site\.css)"/.test(html)) {
      offenders.push(f.replace(ROOT, ''));
    }
  }
  assert.equal(offenders.length, 0, `unhashed asset refs in: ${offenders.join(', ')}`);
});

test('referenced app.js / site.css carry an 8-hex content hash', () => {
  const home = readFileSync(join(DIST, 'index.html'), 'utf8');
  assert.match(home, /assets\/js\/app\.[0-9a-f]{8}\.js/, 'app.js must be fingerprinted');
  assert.match(home, /assets\/css\/site\.[0-9a-f]{8}\.css/, 'site.css must be fingerprinted');
});

test('every hashed asset the homepage references exists on disk', () => {
  const home = readFileSync(join(DIST, 'index.html'), 'utf8');
  for (const m of home.matchAll(/(?:href|src)="((?:\.\.\/)*assets\/(?:js|css)\/[^"]+)"/g)) {
    const rel = m[1].replace(/^(\.\.\/)+/, '');
    assert.ok(existsSync(join(DIST, rel)), `missing built asset: ${rel}`);
  }
});

// --- Unified Explore: built-output checks -----------------------------------
test('index.html ships the unified grid (motorhome cards + type control + 16 families)', () => {
  const home = readFileSync(join(DIST, 'index.html'), 'utf8');
  assert.ok((home.match(/data-type="motorhome"/g) || []).length > 0, 'motorhome cards in grid');
  assert.match(home, /href="mm\//, 'an mm/ detail link in the grid');
  assert.match(home, /id="x-type"/, 'type segmented control present');
  assert.equal((home.match(/class="fam"/g) || []).length, 16, '16 unified family cards');
});

test('motorhomes.html still resolves as a unified entry: redirect shim + no-JS fallback', () => {
  const p = join(DIST, 'motorhomes.html');
  assert.ok(existsSync(p), 'motorhomes.html exists');
  const html = readFileSync(p, 'utf8');
  // JS redirect into the unified hub, pre-filtered to motorhomes
  assert.match(html, /data-redirect="index\.html#all&type=motorhome"/);
  // no-JS fallback still renders the full motorhome catalog inline
  assert.match(html, /id="xgrid"/);
  assert.ok((html.match(/data-type="motorhome"/g) || []).length > 0, 'fallback motorhome cards');
});

test('built app.js hides the tow matcher for the motorhome type', () => {
  // find the fingerprinted app.*.js the homepage references
  const home = readFileSync(join(DIST, 'index.html'), 'utf8');
  const m = home.match(/assets\/js\/(app\.[0-9a-f]{8}\.js)/);
  assert.ok(m, 'homepage references a fingerprinted app.js');
  const js = readFileSync(join(DIST, 'assets', 'js', m[1]), 'utf8');
  // the type-conditional tow logic shipped (motorhomes are driven, not towed)
  assert.match(js, /state\.type\s*!==\s*'motorhome'/);
  assert.match(js, /towTool/);
});

// --- SEO + PWA infrastructure: built-output checks --------------------------
// Guards the crawl/icon/install scaffolding added in the standards-raise pass:
// a 90+ page public reference site must ship robots.txt, a sitemap, a real
// favicon set, a web manifest and a branded 404 — and the sitemap must list
// the homepage as a clean root URL while excluding noindex stubs.
test('root brand + crawl files are all emitted (icons, manifest, robots, sitemap, 404)', () => {
  for (const f of [
    'favicon.svg', 'favicon.ico', 'apple-touch-icon.png',
    'icon-192.png', 'icon-512.png', 'site.webmanifest',
    'robots.txt', 'sitemap.xml', '404.html',
  ]) {
    assert.ok(existsSync(join(DIST, f)), `missing root file: ${f}`);
  }
});

test('site.webmanifest is valid JSON with name, theme + 192/512 icons', () => {
  const m = JSON.parse(readFileSync(join(DIST, 'site.webmanifest'), 'utf8'));
  assert.equal(m.name, 'Airstream Explorer');
  assert.equal(m.theme_color, '#1F1B16');
  const sizes = m.icons.map((i) => i.sizes);
  assert.ok(sizes.includes('192x192'), 'has 192 icon');
  assert.ok(sizes.includes('512x512'), 'has 512 icon');
  // every referenced icon file must exist on disk
  for (const ic of m.icons) {
    assert.ok(existsSync(join(DIST, ic.src.replace(/^\//, ''))), `manifest icon missing: ${ic.src}`);
  }
});

test('robots.txt allows crawling and points at the sitemap', () => {
  const r = readFileSync(join(DIST, 'robots.txt'), 'utf8');
  assert.match(r, /User-agent:\s*\*/);
  assert.match(r, /Allow:\s*\//);
  assert.match(r, /Sitemap:\s*https:\/\/[^\s]+\/sitemap\.xml/);
});

test('sitemap.xml lists the homepage as a clean root URL and excludes noindex stubs', () => {
  const s = readFileSync(join(DIST, 'sitemap.xml'), 'utf8');
  const locs = [...s.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.ok(locs.length >= 90, `expected 90+ urls, got ${locs.length}`);
  // homepage is the bare origin (matches the <link rel=canonical> on index)
  assert.ok(locs.some((u) => /\/$/.test(u) && !/\/[a-z0-9-]+\.html\/$/.test(u)), 'homepage as root URL');
  // noindex stubs must NOT be advertised
  assert.ok(!locs.some((u) => u.endsWith('/stays.html')), 'stays.html excluded');
  assert.ok(!locs.some((u) => u.endsWith('/404.html')), '404.html excluded');
  // balanced + well-formed
  assert.equal((s.match(/<url>/g) || []).length, (s.match(/<\/url>/g) || []).length, 'balanced <url>');
});

test('404.html is a branded, navigable, noindex page (full chrome + hashed assets)', () => {
  const html = readFileSync(join(DIST, '404.html'), 'utf8');
  assert.match(html, /name="robots" content="noindex/, '404 is noindex');
  assert.match(html, /class="topnav"/, '404 has site nav');
  assert.match(html, /class="site-footer"/, '404 has footer');
  assert.equal((html.match(/<h1\b/g) || []).length, 1, '404 has a single H1');
  // must reference hashed assets (it's written before the fingerprint rewrite)
  assert.match(html, /assets\/css\/site\.[0-9a-f]{8}\.css/, '404 uses hashed site.css');
  assert.ok(!/assets\/js\/app\.js"/.test(html), '404 must not use a bare app.js');
});

test('LCP heroes carry fetchpriority="high" (home, family, detail)', () => {
  const home = readFileSync(join(DIST, 'index.html'), 'utf8');
  assert.match(home, /home-hero-img[^>]*fetchpriority="high"/, 'home hero prioritized');
  // a trailer detail + family page
  const detailFile = readdirSync(join(DIST, 'm')).find((f) => f.endsWith('.html'));
  const detail = readFileSync(join(DIST, 'm', detailFile), 'utf8');
  assert.match(detail, /detail-hero-img[^>]*fetchpriority="high"/, 'detail hero prioritized');
  const famFile = readdirSync(join(DIST, 'f')).find((f) => f.endsWith('.html'));
  const fam = readFileSync(join(DIST, 'f', famFile), 'utf8');
  assert.match(fam, /fam-hero-img[^>]*fetchpriority="high"/, 'family hero prioritized');
});
