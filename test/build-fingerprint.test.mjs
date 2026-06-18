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
