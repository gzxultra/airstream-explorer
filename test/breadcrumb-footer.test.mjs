import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderDetail, renderFamily } from '../src/lib/render.mjs';
import { renderMotorhomeDetail, renderMotorhomeFamily } from '../src/lib/motorhome-render.mjs';
import { breadcrumbJsonLd } from '../src/lib/seo.mjs';
import { loadTrailers } from '../src/lib/data.mjs';
import { loadMotorhomes, groupMotorhomesByFamily } from '../src/lib/motorhome-data.mjs';

const trailers = loadTrailers();
const motorhomes = loadMotorhomes();

// ---------------------------------------------------------------------------
// breadcrumbJsonLd
// ---------------------------------------------------------------------------

test('breadcrumbJsonLd returns empty for 0 or 1 items', () => {
  assert.equal(breadcrumbJsonLd([]), '');
  assert.equal(breadcrumbJsonLd([{ name: 'Home', path: '/' }]), '');
  assert.equal(breadcrumbJsonLd(null), '');
});

test('breadcrumbJsonLd produces valid BreadcrumbList JSON-LD', () => {
  const items = [
    { name: 'Airstream Explorer', path: 'index.html' },
    { name: 'Classic', path: 'f/classic.html' },
    { name: 'Classic 33FB', path: 'm/classic-33fb-2026.html' },
  ];
  const html = breadcrumbJsonLd(items);
  assert.match(html, /<script type="application\/ld\+json">/);
  const json = JSON.parse(html.replace(/<script[^>]*>/, '').replace(/<\/script>/, ''));
  assert.equal(json['@type'], 'BreadcrumbList');
  assert.equal(json.itemListElement.length, 3);
  assert.equal(json.itemListElement[0].position, 1);
  assert.equal(json.itemListElement[0].name, 'Airstream Explorer');
  assert.equal(json.itemListElement[2].position, 3);
  assert.match(json.itemListElement[2].item, /classic-33fb-2026/);
});

// ---------------------------------------------------------------------------
// Trailer detail breadcrumb
// ---------------------------------------------------------------------------

test('trailer detail page has breadcrumb nav with Home → Family → Floorplan', () => {
  const t = trailers.find((x) => x.slug === 'classic-33fb-2026');
  const html = renderDetail(t, undefined, null, trailers);
  assert.match(html, /aria-label="Breadcrumb"/);
  assert.match(html, /class="breadcrumb-list"/);
  // Home link
  assert.match(html, /<a href="\.\.\/index\.html">Home<\/a>/);
  // Family link
  assert.match(html, /<a href="\.\.\/f\/classic\.html">Classic<\/a>/);
  // Current page
  assert.match(html, /aria-current="page">33FB</);
  // BreadcrumbList JSON-LD in head
  assert.match(html, /BreadcrumbList/);
});

// ---------------------------------------------------------------------------
// Family page breadcrumb
// ---------------------------------------------------------------------------

test('trailer family page has breadcrumb nav with Home → Family', () => {
  const classic = trailers.filter((t) => t.model === 'Classic');
  const fam = {
    family: 'Classic', slug: 'classic', hero: 'assets/img/heroes/classic.webp',
    priceMin: 190400, priceMax: 222900, lengthMin: 28.83, lengthMax: 33.25,
    floorplanCount: classic.length, sleepsMax: 5, years: [2026, 2025],
    trailers: classic, limited: false,
  };
  const html = renderFamily(fam);
  assert.match(html, /aria-label="Breadcrumb"/);
  assert.match(html, /<a href="\.\.\/index\.html">Home<\/a>/);
  assert.match(html, /aria-current="page">Classic</);
  // JSON-LD
  assert.match(html, /BreadcrumbList/);
});

// ---------------------------------------------------------------------------
// Motorhome detail breadcrumb
// ---------------------------------------------------------------------------

test('motorhome detail page has breadcrumb nav', () => {
  const m = motorhomes.find((x) => x.slug === 'atlas-25ms-2027');
  const html = renderMotorhomeDetail(m);
  assert.match(html, /aria-label="Breadcrumb"/);
  assert.match(html, /<a href="\.\.\/motorhomes\.html">Touring coaches<\/a>/);
  assert.match(html, /aria-current="page"/);
  assert.match(html, /BreadcrumbList/);
});

// ---------------------------------------------------------------------------
// Motorhome family page breadcrumb
// ---------------------------------------------------------------------------

test('motorhome family page has breadcrumb nav', () => {
  const families = groupMotorhomesByFamily(motorhomes);
  const fam = families.find((f) => f.slug === 'atlas');
  if (fam) {
    const html = renderMotorhomeFamily(fam);
    assert.match(html, /aria-label="Breadcrumb"/);
    assert.match(html, /<a href="\.\.\/motorhomes\.html">Touring coaches<\/a>/);
    assert.match(html, /BreadcrumbList/);
  }
});

// ---------------------------------------------------------------------------
// Editorial footer (multi-column)
// ---------------------------------------------------------------------------

test('pages have multi-column editorial footer', () => {
  const t = trailers.find((x) => x.slug === 'classic-33fb-2026');
  const html = renderDetail(t, undefined, null, trailers);
  assert.match(html, /class="footer-grid"/);
  assert.match(html, /class="footer-heading"/);
  assert.match(html, /class="footer-links"/);
  assert.match(html, /class="footer-legal/);
  // Check all 4 columns exist
  assert.match(html, /Browse/);
  assert.match(html, /Plan your trip/);
  assert.match(html, /Community/);
  assert.match(html, /Airstream Explorer/);
  // External link
  assert.match(html, /airstream\.com/);
});

test('motorhome pages also have editorial footer', () => {
  const m = motorhomes.find((x) => x.slug === 'atlas-25ms-2027');
  const html = renderMotorhomeDetail(m);
  assert.match(html, /class="footer-grid"/);
  assert.match(html, /class="footer-heading"/);
});

// ---------------------------------------------------------------------------
// Floorplan zoom button (lightbox trigger)
// ---------------------------------------------------------------------------

test('detail page wraps floorplan in a lightbox-triggerable zoom button', () => {
  const t = trailers.find((x) => x.slug === 'classic-33fb-2026');
  const html = renderDetail(t, undefined, null, trailers);
  assert.match(html, /class="floorplan-zoom-btn"/);
  assert.match(html, /data-lightbox/);
  assert.match(html, /Tap to enlarge/);
  // floorplan image should be inside the button
  assert.match(html, /floorplan-zoom-btn[^]*floorplan-img/);
});
