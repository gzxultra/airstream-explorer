// test/quiz-weightbar.test.mjs — tests for the lifestyle quiz overlay,
// weight-bar animation hooks, and gallery hover zoom.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// ── HTML output helpers ──────────────────────────────────────────────────
function readBuiltIndex() {
  const p = join(root, 'dist', 'index.html');
  if (!existsSync(p)) throw new Error('dist/index.html missing — run build first');
  return readFileSync(p, 'utf8');
}
function readBuiltDetail() {
  // Pick any 2026 detail page
  const p = join(root, 'dist', 'm', 'bambi-16rb-2026.html');
  if (!existsSync(p)) throw new Error('detail page missing');
  return readFileSync(p, 'utf8');
}

// ── Quiz overlay ─────────────────────────────────────────────────────────
test('homepage has quiz overlay with 4 steps + results', () => {
  const html = readBuiltIndex();
  assert.ok(html.includes('id="quiz"'), 'quiz overlay exists');
  assert.ok(html.includes('data-step="1"'), 'step 1 present');
  assert.ok(html.includes('data-step="2"'), 'step 2 present');
  assert.ok(html.includes('data-step="3"'), 'step 3 present');
  assert.ok(html.includes('data-step="4"'), 'step 4 present');
  assert.ok(html.includes('data-step="results"'), 'results step present');
});

test('quiz has "Find your Airstream" trigger button', () => {
  const html = readBuiltIndex();
  assert.ok(html.includes('id="quiz-open"'), 'quiz open button exists');
  assert.ok(html.includes('Find your Airstream'), 'button text present');
});

test('quiz step 1 has group-size options', () => {
  const html = readBuiltIndex();
  assert.ok(html.includes('data-key="group" data-val="solo"'), 'solo option');
  assert.ok(html.includes('data-key="group" data-val="small"'), 'small option');
  assert.ok(html.includes('data-key="group" data-val="large"'), 'large option');
});

test('quiz step 2 has budget options', () => {
  const html = readBuiltIndex();
  assert.ok(html.includes('data-key="budget" data-val="80000"'), '$80k option');
  assert.ok(html.includes('data-key="budget" data-val="120000"'), '$120k option');
  assert.ok(html.includes('data-key="budget" data-val="180000"'), '$180k option');
  assert.ok(html.includes('data-key="budget" data-val="999999"'), '$180k+ option');
});

test('quiz step 3 has travel style options', () => {
  const html = readBuiltIndex();
  assert.ok(html.includes('data-key="style" data-val="weekend"'), 'weekend');
  assert.ok(html.includes('data-key="style" data-val="extended"'), 'extended');
  assert.ok(html.includes('data-key="style" data-val="offgrid"'), 'offgrid');
  assert.ok(html.includes('data-key="style" data-val="fulltime"'), 'fulltime');
});

test('quiz step 4 has priority options', () => {
  const html = readBuiltIndex();
  assert.ok(html.includes('data-key="priority" data-val="tow"'), 'tow');
  assert.ok(html.includes('data-key="priority" data-val="space"'), 'space');
  assert.ok(html.includes('data-key="priority" data-val="offgrid"'), 'offgrid priority');
  assert.ok(html.includes('data-key="priority" data-val="value"'), 'value');
});

test('quiz overlay has proper ARIA attributes', () => {
  const html = readBuiltIndex();
  assert.ok(html.includes('role="dialog"'), 'dialog role');
  assert.ok(html.includes('aria-modal="true"'), 'aria-modal');
  assert.ok(html.includes('aria-label="Find your Airstream"'), 'aria-label');
});

test('quiz has back button, restart, and explore actions', () => {
  const html = readBuiltIndex();
  assert.ok(html.includes('id="quiz-back"'), 'back button');
  assert.ok(html.includes('id="quiz-restart"'), 'restart button');
  assert.ok(html.includes('id="quiz-explore"'), 'explore button');
});

test('quiz progress bar exists', () => {
  const html = readBuiltIndex();
  assert.ok(html.includes('id="quiz-progress"'), 'progress container');
  assert.ok(html.includes('id="quiz-fill"'), 'progress fill');
});

// ── Weight bar animation ─────────────────────────────────────────────────
test('detail page has weight-bar with dry and ccc segments', () => {
  const html = readBuiltDetail();
  assert.ok(html.includes('class="weight-bar"'), 'weight-bar exists');
  assert.ok(html.includes('weight-bar-dry'), 'dry segment');
  assert.ok(html.includes('weight-bar-ccc'), 'CCC segment');
});

// ── Gallery hover zoom ──────────────────────────────────────────────────
test('gallery images have zoom SVG icon for hover reveal', () => {
  const html = readBuiltDetail();
  assert.ok(html.includes('gallery-zoom'), 'zoom icon present in gallery buttons');
});

// ── CSS integration ──────────────────────────────────────────────────────
test('site.css includes quiz styles', () => {
  const css = readFileSync(join(root, 'src', 'assets', 'css', 'site.css'), 'utf8');
  assert.ok(css.includes('.quiz-overlay'), 'quiz-overlay rule');
  assert.ok(css.includes('.quiz-panel'), 'quiz-panel rule');
  assert.ok(css.includes('.quiz-opt'), 'quiz-opt rule');
  assert.ok(css.includes('.quiz-match'), 'quiz-match rule');
  assert.ok(css.includes('.gallery-hoverable'), 'gallery-hoverable rule');
  assert.ok(css.includes('quizFadeIn'), 'quiz animation keyframes');
});

test('theme.css includes quiz dark overrides', () => {
  const css = readFileSync(join(root, 'src', 'assets', 'css', 'theme.css'), 'utf8');
  assert.ok(css.includes('[data-theme="dark"] .quiz-panel'), 'dark quiz panel');
  assert.ok(css.includes('[data-theme="dark"] .quiz-opt'), 'dark quiz options');
  assert.ok(css.includes('[data-theme="dark"] .quiz-match'), 'dark quiz matches');
});

// ── JS integration ───────────────────────────────────────────────────────
test('app.js includes quiz module', () => {
  const js = readFileSync(join(root, 'src', 'assets', 'js', 'app.js'), 'utf8');
  assert.ok(js.includes('lifestyleQuiz'), 'quiz IIFE present');
  assert.ok(js.includes('scoreTrailers'), 'scoring function present');
  assert.ok(js.includes('weightBarAnim'), 'weight bar animation present');
  assert.ok(js.includes('galleryHoverZoom'), 'gallery hover zoom present');
});
