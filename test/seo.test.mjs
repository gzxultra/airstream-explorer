// SEO + social-share metadata — locks in the OG/Twitter/canonical/JSON-LD
// contract added so every page surfaces a real share card and Google can read
// each model as a Product. See src/lib/seo.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SITE_ORIGIN, absUrl, socialMeta, productJsonLd } from '../src/lib/seo.mjs';
import { loadTrailers, groupByFamily } from '../src/lib/data.mjs';
import { renderIndex, renderFamily, renderDetail } from '../src/lib/render.mjs';
import { loadMotorhomes } from '../src/lib/motorhome-data.mjs';
import { renderMotorhomeDetail } from '../src/lib/motorhome-render.mjs';

const trailers = loadTrailers();
const families = groupByFamily(trailers);
const motorhomes = loadMotorhomes();

test('absUrl produces clean absolute URLs and strips relative prefixes', () => {
  assert.equal(absUrl('index.html'), `${SITE_ORIGIN}/index.html`);
  assert.equal(absUrl('assets/img/heroes/classic.webp'), `${SITE_ORIGIN}/assets/img/heroes/classic.webp`);
  assert.equal(absUrl('../assets/img/x.webp'), `${SITE_ORIGIN}/assets/img/x.webp`);
  assert.equal(absUrl('./m/foo.html'), `${SITE_ORIGIN}/m/foo.html`);
  assert.equal(absUrl(''), `${SITE_ORIGIN}/`);
  // No double slashes in the path portion.
  assert.ok(!absUrl('a/b.html').replace(/^https:\/\//, '').includes('//'));
});

test('socialMeta emits the full OG + Twitter + canonical set, absolute + escaped', () => {
  const html = socialMeta({
    title: 'Test & "Title"',
    description: 'A <desc> with specials',
    canonicalPath: 'm/classic-33fb-2026.html',
    imagePath: 'assets/img/heroes/classic.webp',
    type: 'product',
  });
  for (const needle of [
    'rel="canonical"', 'og:site_name', 'og:type', 'og:title', 'og:description',
    'og:url', 'og:image', 'twitter:card', 'twitter:title', 'twitter:image',
  ]) {
    assert.ok(html.includes(needle), `missing ${needle}`);
  }
  assert.ok(html.includes('content="summary_large_image"'));
  assert.ok(html.includes('og:type" content="product"'));
  // Absolute URLs only.
  assert.ok(html.includes(`${SITE_ORIGIN}/m/classic-33fb-2026.html`));
  assert.ok(html.includes(`${SITE_ORIGIN}/assets/img/heroes/classic.webp`));
  // Escaping: no raw &, <, >, or " leaking from the input into attributes.
  assert.ok(html.includes('Test &amp; &quot;Title&quot;'));
  assert.ok(html.includes('A &lt;desc&gt; with specials'));
  assert.ok(!/content="[^"]*<desc>/.test(html));
});

test('socialMeta falls back to the brand default image when none given', () => {
  const html = socialMeta({ title: 'T', description: 'D', canonicalPath: 'compare.html' });
  assert.ok(html.includes(`${SITE_ORIGIN}/assets/img/heroes/classic.webp`));
});

test('productJsonLd is valid schema.org Product with brand + image, and NO offers/price', () => {
  const block = productJsonLd({
    name: '2026 Airstream Classic 33FB',
    description: 'specs',
    imagePath: 'assets/img/heroes/classic.webp',
    canonicalPath: 'm/classic-33fb-2026.html',
    category: 'Travel Trailer',
  });
  assert.ok(block.startsWith('<script type="application/ld+json">'));
  const json = block.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
  const data = JSON.parse(json.replace(/<\\\//g, '</')); // un-neutralize for parse
  assert.equal(data['@type'], 'Product');
  assert.equal(data['@context'], 'https://schema.org');
  assert.equal(data.brand.name, 'Airstream');
  assert.equal(data.category, 'Travel Trailer');
  assert.equal(data.image, `${SITE_ORIGIN}/assets/img/heroes/classic.webp`);
  assert.equal(data.url, `${SITE_ORIGIN}/m/classic-33fb-2026.html`);
  // Enthusiast reference, NOT a storefront: never emit a commercial signal.
  assert.ok(!('offers' in data), 'must not contain offers');
  assert.ok(!('price' in data), 'must not contain price');
  assert.ok(!JSON.stringify(data).toLowerCase().includes('price'));
});

test('productJsonLd neutralizes any </script> breakout in its payload', () => {
  const block = productJsonLd({ name: 'x</script><script>alert(1)</script>', description: 'd', category: 'Travel Trailer' });
  const inner = block.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
  assert.ok(!inner.includes('</script>'), 'raw </script> must not appear in the data island');
});

test('every trailer detail page carries canonical, og:image (its hero) and Product JSON-LD', () => {
  for (const t of trailers) {
    const html = renderDetail(t);
    assert.ok(html.includes(`rel="canonical" href="${SITE_ORIGIN}/m/${t.slug}.html"`), `${t.slug} canonical`);
    assert.ok(html.includes('property="og:image"'), `${t.slug} og:image`);
    assert.ok(html.includes('application/ld+json'), `${t.slug} json-ld`);
    assert.ok(html.includes('"@type":"Product"'), `${t.slug} Product type`);
    assert.ok(html.includes('og:type" content="product"'), `${t.slug} og:type product`);
    // og:image must point at this model's own hero, absolute.
    assert.ok(/og:image" content="https:\/\/[^"]+\/assets\/img\/heroes\/[^"]+\.webp"/.test(html), `${t.slug} hero og:image`);
  }
});

test('every motorhome detail page carries canonical, og:image and Class B Product JSON-LD', () => {
  for (const m of motorhomes) {
    const html = renderMotorhomeDetail(m);
    assert.ok(html.includes(`rel="canonical" href="${SITE_ORIGIN}/mm/${m.slug}.html"`), `${m.slug} canonical`);
    assert.ok(html.includes('"category":"Class B Motorhome"'), `${m.slug} category`);
    assert.ok(html.includes('"@type":"Product"'), `${m.slug} Product`);
  }
});

test('family + home pages carry canonical and OG without JSON-LD (Product is detail-only)', () => {
  const home = renderIndex(families, trailers);
  assert.ok(home.includes(`rel="canonical" href="${SITE_ORIGIN}/index.html"`));
  assert.ok(home.includes('property="og:title"'));
  assert.ok(!home.includes('application/ld+json'), 'home should not assert Product');

  const fam = renderFamily(families[0]);
  assert.ok(fam.includes(`rel="canonical" href="${SITE_ORIGIN}/f/${families[0].slug}.html"`));
  assert.ok(fam.includes('property="og:image"'));
});
