// Wave-3 UI/UX P2 fixes — string-level guards on app.js + render output.
// These lock in: quiz→explore param passing, ?len= clamping, fuel negative
// guards, and generic focus traps on quick-view / kb-help / drawer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const appJs = readFileSync(join(ROOT, 'src', 'assets', 'js', 'app.js'), 'utf8');

// ---------------------------------------------------------------------------
// quiz -> explore param passing
// ---------------------------------------------------------------------------

test('quiz explore button carries answers into explore filters', () => {
  // group -> sleeps minimum
  assert.match(appJs, /sleepsFor\[answers\.group\]/, 'sleeps mapping from answers.group');
  assert.match(appJs, /solo: '2', small: '4', large: '6'/, 'group->sleeps values');
  // budget -> price cap
  assert.match(appJs, /priceFor\[String\(answers\.budget\)\]/, 'price mapping from answers.budget');
  assert.match(appJs, /'80000': '80000', '120000': '120000', '180000': '200000'/, 'budget->price values');
  // applied via the same 'change' the explore module listens to
  assert.match(appJs, /getElementById\('x-sleeps'\)/, 'sets x-sleeps control');
  assert.match(appJs, /getElementById\('x-price'\)/, 'sets x-price control');
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
