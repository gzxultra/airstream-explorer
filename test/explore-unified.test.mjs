// Tests for the unified Explore experience: trailers AND motorhomes share one
// browse grid, one card style, one filter system, one family grid, one compare
// dataset. These are ADDITIVE — they lock in the merge behavior without
// weakening the trailer-only assertions elsewhere.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTrailers, groupByFamily } from '../src/lib/data.mjs';
import { renderIndex, renderExploreCard, renderExploreSections, renderCompare } from '../src/lib/render.mjs';
import { loadMotorhomes, groupMotorhomesByFamily } from '../src/lib/motorhome-data.mjs';
import { renderMotorhomeExploreCard } from '../src/lib/motorhome-render.mjs';

const trailers = loadTrailers();
const families = groupByFamily(trailers);
const motorhomes = loadMotorhomes();
const motorhomeFamilies = groupMotorhomesByFamily(motorhomes);
const classic = trailers.find((t) => t.slug === 'classic-33fb-2026');
const atlas = motorhomes.find((m) => m.slug === 'atlas-25ms-2027') || motorhomes[0];

test('loadTrailers tags every record type:"trailer"', () => {
  assert.ok(trailers.length > 0);
  assert.ok(trailers.every((t) => t.type === 'trailer'));
});

test('loadMotorhomes records carry type:"motorhome"', () => {
  assert.ok(motorhomes.length > 0);
  assert.ok(motorhomes.every((m) => m.type === 'motorhome'));
});

test('renderExploreCard (trailer) emits data-type="trailer" + m/ link + a cmp-box', () => {
  const html = renderExploreCard(classic);
  assert.match(html, /data-type="trailer"/);
  assert.match(html, /href="m\/classic-33fb-2026\.html"/);
  assert.match(html, /class="cmp-box"[^>]*data-type="trailer"/);
});

test('renderMotorhomeExploreCard emits data-type="motorhome" + mm/ link + a cmp-box', () => {
  const html = renderMotorhomeExploreCard(atlas);
  assert.match(html, /data-type="motorhome"/);
  assert.match(html, new RegExp(`href="mm/${atlas.slug}\\.html"`));
  assert.match(html, /class="cmp-box"[^>]*data-type="motorhome"/);
  // shares the trailer .xcard structure so the grid is ONE system
  assert.match(html, /class="xcard"/);
  assert.match(html, /class="xcard-foot"/);
});

test('renderExploreSections merges motorhome cards into the grid when given motorhomes', () => {
  const html = renderExploreSections(trailers, undefined, motorhomes);
  // both types of card present
  assert.ok((html.match(/data-type="trailer"/g) || []).length >= trailers.length);
  assert.ok((html.match(/data-type="motorhome"/g) || []).length >= motorhomes.length);
  // an mm/ link is in the grid
  assert.match(html, /href="mm\//);
});

test('renderExploreSections includes the All/Travel trailers/Motorhomes type control', () => {
  const html = renderExploreSections(trailers, undefined, motorhomes);
  assert.match(html, /id="x-type"/);
  assert.match(html, /data-type="all"/);
  assert.match(html, /data-type="trailer"/);
  assert.match(html, /data-type="motorhome"/);
});

test('renderExploreSections without motorhomes omits the type control (trailer-only safe)', () => {
  const html = renderExploreSections(trailers);
  assert.doesNotMatch(html, /id="x-type"/);
});

test('explore year select offers 2027 (motorhome years) alongside 2025/2026', () => {
  const html = renderExploreSections(trailers, undefined, motorhomes);
  assert.match(html, /<option value="2027">2027<\/option>/);
  assert.match(html, /<option value="2026" selected>2026<\/option>/);
  assert.match(html, /<option value="2025">2025<\/option>/);
});

test('renderIndex by-family grid unifies trailer + motorhome families (16 total)', () => {
  const html = renderIndex(families, trailers, undefined, motorhomes, motorhomeFamilies);
  const expected = families.length + motorhomeFamilies.length;
  assert.equal(expected, 16);
  assert.equal((html.match(/class="fam"/g) || []).length, expected);
  // a motorhome family link is present
  assert.match(html, /href="mf\//);
  // and the explore grid below has motorhome cards too
  assert.match(html, /data-type="motorhome"/);
});

test('renderIndex still renders 12 family cards when called trailer-only (back-compat)', () => {
  const html = renderIndex(families, trailers);
  assert.equal((html.match(/class="fam"/g) || []).length, 12);
});

test('renderCompare dataset island includes motorhome records with type + chassis', () => {
  const html = renderCompare(trailers, undefined, motorhomes);
  assert.match(html, /"type":"motorhome"/);
  assert.match(html, /"type":"trailer"/);
  assert.match(html, /"chassis"/);
  // motorhome records carry their detail-link dir so compare links to mm/
  assert.match(html, /"linkDir":"mm"/);
  assert.match(html, /"linkDir":"m"/);
});

test('renderCompare island count = trailers + motorhomes', () => {
  const html = renderCompare(trailers, undefined, motorhomes);
  const tCount = (html.match(/"type":"trailer"/g) || []).length;
  const mCount = (html.match(/"type":"motorhome"/g) || []).length;
  assert.equal(tCount, trailers.length);
  assert.equal(mCount, motorhomes.length);
});
