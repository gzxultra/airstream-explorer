import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTrailers, groupByFamily } from '../src/lib/data.mjs';
import { esc, renderCard, renderFamilyCard, renderIndex, renderFamily, renderDetail, renderDecor } from '../src/lib/render.mjs';

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

test('home subhead and footer agree on the floorplan count (records)', () => {
  const html = renderIndex(families);
  const distinct = families.reduce((n, f) => n + f.floorplanCount, 0); // 31 trailers
  // subhead lede — in families-only mode shows trailer totals
  assert.match(html, new RegExp(`${families.length} families, ${distinct} floorplans`));
  // footer must use the SAME records metric as the hero: 58 trailer records +
  // 11 motorhome records = 69 across 15 families (12+3). No mixing records
  // with the distinct-layout count (42).
  assert.match(html, /69 floorplans across 15 families/);
  assert.doesNotMatch(html, /42 floorplans across/);
  // guard against stale hardcoded literals creeping back in
  assert.ok(distinct !== 0 && families.length !== 0);
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

test('renderFamily shows all of a family\'s floorplans with hero + breadcrumb', () => {
  const html = renderFamily(classicFam);
  assert.ok(html.startsWith('<!DOCTYPE html>'));
  assert.match(html, /aria-label="Breadcrumb"/);
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
  assert.match(html, new RegExp(`id="result-count"[^>]*>${latestCount} floorplan`));
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
  // breadcrumb points at the family page
  assert.match(html, /href="\.\.\/f\/classic\.html"/);
  assert.match(html, /aria-label="Breadcrumb"/);
  assert.match(html, /aria-current="page"/);
  // breadcrumb JSON-LD
  assert.match(html, /BreadcrumbList/);
  assert.match(html, /\.\.\/assets\/img\/heroes\/classic\.webp/);
});

test('renderDetail labels standard vs optional factory solar (no bare wattage)', () => {
  // Classic 33FB ships solar as standard equipment.
  const stdHtml = renderDetail(classic);
  assert.match(stdHtml, /300 W \(standard\)/);
  // Bambi 16RB's 100 W solar is a factory OPTION, not standard. It must read
  // "(optional)" — a bare "100 W" would look identical to standard-equipped
  // models and hide that it's a paid add-on. (43 of 58 trailers are optional.)
  const optional = trailers.find((t) => t.slug === 'bambi-16rb-2026');
  assert.equal(optional.solarStandard, false, 'fixture precondition: Bambi 16RB solar is optional');
  const optHtml = renderDetail(optional);
  assert.match(optHtml, /100 W \(optional\)/);
  assert.doesNotMatch(optHtml, /100 W \(standard\)/);
});

test('renderDetail renders an official floor-plan section when a diagram resolves', () => {
  const resolve = (t) => ({
    thumb: `assets/img/thumbs/${t.slug}.webp`,
    hero: `assets/img/heroes/classic.webp`,
    gallery: [],
    floorplan: `assets/img/floorplans/${t.slug}.webp`,
  });
  const html = renderDetail(classic, resolve);
  assert.match(html, /<section class="dsec floorplan/);
  assert.match(html, /dsec-title">Floor plan/);
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
  assert.doesNotMatch(html, /<section class="dsec floorplan/);
});

test('renderDetail does not render a décor section (redesign 2026-09-27: décor moved to family pages)', () => {
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
  const html = renderDetail(classic, resolve, decor);
  assert.doesNotMatch(html, /<section class="decor"/);
  assert.doesNotMatch(html, /Interior décor options/);
});

test('renderDetail omits the décor section when no schemes resolve', () => {
  const resolve = (t) => ({ thumb: '', hero: null, gallery: [], floorplan: null });
  assert.doesNotMatch(renderDetail(classic, resolve, []), /<section class="decor"/);
  assert.doesNotMatch(renderDetail(classic, resolve, null), /<section class="decor"/);
});

test('renderDecor still escapes names + descriptions (no raw HTML injection)', () => {
  const decor = [
    {
      name: '<b>Evil</b>', slug: 'x', description: '<script>alert(1)</script>',
      swatches: [{ kind: '<i>k</i>', src: 'assets/img/decor/x.webp' }],
    },
  ];
  const html = renderDecor(decor, 'Classic');
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
    // Legitimate scripts: the <head> no-flash theme script, the deferred
    // app.js, the application/ld+json Product structured-data block, the
    // application/ld+json BreadcrumbList block, the application/ld+json FAQPage
    // block, plus up to 7 application/json data islands (tow-data, fuel-data,
    // payload-data, water-calc-data, propane-data, elec-data, grade-climb-data)
    // depending on trailer specs.
    // Finance data islands (finance-data, ownership-data, cost-night-data,
    // resale, trip-cost-data) were removed per ruling 1A (2026-09-27).
    // Minimum 5 (theme + app.js + ld+json product + ld+json breadcrumb + tow-data), maximum 12 (all tools + FAQ).
    assert.ok(scripts.length >= 5 && scripts.length <= 12, `${t.slug} has unexpected <script> count: ${scripts.length}`);
    // No data island (json OR ld+json) should contain a raw </ breakout.
    const islands = html.match(/<script type="application\/(?:ld\+)?json"[^>]*>([\s\S]*?)<\/script>/g) || [];
    for (const m of islands) {
      const content = m.replace(/<script[^>]*>/, '').replace(/<\/script>$/, '');
      assert.ok(!content.includes('</'), `${t.slug} data island has an un-neutralized </`);
    }
    const island = html.match(/<script type="application\/json" id="tow-data">([\s\S]*?)<\/script>/);
    assert.ok(island, `${t.slug} has the tow-data island`);
  }
});

import { renderTowTool } from '../src/lib/render.mjs';

test('renderTowTool: server-renders a real default pairing with verdict + 3 checks', () => {
  const html = renderTowTool(classic);
  assert.match(html, /class="towtool"/);
  assert.match(html, /id="tow-data"/);
  // A verdict banner with a grade class.
  assert.match(html, /class="tow-verdict (tow-ok|tow-tight|tow-over)"/);
  // Exactly the three checks (tow / payload / gcwr).
  assert.match(html, /data-key="tow"/);
  assert.match(html, /data-key="payload"/);
  assert.match(html, /data-key="gcwr"/);
  // Method disclosure present.
  assert.match(html, /How this is calculated/);
});

test('renderTowTool: every vehicle option carries a config string, and a source link is shown', () => {
  const html = renderTowTool(classic);
  // The default vehicle's sources render as real https links.
  assert.match(html, /href="https:\/\/[^"]+"[^>]*>source/);
  // The modeled-config line is present.
  assert.match(html, /Modeled config:/);
});

test('renderTowTool: the data island is valid JSON with the full vehicle table', () => {
  const html = renderTowTool(classic);
  const m = html.match(/<script type="application\/json" id="tow-data">([\s\S]*?)<\/script>/);
  assert.ok(m, 'data island present');
  // Un-neutralize the <\/ we added for safety, then parse.
  const parsed = JSON.parse(m[1].replace(/<\\\//g, '</'));
  assert.ok(Array.isArray(parsed.vehicles) && parsed.vehicles.length >= 10);
  assert.ok(parsed.defaultVehicleId, 'a default vehicle id is chosen');
  assert.ok(parsed.trailer && parsed.trailer.gvwrLb > 0, 'trailer gvwr carried');
  // Every vehicle in the island has the fields the client needs.
  for (const v of parsed.vehicles) {
    for (const k of ['id', 'name', 'config', 'maxTowLb', 'payloadLb', 'gcwrLb', 'curbWeightLb', 'sources']) {
      assert.ok(v[k] != null, `vehicle ${v.id} missing ${k}`);
    }
  }
});

test('renderTowTool: omits itself when the trailer lacks a GVWR (stays honest)', () => {
  const noGvwr = { ...classic, gvwrLb: 0 };
  assert.equal(renderTowTool(noGvwr), '');
});

import { renderExplore, renderCompare, renderExploreCard } from '../src/lib/render.mjs';

test('renderExplore embeds every floorplan in the #xdata payload with tow data', () => {
  const html = renderExplore(trailers);
  // Cards are client-rendered now: every floorplan arrives in the payload
  // with the GVWR the tow matcher needs.
  const m = html.match(/<script type="application\/json" id="xdata">([\s\S]*?)<\/script>/);
  assert.ok(m, '#xdata payload present');
  const items = JSON.parse(m[1]);
  assert.equal(items.length, trailers.length);
  assert.ok(items.every((i) => i.gvwrLb != null), 'every item carries GVWR');
  assert.match(html, /id="tow-input"/);
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

test('detail page renders the towing lede from official GVWR (no derived rating)', () => {
  const t = trailers.find((x) => x.slug === 'flying-cloud-25fb-2026');
  const html = renderDetail(t);
  assert.match(html, /class="tow-lede"/);
  assert.match(html, /Your tow vehicle must be rated for at least/);
  assert.match(html, /fully-loaded GVWR/);
  // shows the real GVWR (7,300 lb), not a derived "recommended rating"
  assert.match(html, /7,300\s*lb/);
  assert.doesNotMatch(html, /Recommended minimum tow rating/);
});

test('top nav is exactly the 3 redesign tabs — Explore / Compare / Owner\'s guide', () => {
  for (const html of [renderIndex(groupByFamily(trailers), trailers), renderExplore(trailers), renderCompare(trailers)]) {
    assert.match(html, /class="topnav-links"/);
    // three top-level nav links (2026-09 redesign: Saved lost its tab — save
    // buttons feed the compare tray now; Upgrades + Maintenance merged into
    // the Owner's guide page; motorhomes live inside the Explore grid)
    const nav = html.match(/<nav class="topnav-links"[^>]*>([\s\S]*?)<\/nav>/);
    assert.ok(nav, 'has a topnav-links nav');
    const links = nav[1].match(/<a /g) || [];
    assert.equal(links.length, 3, 'exactly 3 top tabs');
    // the three tabs are Explore (index) / Compare / Owner's guide
    assert.match(nav[1], /href="index\.html"[^>]*>[\s\S]*?<span>Explore<\/span>/);
    assert.match(nav[1], /href="compare\.html"[^>]*>[\s\S]*?<span>Compare<\/span>/);
    assert.match(nav[1], /href="owners-guide\.html"[^>]*>[\s\S]*?<span>Owner's guide<\/span>/);
    // each tab carries a monochrome 1.5px inline SVG icon (icon spec)
    const icons = nav[1].match(/<svg class="nav-icon"[^>]*stroke-width="1\.5"/g) || [];
    assert.equal(icons.length, 3, '3 nav icons at 1.5px stroke');
    // Motorhomes is no longer a top tab — it's a type filter inside Explore now
    assert.doesNotMatch(nav[1], /href="motorhomes\.html"/);
    // Saved, Upgrades, Maintenance, Campsites, Campgrounds, Stays, Community are NOT top tabs
    assert.doesNotMatch(nav[1], /saved\.html/);
    assert.doesNotMatch(nav[1], /upgrades\.html/);
    assert.doesNotMatch(nav[1], /maintenance\.html/);
    assert.doesNotMatch(nav[1], /campsites\.html/);
    assert.doesNotMatch(nav[1], /campgrounds\.html/);
    assert.doesNotMatch(nav[1], /stays\.html/);
    assert.doesNotMatch(nav[1], /community\.html/);
    assert.doesNotMatch(nav[1], />Families</);
  }
});

test('Compare + Motorhomes survive as footer destinations (not top tabs)', () => {
  const home = renderIndex(groupByFamily(trailers), trailers);
  const footer = home.match(/<footer[\s\S]*?<\/footer>/)[0];
  // Motorhomes is a footer entry that deep-links into the pre-filtered Explore grid
  assert.match(footer, /index\.html#all&type=motorhome/);
  assert.match(footer, />Motorhomes</);
  assert.match(footer, /compare\.html/);
  assert.match(footer, /credits\.html/);
});

test('nav marks the current section as active (aria-current + is-active)', () => {
  // home (Explore hub) → Explore active
  const home = renderIndex(groupByFamily(trailers), trailers);
  assert.match(home, /<a href="index\.html" class="is-active" aria-current="page">[\s\S]*?<span>Explore<\/span>/);
  assert.equal((home.match(/topnav-links[\s\S]*?<\/nav>/)[0].match(/aria-current="page"/g) || []).length, 1);
  // a detail page (nested) keeps the Explore hub active with the right relRoot prefix
  const detail = renderDetail(classic);
  assert.match(detail, /href="\.\.\/index\.html" class="is-active" aria-current="page"/);
  assert.equal((detail.match(/topnav-links[\s\S]*?<\/nav>/)[0].match(/aria-current="page"/g) || []).length, 1);
  // compare page → Compare tab active
  const compare = renderCompare(trailers);
  assert.match(compare, /<a href="compare\.html" class="is-active" aria-current="page">[\s\S]*?<span>Compare<\/span>/);
});

test('Explore hub serves both views, with an editorial toggle', () => {
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
  // All-floorplans view is client-rendered from the #xdata payload: every
  // floorplan arrives in the payload, plus the tow matcher and compare tray
  // in the static HTML
  const m = html.match(/<script type="application\/json" id="xdata">([\s\S]*?)<\/script>/);
  assert.ok(m, '#xdata payload present');
  assert.equal(JSON.parse(m[1]).length, trailers.length);
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

test('detail page sections appear in fixed order (redesign 2026-09-27)', () => {
  const trailers = loadTrailers();
  const t = trailers.find((x) => x.slug === 'classic-33fb-2026');
  const html = renderDetail(t, undefined, null, trailers);
  const sections = ['gallery', 'floorplan', 'specs', 'tow', 'offgrid', 'care', 'proscons', 'more'];
  // Verify the core sections are present in order
  let lastIdx = -1;
  for (const sec of sections) {
    const idx = html.indexOf(`id="${sec}"`);
    assert.ok(idx > lastIdx, `${sec} appears in order`);
    lastIdx = idx;
  }
});
