import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTrailers, groupByFamily } from '../src/lib/data.mjs';
import { esc, renderCard, renderFamilyCard, renderIndex, renderFamily, renderDetail } from '../src/lib/render.mjs';

const trailers = loadTrailers();
const families = groupByFamily(trailers);
const classic = trailers.find((t) => t.slug === 'classic-33fb-2026');
const classicFam = families.find((f) => f.family === 'Classic');
const bambiFam = families.find((f) => f.family === 'Bambi');

test('esc neutralizes HTML', () => {
  assert.equal(esc('<script>"x"&\'y\''), '&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;');
});

test('renderCard links to detail page (with linkPrefix) and carries year data-attr', () => {
  const html = renderCard(classic, undefined, '../');
  assert.match(html, /href="\.\.\/m\/classic-33fb-2026\.html"/);
  assert.match(html, /data-year="2026"/);
  assert.match(html, /\.\.\/assets\/img\/thumbs\/classic-33fb-2026\.webp/);
  assert.match(html, /loading="lazy"/);
});

test('renderFamilyCard links to the family page and shows range stats', () => {
  const html = renderFamilyCard(classicFam, '');
  assert.match(html, /href="f\/classic\.html"/);
  assert.match(html, /assets\/img\/heroes\/classic\.webp/);
  assert.match(html, /Classic/);
  assert.match(html, /floorplan/);          // floorplan count badge
  assert.match(html, /\$/);                 // a price range
});

test('renderIndex is a full valid document with exactly 12 family cards', () => {
  const html = renderIndex(families);
  assert.ok(html.startsWith('<!DOCTYPE html>'));
  assert.ok(html.trimEnd().endsWith('</html>'));
  assert.equal((html.match(/class="fam"/g) || []).length, 12);
  assert.match(html, /href="f\/bambi\.html"/);
  assert.match(html, /href="f\/flying-cloud\.html"/);
  // no individual floorplan cards on the home page anymore
  assert.equal((html.match(/class="card"/g) || []).length, 0);
});

test('home subhead and footer agree on the floorplan count (distinct layouts)', () => {
  const html = renderIndex(families);
  const distinct = families.reduce((n, f) => n + f.floorplanCount, 0); // 31
  // subhead lede
  assert.match(html, new RegExp(`${families.length} families, ${distinct} floorplans`));
  // footer must use the SAME number — no stale hardcoded 59
  assert.match(html, new RegExp(`${distinct} floorplans across 12 families`));
  assert.doesNotMatch(html, /59 floorplans across/);
});

test('home families are ordered flagship -> budget by entry price', () => {
  const prices = families.filter((f) => f.priceMin != null).map((f) => f.priceMin);
  const sorted = [...prices].sort((a, b) => b - a);
  assert.deepEqual(prices, sorted);
});

test('home leads with Classic and sinks Basecamp below it', () => {
  const priced = families.filter((f) => f.priceMin != null);
  assert.equal(priced[0].family, 'Classic');
  const classicIdx = priced.findIndex((f) => f.family === 'Classic');
  const basecampIdx = priced.findIndex((f) => f.family === 'Basecamp');
  assert.ok(basecampIdx > classicIdx, 'Basecamp sits below Classic');
});

test('renderFamily shows all of a family\'s floorplans with hero + back link', () => {
  const html = renderFamily(classicFam);
  assert.ok(html.startsWith('<!DOCTYPE html>'));
  assert.match(html, /← All families/);
  assert.match(html, /class="fam-hero"/);
  assert.match(html, /\.\.\/assets\/img\/heroes\/classic\.webp/);
  assert.equal((html.match(/class="card"/g) || []).length, classicFam.trailers.length);
});

test('renderFamily year filter appears only when family spans both years', () => {
  const both = renderFamily(bambiFam);            // 2025 + 2026
  assert.match(both, /data-year="2026"/);
  assert.match(both, /data-year="2025"/);
  const single = families.find((f) => f.years.length === 1);
  if (single) {
    const html = renderFamily(single);
    assert.doesNotMatch(html, /class="seg-btn"/);
  }
});

test('renderFamily defaults the toggle to the latest year, and the count matches the hero', () => {
  const html = renderFamily(bambiFam); // spans 2026 + 2025
  // the latest-year button is the active one (not "All")
  assert.match(html, /class="seg-btn is-active" data-year="2026"/);
  // an "All years" option still exists
  assert.match(html, /data-year="all">All years</);
  // on load, only the latest model year's cards are visible; the rest are hidden
  const latestCount = bambiFam.trailers.filter((t) => t.year === 2026).length;
  const visible = (html.match(/class="card"[^>]*>/g) || []).filter((c) => !/ hidden/.test(c)).length;
  assert.equal(visible, latestCount);
  // visible count equals the distinct floorplan count shown in the hero
  assert.equal(latestCount, bambiFam.floorplanCount);
  assert.match(html, new RegExp(`id="result-count">${latestCount} floorplan`));
});

test('single-year family shows all its cards with none hidden', () => {
  const single = families.find((f) => f.years.length === 1);
  if (!single) return;
  const html = renderFamily(single);
  const hiddenCards = (html.match(/class="card"[^>]* hidden/g) || []).length;
  assert.equal(hiddenCards, 0);
});

test('every family renders without throwing', () => {
  for (const f of families) {
    const html = renderFamily(f);
    assert.ok(html.startsWith('<!DOCTYPE html>'), f.slug);
    assert.ok(html.includes(f.family), f.slug);
  }
});

test('renderDetail has full spec table with audited numbers', () => {
  const html = renderDetail(classic);
  assert.ok(html.startsWith('<!DOCTYPE html>'));
  assert.ok(html.trimEnd().endsWith('</html>'));
  assert.match(html, /\$222,900/);
  assert.match(html, /8,425 lb/);          // dry weight
  assert.match(html, /10,000 lb/);         // gvwr
  assert.match(html, /1,575 lb/);          // ccc
  assert.match(html, /Cargo capacity/);
  assert.match(html, /Off-grid score/);
  // back link now points at the family page
  assert.match(html, /href="\.\.\/f\/classic\.html"/);
  assert.match(html, /← All Classic floorplans/);
  assert.match(html, /\.\.\/assets\/img\/heroes\/classic\.webp/);
});

test('renderDetail renders an official floor-plan section when a diagram resolves', () => {
  const resolve = (t) => ({
    thumb: `assets/img/thumbs/${t.slug}.webp`,
    hero: `assets/img/heroes/classic.webp`,
    gallery: [],
    floorplan: `assets/img/floorplans/${t.slug}.webp`,
  });
  const html = renderDetail(classic, resolve);
  assert.match(html, /<section class="floorplan"/);
  assert.match(html, /Floor plan/);
  assert.match(html, new RegExp(`assets/img/floorplans/${classic.slug}\\.webp`));
  assert.match(html, /Official Airstream 33FB floor plan/);
});

test('renderDetail omits the floor-plan section when no diagram resolves', () => {
  const resolve = (t) => ({
    thumb: `assets/img/thumbs/${t.slug}.webp`,
    hero: `assets/img/heroes/classic.webp`,
    gallery: [],
    floorplan: null,
  });
  const html = renderDetail(classic, resolve);
  assert.doesNotMatch(html, /<section class="floorplan"/);
});

test('renderDetail renders an official décor section with scheme names + swatches', () => {
  const resolve = (t) => ({ thumb: '', hero: null, gallery: [], floorplan: null });
  const decor = [
    {
      name: 'Comfort White with Earl Grey Ultraleather®',
      slug: 'comfort-white-with-earl-grey-ultraleather',
      description: 'Shaker-style cabinets in a white finish.',
      swatches: [
        { kind: 'Interior', src: 'assets/img/decor/classic-cw-eg-sw1.webp' },
        { kind: 'Upholstery', src: 'assets/img/decor/classic-cw-eg-sw2.webp' },
      ],
    },
  ];
  const html = renderDetail(classic, resolve, null, decor);
  assert.match(html, /<section class="decor"/);
  assert.match(html, /Interior décor options/);
  assert.match(html, /Comfort White with Earl Grey Ultraleather/);
  assert.match(html, /Shaker-style cabinets in a white finish\./);
  assert.match(html, /assets\/img\/decor\/classic-cw-eg-sw1\.webp/);
  assert.match(html, /<figcaption>Interior<\/figcaption>/);
  assert.match(html, /<figcaption>Upholstery<\/figcaption>/);
});

test('renderDetail omits the décor section when no schemes resolve', () => {
  const resolve = (t) => ({ thumb: '', hero: null, gallery: [], floorplan: null });
  assert.doesNotMatch(renderDetail(classic, resolve, null, []), /<section class="decor"/);
  assert.doesNotMatch(renderDetail(classic, resolve, null, null), /<section class="decor"/);
});

test('renderDetail escapes décor names + descriptions (no raw HTML injection)', () => {
  const resolve = (t) => ({ thumb: '', hero: null, gallery: [], floorplan: null });
  const decor = [
    {
      name: '<b>Evil</b>', slug: 'x', description: '<script>alert(1)</script>',
      swatches: [{ kind: '<i>k</i>', src: 'assets/img/decor/x.webp' }],
    },
  ];
  const html = renderDetail(classic, resolve, null, decor);
  assert.ok(!html.includes('<b>Evil</b>'));
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.match(html, /&lt;b&gt;Evil/);
});

test('renderDetail escapes and never emits raw script payloads from data', () => {
  const evil = { ...classic, description: '<img src=x onerror=alert(1)>', model: 'X', floorplan: '1Y', slug: 'x-1y-2026', tags: [], pros: [], cons: [] };
  const html = renderDetail(evil);
  assert.ok(!html.includes('<img src=x onerror'));
  assert.match(html, /&lt;img src=x onerror/);
});

test('every trailer renders a detail page without throwing', () => {
  for (const t of trailers) {
    const html = renderDetail(t);
    assert.ok(html.startsWith('<!DOCTYPE html>'), t.slug);
    assert.ok(html.includes('Specifications'), t.slug);
  }
});

test('no detail page contains an unescaped data-driven angle bracket in body text', () => {
  for (const t of trailers) {
    const html = renderDetail(t);
    const scripts = html.match(/<script/g) || [];
    assert.equal(scripts.length, 1, `${t.slug} has unexpected <script> count`);
  }
});

import { renderExplore, renderCompare, renderExploreCard } from '../src/lib/render.mjs';

test('renderExplore embeds every floorplan as an xcard with tow data', () => {
  const html = renderExplore(trailers);
  const cards = (html.match(/class="xcard"/g) || []).length;
  assert.equal(cards, trailers.length);
  assert.match(html, /id="tow-input"/);
  assert.match(html, /data-gvwr=/);
  assert.match(html, /Explore &amp; match/);
});

test('renderExploreCard carries the numeric attributes the client sorts on', () => {
  const t = trailers.find((x) => x.slug === 'classic-33fb-2026');
  const html = renderExploreCard(t);
  assert.match(html, /data-msrp="222900"/);
  assert.match(html, /data-gvwr="10000"/);
  assert.match(html, /data-sleeps="5"/);
  assert.match(html, /data-tags="[^"]*off-grid/);
});

test('renderCompare embeds a valid, XSS-safe JSON island of all trailers', () => {
  const html = renderCompare(trailers);
  const m = html.match(/<script type="application\/json" id="cmp-data">([\s\S]*?)<\/script>/);
  assert.ok(m, 'has json island');
  // raw island must not contain an unescaped </ that could break out of the tag
  assert.ok(!/<\//.test(m[1]), 'no unescaped </ in island');
  const data = JSON.parse(m[1].replace(/\\u003c/g, '<'));
  assert.equal(data.length, trailers.length);
  assert.ok(data[0].slug && data[0].msrp && data[0].thumb);
});

test('detail page renders the towing callout from official GVWR (no derived rating)', () => {
  const t = trailers.find((x) => x.slug === 'flying-cloud-25fb-2026');
  const html = renderDetail(t);
  assert.match(html, /class="tow-callout"/);
  assert.match(html, /Your tow vehicle must be rated for at least/);
  assert.match(html, /fully-loaded GVWR/);
  assert.match(html, /official Airstream GVWR/);
  // shows the real GVWR (7,300 lb), not a derived "recommended rating"
  assert.match(html, /7,300\s*lb/);
  assert.doesNotMatch(html, /Recommended minimum tow rating/);
});

test('top nav is exactly the 3 consolidated tabs — no Compare/Community/Explore tab', () => {
  for (const html of [renderIndex(groupByFamily(trailers), trailers), renderExplore(trailers), renderCompare(trailers)]) {
    assert.match(html, /class="topnav-links"/);
    // exactly three top-level nav links
    const nav = html.match(/<nav class="topnav-links"[^>]*>([\s\S]*?)<\/nav>/);
    assert.ok(nav, 'has a topnav-links nav');
    const links = nav[1].match(/<a /g) || [];
    assert.equal(links.length, 3, 'exactly 3 top tabs');
    // the three tabs are Explore (index) / Campgrounds / Upgrades
    assert.match(nav[1], /href="index\.html"[^>]*>Explore</);
    assert.match(nav[1], /href="campgrounds\.html"[^>]*>Campgrounds</);
    assert.match(nav[1], /href="upgrades\.html"[^>]*>Upgrades</);
    // Compare and Community are NOT top tabs anymore
    assert.doesNotMatch(nav[1], /compare\.html/);
    assert.doesNotMatch(nav[1], /community\.html/);
    assert.doesNotMatch(nav[1], />Families</);
  }
});

test('Compare + Community survive as footer destinations (not top tabs)', () => {
  const home = renderIndex(groupByFamily(trailers), trailers);
  const footer = home.match(/<footer[\s\S]*?<\/footer>/)[0];
  assert.match(footer, /compare\.html/);
  assert.match(footer, /community\.html/);
  assert.match(footer, /credits\.html/);
});

test('nav marks the current section as active (aria-current + is-active)', () => {
  // home (Explore hub) → Explore active
  const home = renderIndex(groupByFamily(trailers), trailers);
  assert.match(home, /<a href="index\.html" class="is-active" aria-current="page">Explore<\/a>/);
  assert.equal((home.match(/topnav-links[\s\S]*?<\/nav>/)[0].match(/aria-current="page"/g) || []).length, 1);
  // a detail page (nested) keeps the Explore hub active with the right relRoot prefix
  const detail = renderDetail(classic);
  assert.match(detail, /href="\.\.\/index\.html" class="is-active" aria-current="page"/);
  assert.equal((detail.match(/topnav-links[\s\S]*?<\/nav>/)[0].match(/aria-current="page"/g) || []).length, 1);
});

test('Explore hub serves both views server-rendered, with an editorial toggle', () => {
  const html = renderIndex(groupByFamily(trailers), trailers);
  // editorial segmented control (NOT a .seg-btn / SaaS pill) with both modes
  assert.match(html, /class="viewseg"/);
  assert.match(html, /data-view="families"/);
  assert.match(html, /data-view="all"/);
  // both views present in the static HTML (progressive enhancement)
  assert.match(html, /id="view-families"/);
  assert.match(html, /id="view-all"/);
  // By-family view carries the 12 family cards
  assert.equal((html.match(/class="fam"/g) || []).length, 12);
  // All-floorplans view carries the full explore experience: every xcard, the
  // tow matcher, and the compare tray
  assert.equal((html.match(/class="xcard"/g) || []).length, trailers.length);
  assert.match(html, /id="tow-input"/);
  assert.match(html, /id="cmp-bar"/);
  // deep-linkable: hero CTA + toggle target the #all / #families hashes
  assert.match(html, /href="#all"/);
  assert.match(html, /href="#families"/);
});

test('home leads with a cinematic hero band backed by a distinct hero image', () => {
  const fams = groupByFamily(trailers);
  const html = renderIndex(fams, trailers);
  assert.match(html, /class="home-hero"/);
  // hero <img> points at a real family hero file (International, by design)
  const heroFam = fams.find((f) => f.family === 'International') || fams.find((f) => f.hero);
  assert.match(html, new RegExp(`class="home-hero-img" src="${heroFam.hero.replace(/[/.]/g, '\\$&')}"`));
  // and it is deliberately NOT the same image as the first (flagship) card,
  // so the opening viewport isn't the same picture twice
  assert.notEqual(heroFam.hero, fams[0].hero);
  // headline + primary CTA that switches to the all-floorplans view (in-page)
  assert.match(html, /Every Airstream, by family/);
  assert.match(html, /class="home-hero-btn" href="#all"/);
});

import { renderOffGridTool } from '../src/lib/render.mjs';

test('detail page includes the off-grid estimator with real spec data attrs', () => {
  const t = trailers.find((x) => x.slug === 'classic-33fb-2026');
  const html = renderDetail(t);
  assert.match(html, /class="estimator offgrid-tool"/);
  assert.match(html, /How long off-grid\?/);
  // Carries this trailer's REAL specs for the client to recompute from.
  assert.match(html, new RegExp(`data-battery="${t.batteryKwh}"`));
  assert.match(html, new RegExp(`data-fresh="${t.freshGal}"`));
  assert.match(html, /How this is calculated/); // method disclosure present
  assert.match(html, /excluding air conditioning|excludes air conditioning|<strong>excluding air conditioning/i);
});

test('off-grid tool omits itself when inputs are missing (no fabrication)', () => {
  const bare = { model: 'X', floorplan: 'Y', batteryKwh: 0, freshGal: 0 };
  assert.equal(renderOffGridTool(bare), '');
});
