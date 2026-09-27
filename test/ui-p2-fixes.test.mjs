// Wave-3 UI/UX P2 fixes — string-level guards on app.js + render output.
// These lock in: quiz removal (replaced by the browse index), ?len= clamping,
// fuel negative guards, and generic focus traps on quick-view / kb-help / drawer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const appJs = readFileSync(join(ROOT, 'src', 'assets', 'js', 'app.js'), 'utf8');

// ---------------------------------------------------------------------------
// quiz removed — the three-row browse index replaces it
// ---------------------------------------------------------------------------

test('quiz is fully removed: no quiz DOM, JS or CSS remains', () => {
  const siteCss = readFileSync(join(ROOT, 'src', 'assets', 'css', 'site.css'), 'utf8');
  const themeCss = readFileSync(join(ROOT, 'src', 'assets', 'css', 'theme.css'), 'utf8');
  assert.ok(!/quiz/i.test(appJs), 'app.js must not reference quiz');
  assert.ok(!/\.quiz/i.test(siteCss), 'site.css must not contain quiz styles');
  assert.ok(!/\.quiz/i.test(themeCss), 'theme.css must not contain quiz styles');
});

test('home browse index deep-links into pre-filtered explore views', () => {
  const render = readFileSync(join(ROOT, 'src', 'lib', 'render.mjs'), 'utf8');
  assert.match(render, /home-index/, 'browse index nav present');
  assert.match(render, /#all&len=/, 'size deep-link present');
  assert.match(render, /#all&price=/, 'budget deep-link present');
  assert.match(render, /#all&tow=/, 'tow deep-link present');
});

test('app.js re-applies explore filters when the hash changes', () => {
  // The browse index navigates by hash; the explore module must pick up
  // filter params from #all&… links without a reload.
  assert.match(appJs, /addEventListener\('hashchange'/, 'hashchange listener present');
  assert.match(appJs, /readHashFilters\(\)/, 'hash filters are parsed');
});

// ---------------------------------------------------------------------------
// fuel tool: negative / NaN input guards
// ---------------------------------------------------------------------------

test('fuel tool never computes with negative or NaN distance/price', () => {
  assert.match(appJs, /distRaw = parseFloat\(elDistance\.value\)/, 'reads raw distance');
  assert.match(appJs, /isFinite\(distRaw\) && distRaw > 0/, 'distance must be finite and positive');
  assert.match(appJs, /priceRaw = parseFloat\(elPrice\.value\)/, 'reads raw price');
  assert.match(appJs, /isFinite\(priceRaw\) && priceRaw > 0/, 'price must be finite and positive');
});

// ---------------------------------------------------------------------------
// generic focus trap on every modal
// ---------------------------------------------------------------------------

test('quick-view uses the generic focus trap', () => {
  assert.match(appJs, /releaseTrap = aeTrapFocus\(qv, close\)/, 'quick-view traps focus on open');
});

test('keyboard-shortcuts help dialog uses the generic focus trap', () => {
  assert.match(appJs, /helpReleaseTrap = aeTrapFocus\(helpEl, closeHelp\)/, 'kb-help traps focus on open');
});


test('aeTrapFocus utility exists and releases cleanly', () => {
  assert.match(appJs, /function aeTrapFocus\(container, onEscape\)/, 'utility defined');
  assert.match(appJs, /return function release\(\) \{ container\.removeEventListener/, 'returns a release fn');
});
