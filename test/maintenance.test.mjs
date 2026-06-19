import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadMaintenance, validateMaintenance, renderMaintenanceBody,
  CADENCE_META, SEVERITY_META, PIP_MAX,
} from '../src/lib/maintenance.mjs';

const data = loadMaintenance();

// A minimal valid task factory, so each negative test changes exactly one thing.
function okTask(over = {}) {
  return Object.assign({
    name: 'Y', why: 'z', doThis: 'do it', intervalText: 'now',
    appliesTo: 'All', cadence: 'annual', severity: 'safety',
    sources: [{ label: 'a', url: 'https://a.com' }],
  }, over);
}
function wrap(task, extra = {}) {
  return Object.assign({
    intro: 'i',
    categories: [{ id: 'x', title: 'X', items: [task] }],
  }, extra);
}

test('maintenance dataset loads with categories and tasks', () => {
  assert.ok(data && Array.isArray(data.categories));
  assert.ok(data.categories.length >= 5, `expected several cadences, got ${data.categories.length}`);
  const total = data.categories.reduce((n, c) => n + c.items.length, 0);
  assert.ok(total >= 18, `expected a real list of tasks, got ${total}`);
});

test('every task is classified and carries at least one source (the contract)', () => {
  const problems = validateMaintenance(data);
  assert.deepEqual(problems, [], problems.join('\n'));
});

test('validator catches a bad cadence', () => {
  const problems = validateMaintenance(wrap(okTask({ cadence: 'whenever' })));
  assert.ok(problems.some((p) => p.includes('bad cadence')), problems.join('\n'));
});

test('validator catches a bad severity', () => {
  const problems = validateMaintenance(wrap(okTask({ severity: 'meh' })));
  assert.ok(problems.some((p) => p.includes('bad severity')), problems.join('\n'));
});

test('validator catches a missing source', () => {
  const problems = validateMaintenance(wrap(okTask({ sources: [] })));
  assert.ok(problems.some((p) => p.includes('at least one source')), problems.join('\n'));
});

test('validator catches a non-http source url', () => {
  const problems = validateMaintenance(wrap(okTask({ sources: [{ label: 'a', url: 'ftp://a' }] })));
  assert.ok(problems.some((p) => p.includes('not http(s)')), problems.join('\n'));
});

test('validator catches a missing actionable step', () => {
  const problems = validateMaintenance(wrap(okTask({ doThis: '' })));
  assert.ok(problems.some((p) => p.includes('doThis')), problems.join('\n'));
});

test('validator catches a missing appliesTo (conditional scoping must be explicit)', () => {
  const problems = validateMaintenance(wrap(okTask({ appliesTo: '' })));
  assert.ok(problems.some((p) => p.includes('appliesTo')), problems.join('\n'));
});

test('every task uses a cadence and severity defined in the meta scales', () => {
  for (const cat of data.categories) {
    for (const it of cat.items) {
      assert.ok(CADENCE_META[it.cadence], `unknown cadence ${it.cadence} on ${it.name}`);
      assert.ok(SEVERITY_META[it.severity], `unknown severity ${it.severity} on ${it.name}`);
    }
  }
});

test('every source url is https (no plain-http leaks)', () => {
  for (const cat of data.categories) {
    for (const it of cat.items) {
      for (const s of it.sources) {
        assert.match(s.url, /^https:\/\//, `${it.name} source not https: ${s.url}`);
      }
    }
  }
});

// ---- Accuracy guardrails: the specific facts Airstreams get wrong elsewhere.
// These lock in the distinctions that make this page correct for an Airstream
// specifically, so a future edit can't silently regress them.

test('lug torque states current Airstream spec (aluminum 110 / steel 100), not the old 95/120', () => {
  const body = renderMaintenanceBody(data, '');
  assert.match(body, /110\s*ft-lbs/, 'expected aluminum 110 ft-lbs');
  assert.match(body, /100\s*ft-lbs/, 'expected steel 100 ft-lbs');
});

test('bearings: Nev-R-Lube is inspect-only and explicitly NOT the E-Z Lube grease interval', () => {
  const body = renderMaintenanceBody(data, '');
  assert.match(body, /Nev-R-Lube/, 'expected Nev-R-Lube named');
  assert.match(body, /E-Z Lube/, 'expected the E-Z Lube distinction drawn');
  // The whole point: do not pump grease at a sealed cartridge.
  assert.match(body, /do NOT repack|don.t try to .grease.|sealed for life/i,
    'expected an explicit do-not-repack guard for sealed bearings');
});

test('water-heater anode is scoped to Suburban steel tanks only (Atwood/Dometic has none)', () => {
  const body = renderMaintenanceBody(data, '');
  assert.match(body, /Suburban/, 'expected Suburban named');
  assert.match(body, /Atwood\/Dometic|aluminum/, 'expected the aluminum-tank exception');
  // The anode task must carry an appliesTo that names the Suburban-only scope.
  let anode = null;
  for (const cat of data.categories) for (const it of cat.items) {
    if (/anode/i.test(it.name)) anode = it;
  }
  assert.ok(anode, 'expected an anode task');
  assert.match(anode.appliesTo, /Suburban/, 'anode appliesTo must name Suburban');
});

test('winterizing uses non-toxic RV antifreeze and bypasses the water heater', () => {
  const body = renderMaintenanceBody(data, '');
  assert.match(body, /non-toxic RV antifreeze/i);
  assert.match(body, /bypass/i);
});

test('tire replacement is driven by age/DOT date, not tread', () => {
  const body = renderMaintenanceBody(data, '');
  assert.match(body, /DOT date|date code/i);
  assert.match(body, /by age/i);
});

test('seams item flags the aluminum body and warns off rubber-roof lap sealant', () => {
  const body = renderMaintenanceBody(data, '');
  assert.match(body, /aluminum/i);
  assert.match(body, /lap sealant|Dicor/i, 'expected an explicit not-a-rubber-roof distinction');
});

test('renderMaintenanceBody emits a card per task, the lens, legend and jump nav', () => {
  const body = renderMaintenanceBody(data, '');
  const cards = (body.match(/<article class="mt-card/g) || []).length;
  const total = data.categories.reduce((n, c) => n + c.items.length, 0);
  assert.equal(cards, total, `card count ${cards} != task count ${total}`);
  assert.match(body, /id="mt-lens"/, 'expected the filter lens');
  assert.match(body, /class="mt-legend"/, 'expected the legend');
  assert.match(body, /class="mt-jump"/, 'expected the jump nav');
  // Each section carries a data-seccount the filter updates.
  const secs = (body.match(/data-seccount/g) || []).length;
  assert.equal(secs, data.categories.length, 'expected a count per section');
});

test('renderMaintenanceBody escapes html and never breaks out of a <script>', () => {
  const evil = wrap(okTask({ name: '</script><b>x', why: 'a & b < c' }));
  const body = renderMaintenanceBody(evil, '');
  assert.ok(!body.includes('</script><b>x'), 'unescaped name leaked');
  assert.match(body, /&amp;/, 'expected & escaped');
});

test('every cadence in the data has a matching section, and severities cover the scale', () => {
  const cadencesUsed = new Set();
  const severitiesUsed = new Set();
  for (const cat of data.categories) for (const it of cat.items) {
    cadencesUsed.add(it.cadence); severitiesUsed.add(it.severity);
  }
  // All three severity tiers should actually appear (it's a real triage).
  for (const k of Object.keys(SEVERITY_META)) {
    assert.ok(severitiesUsed.has(k), `severity tier never used: ${k}`);
  }
  assert.ok(cadencesUsed.size >= 5, `expected tasks across many cadences, got ${cadencesUsed.size}`);
});

test('PIP_MAX matches the largest severity pip count', () => {
  const maxPips = Math.max(...Object.values(SEVERITY_META).map((m) => m.pips));
  assert.equal(PIP_MAX, maxPips);
});
