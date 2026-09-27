// WCAG CONTRAST GUARD (T-2 / QW-5 E5)
// ----------------------------------------------------------------------------
// The brand copper (--copper #B05C32) is only ~4.15:1 on the page background,
// which FAILS WCAG 2.1 AA for normal-size text (needs 4.5:1). It's fine for
// borders, fills, accent-colors, and large (≥24px) icons (3:1 bar). So small
// foreground TEXT must use --copper-text instead, which is tuned to pass AA.
//
// This test (1) reads the real token hex values out of site.css, (2) computes
// the true WCAG contrast ratios, and (3) asserts the canonical small-text label
// (.eyebrow) does NOT use bare --copper. If anyone repoints .eyebrow back to
// --copper or darkens the background below the AA line, this fails.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(__dirname, '..', 'src', 'assets', 'css', 'site.css'), 'utf8');

// ---- pull a custom-property hex value out of :root ------------------------
function token(name) {
  const m = css.match(new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})`));
  assert.ok(m, `token ${name} must be defined as a 6-digit hex`);
  return m[1];
}

// ---- WCAG relative luminance + contrast ratio -----------------------------
function luminance(hex) {
  const ch = hex.replace('#', '').match(/../g).map((h) => {
    const v = parseInt(h, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
function ratio(a, b) {
  const L1 = luminance(a), L2 = luminance(b);
  const hi = Math.max(L1, L2), lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}

const BG = token('--bg');
const SURFACE = token('--surface');
const COPPER = token('--copper');
const COPPER_TEXT = token('--copper-text');
const INK = token('--ink');
const MUTED = token('--muted');

test('bare --copper genuinely fails AA on the page background (why the fix exists)', () => {
  // Documents the problem: if this ever PASSES, the palette changed and the
  // whole copper-text split may be unnecessary — revisit deliberately.
  assert.ok(ratio(COPPER, BG) < 4.5, `expected --copper to fail AA on --bg, got ${ratio(COPPER, BG).toFixed(2)}`);
});

test('--copper-text passes WCAG AA (4.5:1) for normal text on bg AND surface', () => {
  assert.ok(ratio(COPPER_TEXT, BG) >= 4.5, `--copper-text on --bg = ${ratio(COPPER_TEXT, BG).toFixed(2)} (need ≥4.5)`);
  assert.ok(ratio(COPPER_TEXT, SURFACE) >= 4.5, `--copper-text on --surface = ${ratio(COPPER_TEXT, SURFACE).toFixed(2)} (need ≥4.5)`);
});

test('core text tokens (--ink, --muted) clear AA on both surfaces', () => {
  for (const [name, hex] of [['--ink', INK], ['--muted', MUTED]]) {
    assert.ok(ratio(hex, BG) >= 4.5, `${name} on --bg = ${ratio(hex, BG).toFixed(2)}`);
    assert.ok(ratio(hex, SURFACE) >= 4.5, `${name} on --surface = ${ratio(hex, SURFACE).toFixed(2)}`);
  }
});

test('--copper still clears the 3:1 non-text bar (borders, fills, ≥24px icons)', () => {
  assert.ok(ratio(COPPER, BG) >= 3, `--copper on --bg = ${ratio(COPPER, BG).toFixed(2)} (need ≥3 for non-text)`);
});

test('.eyebrow label uses ink, not copper (2026-09 copper discipline)', () => {
  // .eyebrow is the small uppercase label used on nearly every page.
  // Copper is reserved for the single main action + title accents; labels go ink.
  const m = css.match(/\.eyebrow\s*\{[^}]*\}/);
  assert.ok(m, '.eyebrow rule must exist');
  const rule = m[0];
  assert.ok(/color:\s*var\(--ink\)/.test(rule), '.eyebrow must use var(--ink)');
  assert.ok(!/var\(--copper/.test(rule), '.eyebrow must not reference any copper token');
});

// ---- Status/verdict text colors (perf #30) --------------------------------
// Regression guard: these small-text status colors were darkened to clear
// WCAG AA (4.5:1) on their real backgrounds. Each entry names the selector,
// the color declaration, and the background it sits on. If anyone lightens a
// status color again, this fails.
// 2026-09 redesign: campgrounds.css was deleted (dead resource, no page ever
// loaded it), so its status-color case is gone with the file.
const siteCss2 = readFileSync(join(__dirname, '..', 'src', 'assets', 'css', 'site.css'), 'utf8');

function declColor(cssText, selector) {
  // find the rule block for the selector, then its `color:` declaration
  const idx = cssText.indexOf(selector);
  assert.ok(idx >= 0, `selector ${selector} must exist`);
  const block = cssText.slice(idx, cssText.indexOf('}', idx));
  const m = block.match(/color:\s*(#[0-9A-Fa-f]{6})/);
  assert.ok(m, `${selector} must declare a 6-digit hex color`);
  return m[1];
}

const STATUS_CASES = [
  // [cssText, selector, background]
  [siteCss2, '.elec-ok .elec-verdict', '#FDFBF7'],
  [siteCss2, '.elec-tight .elec-verdict', '#FDFBF7'],
  [siteCss2, '.tow-verdict.tow-tight .tow-verdict-label', '#FFFFFF'], // 2026-09: verdict cards went paper (var(--surface))
  [siteCss2, '.payload-tight', '#FDFBF7'],
  [siteCss2, '.compat-tight .compat-badge', '#fff3e0'],
  [siteCss2, '.diff-warn .diff-delta', '#FDFBF7'],
  [siteCss2, '.wb-verdict--ok', '#FDFBF7'],
  [siteCss2, '.size-ref-verdict', '#FDFBF7'],
  [siteCss2, '.notes-status--saved', '#FDFBF7'],
  [siteCss2, '.grade-badge--grade-warn', '#fff3e0'],
  [siteCss2, '.wz-cat--electrical .wz-group-title', '#FDFBF7'],
];

test('status/verdict text colors all clear WCAG AA (4.5:1) on their backgrounds', () => {
  for (const [cssText, selector, bg] of STATUS_CASES) {
    const fg = declColor(cssText, selector);
    const r = ratio(fg, bg);
    assert.ok(r >= 4.5, `${selector}: ${fg} on ${bg} = ${r.toFixed(2)} (need ≥4.5)`);
  }
});
