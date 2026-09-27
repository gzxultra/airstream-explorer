import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderOwnersGuideBody } from '../src/lib/render.mjs';
import { loadUpgrades, renderUpgradesBody } from '../src/lib/upgrades.mjs';
import { loadMaintenance, renderMaintenanceBody } from '../src/lib/maintenance.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

const upgrades = loadUpgrades();
const maintenance = loadMaintenance();

// ---------------------------------------------------------------------------
// renderOwnersGuideBody — Owner's guide page (2026-09 redesign)
// ---------------------------------------------------------------------------

test("owner's guide has exactly two tabs (upgrades + maintenance)", () => {
  const html = renderOwnersGuideBody(
    renderUpgradesBody(upgrades, '', { bare: true }),
    renderMaintenanceBody(maintenance, '', { bare: true }),
  );
  assert.ok(html.includes("Owner's guide") || html.includes('Owner&rsquo;s guide'), 'page title');
  assert.ok(html.includes('guide-tab-upgrades'), 'upgrades tab input');
  assert.ok(html.includes('guide-tab-maintenance'), 'maintenance tab input');
  assert.ok(html.includes('Upgrades & options'), 'upgrades tab label');
  assert.ok(html.includes('Maintenance schedule'), 'maintenance tab label');
  // Radio-tab pattern: exactly 2 tab inputs, first checked
  const inputs = html.match(/class="guide-tab-input"/g) || [];
  assert.equal(inputs.length, 2, 'exactly 2 tab radio inputs');
  assert.ok(html.includes('id="guide-tab-upgrades" checked'), 'upgrades tab default-checked');
});

test("owner's guide embeds upgrades + maintenance content (bare, no duplicate h1)", () => {
  const html = renderOwnersGuideBody(
    renderUpgradesBody(upgrades, '', { bare: true }),
    renderMaintenanceBody(maintenance, '', { bare: true }),
  );
  // Bare bodies skip their own page headers
  assert.ok(!html.includes('What owners actually add</h1>'), 'no upgrades h1');
  assert.ok(!html.includes('Keep your Airstream road-ready</h1>'), 'no maintenance h1');
  // But the content sections are present
  assert.ok(html.includes('id="up-main"'), 'upgrades sections embedded');
  assert.ok(html.includes('id="mt-main"'), 'maintenance sections embedded');
  // Only one h1 on the page (the guide's own)
  const h1s = html.match(/<h1>/g) || [];
  assert.equal(h1s.length, 1, 'exactly one h1');
});

test('bare:false (default) keeps standalone page headers (backward compat)', () => {
  const up = renderUpgradesBody(upgrades, '');
  const mt = renderMaintenanceBody(maintenance, '');
  assert.ok(up.includes('What owners actually add</h1>'), 'upgrades header intact');
  assert.ok(mt.includes('Keep your Airstream road-ready</h1>'), 'maintenance header intact');
});

// ---------------------------------------------------------------------------
// Built artifacts
// ---------------------------------------------------------------------------

test('dist/owners-guide.html exists with tabbed content', () => {
  const p = join(DIST, 'owners-guide.html');
  assert.ok(existsSync(p), 'owners-guide.html generated');
  const html = readFileSync(p, 'utf8');
  assert.ok(html.includes('guide-tab-upgrades'), 'upgrades tab in built page');
  assert.ok(html.includes('guide-tab-maintenance'), 'maintenance tab in built page');
  assert.ok(html.includes('id="up-main"') && html.includes('id="mt-main"'), 'both bodies in built page');
});

test('upgrades.html + maintenance.html are redirect stubs to the guide', () => {
  for (const [file, hash] of [['upgrades.html', '#upgrades'], ['maintenance.html', '#maintenance']]) {
    const html = readFileSync(join(DIST, file), 'utf8');
    assert.ok(html.includes('http-equiv="refresh"'), `${file} is a redirect stub`);
    assert.ok(html.includes(`owners-guide.html${hash}`), `${file} redirects to guide ${hash}`);
    assert.ok(html.includes('noindex'), `${file} is noindex`);
  }
});

test("owner's guide CSS tab rules exist (fixes unstyled off-grid tabs too)", () => {
  const css = readFileSync(join(ROOT, 'src/assets/css/site.css'), 'utf8');
  assert.ok(css.includes('.guide-tab-input:checked + .guide-tab + .guide-panel'), 'guide tab show rule');
  assert.ok(css.includes('.og-tab-input:checked + .og-tab + .og-panel'), 'off-grid tab show rule');
});
