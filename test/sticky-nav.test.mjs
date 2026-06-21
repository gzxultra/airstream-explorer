// Guards the sticky top-nav UX shipped 2026-06-20. The nav must (1) be a
// position:sticky frosted bar pinned to top:0 so the tabs stay reachable on
// the very long detail (~8000px) and mobile campsites (~88000px) pages, and
// (2) keep a --nav-h custom property that other sticky elements (the filter
// .controls bar, the campground map) offset against, so nothing pins BEHIND
// the nav. A regression here silently breaks navigation on every page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(join(__dirname, '..', 'src', 'assets', 'css', 'site.css'), 'utf8');
const APP = readFileSync(join(__dirname, '..', 'src', 'assets', 'js', 'app.js'), 'utf8');

// Pull the .topnav rule body (first declaration block after the selector).
function ruleBody(css, selector) {
  const i = css.indexOf(selector + ' {');
  assert.ok(i !== -1, `selector "${selector}" not found in site.css`);
  const open = css.indexOf('{', i);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

test('top nav is a sticky bar pinned to the top', () => {
  const body = ruleBody(CSS, '.topnav');
  assert.match(body, /position:\s*sticky/, '.topnav must be position:sticky');
  assert.match(body, /top:\s*0/, '.topnav must pin to top:0');
  assert.match(body, /z-index:\s*\d+/, '.topnav needs a stacking context');
});

test('--nav-h is defined and consumed by dependent sticky elements', () => {
  // Defined on :root so JS can keep it equal to the real bar height.
  assert.match(CSS, /--nav-h:\s*\d+px/, ':root must define a --nav-h fallback');
  // The filter controls bar must offset BELOW the nav, not pin at top:0.
  const controls = ruleBody(CSS, '.controls');
  assert.match(controls, /top:\s*var\(--nav-h\)/, '.controls must pin at top:var(--nav-h)');
  // Anchor jumps must clear the sticky bar.
  assert.match(CSS, /scroll-padding-top:\s*calc\(var\(--nav-h\)/, 'html needs scroll-padding-top using --nav-h');
});

test('mobile nav is a single-line, non-wrapping tab strip (no wrap-jump)', () => {
  // The whole point of the mobile treatment: the tab row never wraps to a
  // second line, so page-to-page nav height stays constant. It scrolls
  // horizontally instead. Locate the mobile-scoped .topnav-links rule.
  const mq = CSS.indexOf('@media (max-width: 560px)', CSS.indexOf('.topnav {'));
  const linksIdx = CSS.indexOf('.topnav-links {', mq);
  assert.ok(linksIdx !== -1, 'mobile .topnav-links rule not found');
  const block = CSS.slice(linksIdx, CSS.indexOf('}', linksIdx));
  assert.match(block, /flex-wrap:\s*nowrap/, 'mobile .topnav-links must be flex-wrap:nowrap');
  assert.match(block, /overflow-x:\s*auto/, 'mobile .topnav-links must scroll horizontally');
});

test('app.js wires the sticky-nav module (measure + is-stuck)', () => {
  assert.match(APP, /\.topnav/, 'app.js must reference .topnav');
  assert.match(APP, /--nav-h/, 'app.js must keep --nav-h in sync with real height');
  assert.match(APP, /is-stuck/, 'app.js must toggle .is-stuck on scroll');
});
