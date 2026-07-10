import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { projectResale, renderDetail, renderIndex } from '../src/lib/render.mjs';
import { SORT_KEYS, sortTrailers } from '../src/lib/explore.mjs';
import { loadTrailers, groupByFamily } from '../src/lib/data.mjs';

const trailers = loadTrailers();
const families = groupByFamily(trailers);
const sample = trailers.find((t) => t.slug === 'flying-cloud-25fb-2026') || trailers[0];

describe('projectResale', () => {
  it('returns correct structure with milestones', () => {
    const proj = projectResale(100000, 'good');
    assert.ok(proj.airstream);
    assert.ok(proj.industry);
    assert.equal(proj.airstream.length, 6);
    assert.equal(proj.industry.length, 6);
  });

  it('year 0 is always 100% of MSRP', () => {
    const proj = projectResale(150000, 'good');
    assert.equal(proj.airstream[0].value, 150000);
    assert.equal(proj.airstream[0].pct, 100);
    assert.equal(proj.industry[0].value, 150000);
    assert.equal(proj.industry[0].pct, 100);
  });

  it('values decrease over time (monotonically)', () => {
    for (const cond of ['excellent', 'good', 'fair']) {
      const proj = projectResale(200000, cond);
      for (let i = 1; i < proj.airstream.length; i++) {
        assert.ok(proj.airstream[i].value < proj.airstream[i - 1].value,
          `Airstream ${cond}: yr ${proj.airstream[i].year} < yr ${proj.airstream[i - 1].year}`);
      }
    }
  });

  it('Airstream retains more value than industry at every milestone', () => {
    const proj = projectResale(120000, 'good');
    for (let i = 1; i < proj.airstream.length; i++) {
      assert.ok(proj.airstream[i].value > proj.industry[i].value,
        `Year ${proj.airstream[i].year}: Airstream > industry`);
    }
  });

  it('excellent > good > fair at year 10', () => {
    const exc = projectResale(100000, 'excellent');
    const good = projectResale(100000, 'good');
    const fair = projectResale(100000, 'fair');
    const last = exc.airstream.length - 1;
    assert.ok(exc.airstream[last].value > good.airstream[last].value);
    assert.ok(good.airstream[last].value > fair.airstream[last].value);
  });

  it('Airstream 10yr retention in realistic range (50-75% for good)', () => {
    const proj = projectResale(100000, 'good');
    const yr10 = proj.airstream[proj.airstream.length - 1];
    assert.ok(yr10.pct >= 50 && yr10.pct <= 75, `10yr ${yr10.pct}%`);
  });

  it('industry 10yr retention lower (25-45%)', () => {
    const proj = projectResale(100000, 'good');
    const yr10 = proj.industry[proj.industry.length - 1];
    assert.ok(yr10.pct >= 25 && yr10.pct <= 45, `industry 10yr ${yr10.pct}%`);
  });
});

describe('resale projector in detail page', () => {
  const html = renderDetail(sample, undefined, null, null, trailers);

  it('renders resale section with chart', () => {
    assert.ok(html.includes('id="resale"'));
    assert.ok(html.includes('resale-chart'));
    assert.ok(html.includes('resale-bar--airstream'));
    assert.ok(html.includes('resale-bar--industry'));
  });

  it('renders condition selector', () => {
    assert.ok(html.includes('id="resale-cond"'));
    assert.ok(html.includes('value="excellent"'));
    assert.ok(html.includes('value="good" selected'));
  });

  it('renders highlights', () => {
    assert.ok(html.includes('id="resale-5yr"'));
    assert.ok(html.includes('id="resale-10yr"'));
    assert.ok(html.includes('% retained'));
  });

  it('resale in section nav', () => {
    assert.ok(html.includes('href="#resale"'));
  });
});

describe('trip cost estimator in detail page', () => {
  const html = renderDetail(sample, undefined, null, null, trailers);

  it('renders trip cost section', () => {
    assert.ok(html.includes('id="trip-cost"'));
    assert.ok(html.includes('trip-cost-tool'));
  });

  it('renders all inputs', () => {
    assert.ok(html.includes('id="trip-dist"'));
    assert.ok(html.includes('id="trip-nights"'));
    assert.ok(html.includes('id="trip-camp"'));
    assert.ok(html.includes('id="trip-fuel-price"'));
  });

  it('renders campground options', () => {
    assert.ok(html.includes('Free / BLM / dispersed'));
    assert.ok(html.includes('State / county park'));
    assert.ok(html.includes('Private campground'));
    assert.ok(html.includes('RV resort'));
  });

  it('renders breakdown', () => {
    assert.ok(html.includes('id="trip-fuel-dd"'));
    assert.ok(html.includes('id="trip-camp-dd"'));
    assert.ok(html.includes('id="trip-propane-dd"'));
    assert.ok(html.includes('id="trip-total"'));
  });

  it('data island has correct structure', () => {
    const m = html.match(/<script type="application\/json" id="trip-cost-data">([\s\S]*?)<\/script>/);
    assert.ok(m, 'data island exists');
    const data = JSON.parse(m[1].replace(/\\u003c/g, '<'));
    assert.ok(data.gvwrLb > 0);
    assert.ok(data.estMpg > 0);
    assert.ok(data.presets);
    assert.equal(data.presets.free.perNight, 0);
  });

  it('trip-cost in section nav', () => {
    assert.ok(html.includes('href="#trip-cost"'));
  });

  it('estimated MPG is reasonable', () => {
    const m = html.match(/~(\d+) MPG towing/);
    assert.ok(m);
    const mpg = parseInt(m[1], 10);
    assert.ok(mpg >= 7 && mpg <= 16, `MPG ${mpg}`);
  });
});

describe('explore sort: $/lb', () => {
  it('SORT_KEYS includes value-lb-asc', () => {
    assert.ok(SORT_KEYS['value-lb-asc']);
    assert.equal(SORT_KEYS['value-lb-asc'].label, 'Best value ($/lb)');
  });

  it('sorts trailers by $/lb ascending', () => {
    const sorted = sortTrailers(trailers, 'value-lb-asc');
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i], b = sorted[i + 1];
      const valA = a.weightLb > 0 ? a.msrp / a.weightLb : Infinity;
      const valB = b.weightLb > 0 ? b.msrp / b.weightLb : Infinity;
      if (valA === valB) continue;
      assert.ok(valA < valB, `${a.slug} < ${b.slug}`);
    }
  });

  it('$/lb option in explore page', () => {
    const html = renderIndex(families, trailers);
    assert.ok(html.includes('value="value-lb-asc"'));
    assert.ok(html.includes('Best value ($/lb)'));
  });
});
