// Feature-lock tests for the 2026-06-21 theme + lightbox + instant-nav pass.
//
// These guard four upgrades so a future render/CSS/JS edit can't silently
// regress them:
//   1. Dark mode      — no-flash <head> script, nav toggle, themed palette.
//   2. Gallery lightbox — every gallery cell is an interactive button wired to
//                         the shared #lightbox overlay (keyboard/swipe in JS).
//   3. View transitions — the @view-transition opt-in rule is present.
//   4. Both renderers (trailer + motorhome) ship all of the above identically.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadTrailers } from '../src/lib/data.mjs';
import { renderDetail, page } from '../src/lib/render.mjs';
import { loadMotorhomes } from '../src/lib/motorhome-data.mjs';
import { renderMotorhomeDetail } from '../src/lib/motorhome-render.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const themeCss = readFileSync(join(root, 'src/assets/css/theme.css'), 'utf8');
const appJs = readFileSync(join(root, 'src/assets/js/app.js'), 'utf8');

const trailers = loadTrailers();
const motorhomes = loadMotorhomes();
const classic = trailers.find((t) => t.slug === 'classic-33fb-2026');
const atlas = motorhomes.find((m) => m.slug === 'atlas-25ms-2027') || motorhomes[0];

// --------------------------------------------------------------------------
// 1. DARK MODE
// --------------------------------------------------------------------------
test('page shell ships the no-flash theme script before the stylesheets', () => {
  const html = page({ title: 'T', description: 'D', body: '<p>x</p>' });
  // The inline script must (a) exist, (b) read ae:theme, (c) come BEFORE the
  // first stylesheet link so the theme is set before first paint.
  assert.match(html, /localStorage\.getItem\('ae:theme'\)/);
  assert.match(html, /prefers-color-scheme: dark/);
  const scriptIdx = html.indexOf("ae:theme");
  const cssIdx = html.indexOf('assets/css/');
  assert.ok(scriptIdx > -1 && cssIdx > -1 && scriptIdx < cssIdx,
    'no-flash theme script must precede the CSS links');
});

test('both detail renderers include the theme toggle button + theme.css link', () => {
  for (const [label, html] of [['trailer', renderDetail(classic)], ['motorhome', renderMotorhomeDetail(atlas)]]) {
    assert.match(html, /id="theme-toggle"/, `${label} missing theme toggle`);
    assert.match(html, /class="theme-icon-sun"/, `${label} missing sun icon`);
    assert.match(html, /class="theme-icon-moon"/, `${label} missing moon icon`);
    assert.match(html, /assets\/css\/theme\.css/, `${label} missing theme.css link`);
    assert.match(html, /<script>\(function\(\)\{try\{var t=localStorage\.getItem\('ae:theme'\)/, `${label} missing no-flash script`);
  }
});

test('theme.css defines a dark palette overriding the core semantic vars', () => {
  assert.match(themeCss, /\[data-theme="dark"\]\s*\{/);
  for (const v of ['--bg:', '--surface:', '--card:', '--ink:', '--muted:', '--line:', '--copper:']) {
    // each must be re-declared inside a dark scope somewhere in the file
    const re = new RegExp(`\\[data-theme="dark"\\][\\s\\S]*?${v.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}`);
    assert.match(themeCss, re, `dark theme missing override for ${v}`);
  }
  assert.match(themeCss, /color-scheme: dark/);
});

test('app.js theme module stores the choice as a RAW string (no-flash script reads it raw)', () => {
  // The <head> script compares the raw localStorage value to 'dark'/'light';
  // if the toggle JSON-encoded it the next load would not match. Lock the raw
  // setItem so the two stay in sync.
  assert.match(appJs, /localStorage\.setItem\('ae:theme', next\)/);
  assert.ok(!/Store\.set\('theme'/.test(appJs),
    'theme must be persisted raw, not through the JSON Store wrapper');
});

// --------------------------------------------------------------------------
// 2. GALLERY LIGHTBOX
// --------------------------------------------------------------------------
test('both detail renderers emit a shared #lightbox overlay with controls', () => {
  for (const [label, html] of [['trailer', renderDetail(classic)], ['motorhome', renderMotorhomeDetail(atlas)]]) {
    assert.match(html, /<div class="lightbox" id="lightbox" hidden/, `${label} missing lightbox container`);
    assert.match(html, /id="lightbox-img"/, `${label} missing lightbox image`);
    assert.match(html, /id="lightbox-caption"/, `${label} missing lightbox caption`);
    assert.match(html, /data-lb-prev/, `${label} missing prev control`);
    assert.match(html, /data-lb-next/, `${label} missing next control`);
    assert.match(html, /data-lb-close/, `${label} missing close control`);
  }
});

test('gallery cells are interactive buttons wired to the lightbox', () => {
  const html = renderDetail(classic);
  // The grid is marked for grouping and each cell is a <button data-lightbox>.
  assert.match(html, /class="gallery-grid" data-gallery/);
  assert.match(html, /<button type="button" class="gallery-img-wrap[^"]*" data-lightbox data-full="[^"]+" data-index="0"/);
  assert.match(html, /data-caption="[^"]*photo 1 of \d+"/);
  // The zoom affordance + accessible label must be present.
  assert.match(html, /class="gallery-zoom"/);
  assert.match(html, /aria-label="Open photo 1 of \d+ full screen"/);
});

test('motorhome gallery cells are also interactive buttons', () => {
  const html = renderMotorhomeDetail(atlas);
  assert.match(html, /class="gallery-grid" data-gallery/);
  assert.match(html, /<button type="button" class="gallery-img-wrap[^"]*" data-lightbox/);
});

test('lightbox JS module wires keyboard, swipe, and focus handling', () => {
  // Guard the behaviors users rely on; cheap structural checks, not execution.
  assert.match(appJs, /getElementById\('lightbox'\)/);
  assert.match(appJs, /e\.key === 'Escape'/);
  assert.match(appJs, /e\.key === 'ArrowRight'/);
  assert.match(appJs, /e\.key === 'ArrowLeft'/);
  assert.match(appJs, /touchstart/);
  assert.match(appJs, /touchend/);
});

test('lightbox + gallery-button styling present in theme.css', () => {
  assert.match(themeCss, /button\.gallery-img-wrap\s*\{/);
  assert.match(themeCss, /\.lightbox\s*\{/);
  assert.match(themeCss, /\.lightbox\.is-single \.lightbox-nav \{ display: none; \}/);
});

// --------------------------------------------------------------------------
// 3. VIEW TRANSITIONS + INSTANT NAV
// --------------------------------------------------------------------------
test('theme.css opts into cross-document view transitions', () => {
  assert.match(themeCss, /@view-transition\s*\{\s*navigation: auto;\s*\}/);
});

test('instant-nav prefetch module is present and data-saver aware', () => {
  assert.match(appJs, /rel = 'prefetch'/);
  assert.match(appJs, /saveData/);
});
