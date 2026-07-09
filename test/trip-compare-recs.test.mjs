import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTrailers } from '../src/lib/data.mjs';
import { renderDetail, renderCompare, renderSaved } from '../src/lib/render.mjs';
import { loadMotorhomes } from '../src/lib/motorhome-data.mjs';

const trailers = loadTrailers();
const motorhomes = loadMotorhomes();
const classic = trailers.find((t) => t.slug === 'classic-33fb-2026');
const bambi = trailers.find((t) => t.slug === 'bambi-16rb-2026');
const html = renderDetail(classic, undefined, null, null, trailers);
const bambiHtml = renderDetail(bambi, undefined, null, null, trailers);

// --- Trip Ready Checklist ---

test('detail page emits trip-ready section', () => {
  assert.ok(html.includes('id="trip-ready"'), 'missing trip-ready section');
  assert.ok(html.includes('class="trip-ready'), 'missing trip-ready class');
});

test('trip ready has collapsible trigger with aria-expanded', () => {
  assert.match(html, /class="collapsible-trigger"[^>]*aria-expanded="false"/);
});

test('trip ready has progress bar', () => {
  assert.ok(html.includes('id="trip-progress-fill"'), 'missing progress fill');
  assert.ok(html.includes('class="trip-progress"'), 'missing progress bar');
});

test('trip ready has reset button', () => {
  assert.ok(html.includes('id="trip-reset"'), 'missing reset button');
});

test('trip ready checklist uses real tank specs for Classic 33FB', () => {
  // Classic 33FB has 53-gallon fresh tank
  assert.ok(html.includes('53-gallon fresh water tank'), 'should reference real fresh tank capacity');
});

test('trip ready checklist uses real tank specs for Bambi 16RB', () => {
  // Bambi 16RB has 23-gallon fresh tank
  assert.ok(bambiHtml.includes('23-gallon fresh water tank'), 'should reference real fresh tank capacity');
});

test('trip ready has model-specific hitch weight', () => {
  // Classic 33FB has specific hitch weight
  if (classic.hitchWeightLb) {
    assert.ok(html.includes('hitch weight'), 'should reference hitch weight');
  }
});

test('trip ready has solar spec when present', () => {
  if (classic.solarW) {
    assert.ok(html.includes(classic.solarW + 'W solar'), 'should reference solar wattage');
  }
});

test('trip ready has battery spec when present', () => {
  if (classic.batteryKwh) {
    assert.ok(html.includes(classic.batteryKwh + ' kWh'), 'should reference battery capacity');
  }
});

test('trip ready items have checkbox inputs with data-trip-item', () => {
  const checkCount = (html.match(/class="trip-check"/g) || []).length;
  assert.ok(checkCount >= 10, 'should have at least 10 checklist items, got ' + checkCount);
  assert.ok(html.includes('data-trip-item='), 'checkboxes should have data-trip-item');
});

test('trip ready has 4 category groups', () => {
  assert.ok(html.includes('trip-cat--water'), 'missing water category');
  assert.ok(html.includes('trip-cat--tow'), 'missing tow category');
  assert.ok(html.includes('trip-cat--systems'), 'missing systems category');
  assert.ok(html.includes('trip-cat--interior'), 'missing interior category');
});

test('trip ready appears in section nav', () => {
  assert.ok(html.includes('#trip-ready'), 'section nav should link to trip-ready');
  assert.ok(html.includes('Trip Ready'), 'section nav should show Trip Ready label');
});

// --- Compare Page: Share button + Verdict ---

test('compare page has share comparison button', () => {
  const cmpHtml = renderCompare(trailers, undefined, motorhomes);
  assert.ok(cmpHtml.includes('id="cmp-share"'), 'missing share button');
  assert.ok(cmpHtml.includes('Share comparison'), 'missing share button text');
});

test('compare page share button is inside table wrap', () => {
  const cmpHtml = renderCompare(trailers, undefined, motorhomes);
  assert.ok(cmpHtml.includes('cmp-share-row'), 'missing share row container');
});

// --- Saved Page: Recommendations section ---

test('saved page has recommendations section', () => {
  const savedHtml = renderSaved(trailers, undefined, motorhomes);
  assert.ok(savedHtml.includes('id="recs-section"'), 'missing recs section');
  assert.ok(savedHtml.includes('id="recs-grid"'), 'missing recs grid');
});

test('saved page recs section starts hidden', () => {
  const savedHtml = renderSaved(trailers, undefined, motorhomes);
  const match = savedHtml.match(/recs-section"[^>]*hidden/);
  assert.ok(match, 'recs section should start hidden');
});

test('saved page has "You might also like" heading', () => {
  const savedHtml = renderSaved(trailers, undefined, motorhomes);
  assert.ok(savedHtml.includes('You might also like'), 'missing recommendation heading');
});

// --- CSS coverage ---

import { readFileSync } from 'node:fs';
const siteCss = readFileSync('src/assets/css/site.css', 'utf8');
const themeCss = readFileSync('src/assets/css/theme.css', 'utf8');

test('site.css has compare verdict styles', () => {
  assert.ok(siteCss.includes('.cmp-verdict'), 'missing .cmp-verdict CSS');
  assert.ok(siteCss.includes('.cmp-diff'), 'missing .cmp-diff CSS');
  assert.ok(siteCss.includes('.cmp-share-row'), 'missing .cmp-share-row CSS');
});

test('site.css has trip ready styles', () => {
  assert.ok(siteCss.includes('.trip-ready'), 'missing .trip-ready CSS');
  assert.ok(siteCss.includes('.trip-progress'), 'missing .trip-progress CSS');
  assert.ok(siteCss.includes('.trip-check'), 'missing .trip-check CSS');
});

test('site.css has recommendation card styles', () => {
  assert.ok(siteCss.includes('.recs-card'), 'missing .recs-card CSS');
  assert.ok(siteCss.includes('.recs-grid'), 'missing .recs-grid CSS');
});

test('theme.css has dark mode overrides for new features', () => {
  assert.ok(themeCss.includes('.cmp-verdict-lead'), 'missing dark cmp-verdict-lead');
  assert.ok(themeCss.includes('.trip-ready'), 'missing dark trip-ready');
  assert.ok(themeCss.includes('.recs-card'), 'missing dark recs-card');
});
