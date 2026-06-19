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

// ===========================================================================
// v2 additions: cost estimates, inline diagrams, my-rig scoping, checklist keys.
// These guard the new fields' integrity contracts (HARD RULES 1 & 2).
// ===========================================================================

test('validator accepts a $0 (your-time-only) task with no cost source, but requires a source once a dollar figure is claimed', () => {
  // $0 / $0 makes no monetary claim → no source needed.
  const free = wrap(okTask({ cost: { diy: { low: 0, high: 0 }, pro: { low: 0, high: 0 } } }));
  assert.equal(validateMaintenance(free).length, 0);
  // A real dollar figure with no cost.sources → must fail.
  const unsourced = wrap(okTask({ cost: { diy: { low: 10, high: 40 } } }));
  assert.ok(validateMaintenance(unsourced).some((p) => /cost.*source/i.test(p)));
  // Same figure, now sourced → passes.
  const sourced = wrap(okTask({
    cost: { diy: { low: 10, high: 40 }, sources: [{ label: 'x', url: 'https://x.com' }] },
  }));
  assert.equal(validateMaintenance(sourced).length, 0);
});

test('validator rejects a non-numeric cost band and a non-http cost source', () => {
  const badBand = wrap(okTask({ cost: { diy: { low: 'ten', high: 40 }, sources: [{ label: 'x', url: 'https://x.com' }] } }));
  assert.ok(validateMaintenance(badBand).some((p) => /numeric/i.test(p)));
  const badSrc = wrap(okTask({ cost: { pro: { low: 100, high: 200 }, sources: [{ label: 'x', url: 'ftp://x' }] } }));
  assert.ok(validateMaintenance(badSrc).some((p) => /cost source/i.test(p)));
});

test('BUDGET HONESTY: no cost band is a one-time tool or rare conditional repair masquerading as recurring spend', () => {
  // The yearly rollup multiplies each band by its cadence frequency. So a band must
  // be the *recurring per-service* spend, never a $110 torque wrench or a $2,000+
  // conditional repair. Catch the regression where those leak back into a band.
  const FREQ = { trip: 6, monthly: 6, quarterly: 4, semiannual: 2, annual: 1, multiyear: 0.25, seasonal: 2 };
  let diyLo = 0, diyHi = 0;
  for (const cat of data.categories) {
    for (const it of cat.items) {
      const c = it.cost; if (!c) continue;
      const f = FREQ[it.cadence] || 1;
      // No single DIY per-service band should exceed a sane recurring ceiling.
      if (c.diy && Number(c.diy.high) > 250) {
        assert.fail(`DIY band too high for a recurring task (likely a one-time tool/repair): ${it.name} = ${c.diy.high}`);
      }
      if (c.diy) { diyLo += (Number(c.diy.low) || 0) * f; diyHi += (Number(c.diy.high) || 0) * f; }
    }
  }
  // The annualized DIY envelope should land in a believable owner range.
  assert.ok(diyHi >= 200 && diyHi <= 2000, `DIY annual high out of sane range: ${diyHi}`);
  assert.ok(diyLo >= 50 && diyLo <= diyHi, `DIY annual low out of sane range: ${diyLo}`);
});

test('SVG SAFETY (HARD RULE 1): every diagram is self-contained inline line-art, no raster or external ref', () => {
  let diagrams = 0;
  for (const cat of data.categories) {
    for (const it of cat.items) {
      if (!it.diagram) continue;
      diagrams++;
      assert.ok(/^<svg[\s>]/.test((it.diagram.svg || '').trim()), `${it.name}: diagram must be inline <svg>`);
      assert.ok(!/<image\b|xlink:href|href\s*=|https?:/i.test(it.diagram.svg), `${it.name}: diagram must have no external ref / raster`);
    }
  }
  assert.ok(diagrams >= 6, `expected several hand-built diagrams, got ${diagrams}`);
  // And the validator must actively reject a diagram that smuggles in a raster.
  const bad = wrap(okTask({ diagram: { svg: '<svg><image href="http://x/p.png"/></svg>' } }));
  assert.ok(validateMaintenance(bad).some((p) => /line-art|self-contained|external/i.test(p)));
});

test('validator rejects an out-of-enum rig scope and accepts the known axle/heater/battery values', () => {
  const bad = wrap(okTask({ rig: { axle: 'mystery' } }));
  assert.ok(validateMaintenance(bad).some((p) => /rig\.axle/i.test(p)));
  const good = wrap(okTask({ rig: { axle: 'nevrlube', heater: 'suburban', battery: 'flooded' } }));
  assert.equal(validateMaintenance(good).length, 0);
});

test('CHECKLIST KEYS: task name slugs are unique (localStorage state must not collide)', () => {
  const dup = {
    intro: 'i',
    categories: [{ id: 'x', title: 'X', items: [okTask({ name: 'Same Name' }), okTask({ name: 'Same Name' })] }],
  };
  assert.ok(validateMaintenance(dup).some((p) => /duplicate task slug/i.test(p)));
  // Real data must already be collision-free.
  assert.equal(validateMaintenance(data).filter((p) => /duplicate task slug/i.test(p)).length, 0);
});

test('render emits the my-rig control, the DIY/Shop budget rollup, the timeline ribbon and per-card checklist + cost data', () => {
  const html = renderMaintenanceBody(data, '');
  assert.ok(html.includes('id="mt-tools"'), 'my-rig / tools bar present');
  assert.ok(/data-rig="axle"/.test(html) && /data-rig="heater"/.test(html), 'rig selects present');
  assert.ok(html.includes('id="mt-budget"'), 'budget rollup present');
  assert.ok(/id="mt-basis-diy"/.test(html) && /id="mt-basis-pro"/.test(html), 'DIY/Shop toggle present');
  assert.ok(html.includes('mt-timeline'), 'cadence timeline ribbon present');
  assert.ok(html.includes('mt-hero-stat'), 'hero stat line present');
  // Per-card: every card carries a stable checklist id + rig data + at least the chips exist somewhere.
  assert.ok(/data-cid="/.test(html), 'cards carry checklist ids');
  assert.ok(/data-rig-axle="/.test(html), 'cards carry rig scope attrs');
  assert.ok(html.includes('mt-cost-chip'), 'cost chips render');
  // The budget label must read as an estimate, never a quote (HARD RULE 2).
  assert.ok(/estimate, not a quote/i.test(html), 'cost is framed as an estimate');
});

test('cost data attributes round-trip as numbers for the rollup (no NaN leaks into the budget)', () => {
  const html = renderMaintenanceBody(data, '');
  const nums = [...html.matchAll(/data-(?:diy|pro)-(?:low|high)="([^"]*)"/g)].map((m) => m[1]);
  assert.ok(nums.length > 0, 'expected cost data attributes');
  for (const n of nums) assert.ok(/^-?\d+(\.\d+)?$/.test(n), `cost attr not numeric: "${n}"`);
});
