import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appJs = readFileSync('src/assets/js/app.js', 'utf8');
const siteCss = readFileSync('src/assets/css/site.css', 'utf8');
const themeCss = readFileSync('src/assets/css/theme.css', 'utf8');

import { renderDetail, renderIndex } from '../src/lib/render.mjs';
import { loadTrailers, groupByFamily } from '../src/lib/data.mjs';

const trailers = loadTrailers();
const families = groupByFamily(trailers);
const sample = trailers.find(t => t.msrp > 0);
const detailHtml = renderDetail(sample, undefined, null, null, trailers);
const indexHtml = renderIndex(families, trailers);

describe('cost-per-night campground fee', () => {
  it('renders campground fee slider', () => {
    assert.ok(detailHtml.includes('id="cn-camp-fee"'), 'should have campground fee slider');
    assert.ok(detailHtml.includes('Campground fee'), 'should have campground fee label');
  });

  it('renders fee preset buttons', () => {
    assert.ok(detailHtml.includes('cn-fee-presets'), 'should have fee preset container');
    assert.ok(detailHtml.includes('data-fee="0"'), 'should have free/BLM preset');
    assert.ok(detailHtml.includes('data-fee="30"'), 'should have state park preset');
    assert.ok(detailHtml.includes('data-fee="55"'), 'should have private preset');
    assert.ok(detailHtml.includes('data-fee="85"'), 'should have RV resort preset');
  });

  it('includes campground fee in default cost calculation', () => {
    const annualOwnMatch = detailHtml.match(/data-annual-own="(\d+)"/);
    assert.ok(annualOwnMatch, 'should have data-annual-own');
    const annualOwn = parseInt(annualOwnMatch[1], 10);
    const defaultCampFee = 40;
    const totalNights = 36;
    const totalAnnual = annualOwn + (defaultCampFee * totalNights);
    const expectedCost = Math.round(totalAnnual / totalNights);
    assert.ok(detailHtml.includes('$' + expectedCost), 'should show cost including camp fees ($' + expectedCost + ')');
  });

  it('no longer says fees not included', () => {
    assert.ok(!detailHtml.includes('not included'), 'should NOT say campground fees not included');
  });

  it('app.js wires campground fee slider', () => {
    assert.ok(appJs.includes("getElementById('cn-camp-fee')"), 'should get camp fee element');
    assert.ok(appJs.includes('cn-fee-preset'), 'should handle fee preset clicks');
  });
});

describe('quick view prev/next navigation', () => {
  it('renders prev/next buttons in quick view', () => {
    assert.ok(indexHtml.includes('id="qv-prev"'), 'should have prev button');
    assert.ok(indexHtml.includes('id="qv-next"'), 'should have next button');
  });

  it('renders counter element', () => {
    assert.ok(indexHtml.includes('id="qv-counter"'), 'should have counter');
  });

  it('has qv-nav CSS class for navigation buttons', () => {
    assert.ok(indexHtml.includes('qv-nav--prev'), 'prev has correct class');
    assert.ok(indexHtml.includes('qv-nav--next'), 'next has correct class');
  });

  it('app.js handles prev/next clicks and keyboard', () => {
    assert.ok(appJs.includes("getElementById('qv-prev')"), 'should get prev button');
    assert.ok(appJs.includes("getElementById('qv-next')"), 'should get next button');
    assert.ok(appJs.includes('ArrowLeft'), 'should handle left arrow');
    assert.ok(appJs.includes('ArrowRight'), 'should handle right arrow');
  });

  it('keyboard help mentions arrow keys for Quick View', () => {
    assert.ok(indexHtml.includes('Prev / next in Quick View'), 'keyboard help should mention QV nav');
  });
});

describe('quick view navigation CSS', () => {
  it('has qv-nav base styles', () => {
    assert.ok(siteCss.includes('.qv-nav'), 'should have qv-nav styles');
    assert.ok(siteCss.includes('.qv-nav--prev'), 'should have prev positioning');
    assert.ok(siteCss.includes('.qv-nav--next'), 'should have next positioning');
  });

  it('has qv-counter styles', () => {
    assert.ok(siteCss.includes('.qv-counter'), 'should have counter styles');
  });

  it('has dark mode overrides', () => {
    assert.ok(themeCss.includes('.qv-nav'), 'should have dark qv-nav styles');
  });
});

describe('campground fee preset CSS', () => {
  it('has fee preset button styles', () => {
    assert.ok(siteCss.includes('.cn-fee-preset'), 'should have preset styles');
    assert.ok(siteCss.includes('.cn-fee-preset.is-active'), 'should have active state');
  });

  it('has dark mode overrides for fee presets', () => {
    assert.ok(themeCss.includes('.cn-fee-preset'), 'should have dark theme preset styles');
  });
});

describe('section nav auto-expand collapsed sections', () => {
  it('app.js intercepts secnav clicks to expand collapsed sections', () => {
    assert.ok(appJs.includes('is-collapsed'), 'should reference collapsed state');
    assert.ok(appJs.includes('collapsible-trigger'), 'should reference collapsible triggers');
    assert.ok(appJs.includes("nav.addEventListener('click'"), 'should listen for clicks on nav');
  });
});
