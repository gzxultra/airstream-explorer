// Feature-lock tests for the 2026-06-21 "Saved floorplans" pass.
//
// Saved is a site-wide shortlist that completes the browse → save → compare →
// decide journey. Compare caps at 3 same-type picks; Saved has no cap and spans
// trailers + motorhomes, persisted in localStorage (ae:saved). These guards
// stop a future render/CSS/JS edit from silently regressing it:
//   1. saveButton markup — heart toggle on every explore card + detail head,
//      both renderers (trailer + motorhome), carrying data-save/slug/type.
//   2. Nav — a Saved tab with a live count badge slot, on every page shell.
//   3. renderSaved page — embeds the full catalog island keyed by slug, has the
//      grid/toolbar/empty-state scaffolding, and is CSP-safe (escaped </).
//   4. Client wiring — app.js has the Saved store, global save-button handler,
//      nav-badge painter, and the Saved page renderer.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadTrailers } from '../src/lib/data.mjs';
import { renderDetail, renderExploreCard, renderIndex, page } from '../src/lib/render.mjs';
import { groupByFamily } from '../src/lib/data.mjs';
import { loadMotorhomes } from '../src/lib/motorhome-data.mjs';
import { renderMotorhomeDetail, renderMotorhomeExploreCard } from '../src/lib/motorhome-render.mjs';
import { saveButton } from '../src/lib/format.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const appJs = readFileSync(join(ROOT, 'src/assets/js/app.js'), 'utf8');
const siteCss = readFileSync(join(ROOT, 'src/assets/css/site.css'), 'utf8');
const themeCss = readFileSync(join(ROOT, 'src/assets/css/theme.css'), 'utf8');

const trailers = loadTrailers();
const motorhomes = loadMotorhomes();
const classic = trailers.find((t) => t.slug === 'classic-33fb-2026');
const atlas = motorhomes.find((m) => m.slug === 'atlas-25ms-2027');

// ---- 1. saveButton helper -------------------------------------------------
test('saveButton emits a data-save toggle with slug/type/aria', () => {
  const html = saveButton('classic-33fb-2026', 'trailer', 'Classic 33FB', 'card');
  assert.match(html, /data-save/);
  assert.match(html, /data-slug="classic-33fb-2026"/);
  assert.match(html, /data-type="trailer"/);
  assert.match(html, /aria-pressed="false"/);
  assert.match(html, /aria-label="Save Classic 33FB"/);
  assert.match(html, /save-btn--card/);
  // card variant is icon-only (no visible text label)
  assert.doesNotMatch(html, /save-btn-text/);
});

test('saveButton detail variant carries a visible Save label', () => {
  const html = saveButton('atlas-25ms-2027', 'motorhome', 'Atlas 25MS', 'detail');
  assert.match(html, /save-btn--detail/);
  assert.match(html, /<span class="save-btn-text">Save<\/span>/);
  assert.match(html, /data-type="motorhome"/);
});

test('saveButton escapes its label', () => {
  const html = saveButton('x', 'trailer', 'A "B" & <C>', 'card');
  assert.match(html, /aria-label="Save A &quot;B&quot; &amp; &lt;C&gt;"/);
});

// ---- 2. cards carry a save button (both renderers) ------------------------
test('trailer explore card has a save button next to Compare', () => {
  const html = renderExploreCard(classic);
  assert.match(html, /class="xcard-foot-actions"/);
  assert.match(html, /data-save[^>]*data-slug="classic-33fb-2026"[^>]*data-type="trailer"/);
  assert.match(html, /class="cmp-box"/); // compare still present
});

test('motorhome explore card has a save button next to Compare', () => {
  const html = renderMotorhomeExploreCard(atlas);
  assert.match(html, /class="xcard-foot-actions"/);
  assert.match(html, /data-save[^>]*data-slug="atlas-25ms-2027"[^>]*data-type="motorhome"/);
});

// ---- detail pages carry a save button beside the H1 -----------------------
test('trailer detail head has the save button on the title row', () => {
  const html = renderDetail(classic);
  assert.match(html, /class="detail-head-row"/);
  const row = html.match(/<div class="detail-head-row">([\s\S]*?)<\/div>/);
  assert.ok(row, 'detail-head-row present');
  assert.match(row[1], /<h1>/);
  assert.match(row[1], /data-save[^>]*data-slug="classic-33fb-2026"/);
  assert.match(row[1], /save-btn--detail/);
});

test('motorhome detail head has the save button on the title row', () => {
  const html = renderMotorhomeDetail(atlas);
  assert.match(html, /class="detail-head-row"/);
  const row = html.match(/<div class="detail-head-row">([\s\S]*?)<\/div>/);
  assert.ok(row, 'detail-head-row present');
  assert.match(row[1], /data-save[^>]*data-slug="atlas-25ms-2027"[^>]*data-type="motorhome"/);
});

// ---- 3. nav: Saved tab REMOVED by the 2026-09 redesign ----------------------
// The Saved tab is gone (save buttons feed the compare tray; the saved page
// itself is deleted). The shell must not link to saved.html anywhere in nav.
test('page shell has NO Saved nav tab (redesign: tab deleted)', () => {
  const shell = page({ title: 't', description: 'd', body: '<main></main>' });
  const nav = shell.match(/<nav class="topnav-links"[^>]*>([\s\S]*?)<\/nav>/);
  assert.ok(nav, 'has a topnav-links nav');
  assert.doesNotMatch(nav[1], /saved\.html/);
  assert.doesNotMatch(nav[1], /nav-saved-count/);
  assert.doesNotMatch(nav[1], /data-nav-saved/);
});

// ---- 3b. the dedicated saved.html page is retired --------------------------
// The save/shortlist FEATURE survives (sections 1, 2, 4, 5 above). Only the
// standalone saved.html page + its renderSaved renderer are gone.
test('renderSaved is no longer exported (saved page retired)', async () => {
  const mod = await import('../src/lib/render.mjs');
  assert.ok(!('renderSaved' in mod), 'renderSaved must not be exported');
});

test('build.mjs does not generate saved.html', () => {
  const build = readFileSync(join(ROOT, 'scripts', 'build.mjs'), 'utf8');
  assert.ok(!/saved\.html/.test(build.replace(/saved\.html retired/g, '')),
    'build must not write a saved.html page');
});

// ---- 4. client wiring in app.js -------------------------------------------
test('app.js defines the Saved store with the expected API', () => {
  assert.match(appJs, /var Saved = \(function \(\) \{/);
  // keyed under ae:saved
  assert.match(appJs, /var KEY = 'saved';/);
  for (const fn of ['has', 'add', 'remove', 'toggle', 'clear', 'count', 'onChange']) {
    assert.match(appJs, new RegExp(`${fn}:`), `Saved exposes ${fn}`);
  }
  // cross-tab sync
  assert.match(appJs, /addEventListener\('storage'/);
});

test('app.js wires every save button + nav badge globally', () => {
  assert.match(appJs, /querySelectorAll\('\.save-btn'\)/);
  assert.match(appJs, /getElementById\('nav-saved-count'\)/);
  // save click must never navigate (buttons sit inside/over an <a>)
  assert.match(appJs, /e\.preventDefault\(\); e\.stopPropagation\(\);/);
});

test('app.js has the Saved page renderer reading the island', () => {
  assert.match(appJs, /getElementById\('saved-grid'\)/);
  assert.match(appJs, /getElementById\('saved-data'\)/);
  // dominant-type compare deep-link
  assert.match(appJs, /compare\.html\?ids=/);
});

// ---- 5. styling present (light + dark) ------------------------------------
test('site.css styles the save button (Saved page + nav tab deleted 2026-09)', () => {
  assert.match(siteCss, /\.save-btn \{/);
  assert.match(siteCss, /\.save-btn\.is-saved/);
  assert.doesNotMatch(siteCss, /\.saved-grid \{/);
  assert.doesNotMatch(siteCss, /\.nav-badge \{/);
});

test('theme.css gives the save button dark-mode treatment (Saved page deleted 2026-09)', () => {
  assert.doesNotMatch(themeCss, /\[data-theme="dark"\] \.saved-card-media/);
  assert.match(themeCss, /\[data-theme="dark"\] \.save-btn\.is-saved/);
});
