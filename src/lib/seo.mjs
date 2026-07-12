// ---------------------------------------------------------------------------
// SEO + social-share metadata
// ---------------------------------------------------------------------------
// Every page is shareable (the whole point of this catalog) and we want it to
// surface a real title card + preview image in WeChat / Telegram / iMessage /
// Twitter / Slack, and to be eligible for Google rich results. This module is
// the single source of truth for that <head> metadata so both page shells
// (trailers in render.mjs, motorhomes in motorhome-render.mjs) stay identical.
//
// IMPORTANT — absolute URLs: social crawlers do NOT resolve relative paths, so
// og:image / og:url / canonical must be absolute. We emit canonical image
// paths (assets/img/...) behind SITE_ORIGIN; the build's fingerprint pass
// rewrites the 'assets/img/..' tail to its hashed name wherever it appears
// (it's a plain substring swap), so the absolute prefix survives untouched.

// Self-contained escape — seo.mjs is imported by BOTH page shells
// (render.mjs and motorhome-render.mjs), so it must not import from either,
// or it would create a circular dependency. This is the same entity set as
// render.mjs's esc().
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Production origin (Cloudflare Pages, custom domain can be swapped here later).
// No trailing slash.
export const SITE_ORIGIN = 'https://airstream-explorer.pages.dev';

// Brand default share image, used when a page has no model-specific hero
// (home, compare, campsites, etc.). A real on-disk hero, fingerprinted by the
// build like any other image reference.
export const DEFAULT_OG_IMAGE = 'assets/img/heroes/classic.webp';

const SITE_NAME = 'Airstream Explorer';

/** Join SITE_ORIGIN + a root-relative path into one clean absolute URL. */
export function absUrl(rootRelPath) {
  if (!rootRelPath) return SITE_ORIGIN + '/';
  const clean = String(rootRelPath).replace(/^\.?\/+/, '').replace(/^(\.\.\/)+/, '');
  return `${SITE_ORIGIN}/${clean}`;
}

/**
 * Favicon / app-icon / theme-color <head> block. Same markup on every page so
 * the browser tab, iOS home-screen, Android install banner and WeChat/Telegram
 * link cards all get a real brand mark instead of a blank globe. Icon files are
 * served from the site root (NOT fingerprinted — conventional fixed names that
 * crawlers and the webmanifest reference by path), so we prefix with relRoot to
 * stay correct from pages nested under m/, mm/, f/, mf/.
 *
 * @param {string} [relRoot] '' at site root, '../' for detail pages
 * @returns {string} HTML <link>/<meta> lines for icons + theme color + manifest
 */
export function iconMeta(relRoot = '') {
  return [
    `<link rel="icon" href="${relRoot}favicon.svg" type="image/svg+xml">`,
    `<link rel="icon" href="${relRoot}favicon.ico" sizes="any">`,
    `<link rel="apple-touch-icon" href="${relRoot}apple-touch-icon.png">`,
    `<link rel="manifest" href="${relRoot}site.webmanifest">`,
    `<meta name="theme-color" content="#1F1B16">`,
    `<meta name="apple-mobile-web-app-title" content="Airstream Explorer">`,
  ].join('\n');
}

/**
 * Build the Open Graph / Twitter / canonical <head> block.
 *
 * @param {object} o
 * @param {string} o.title         page title (already human-readable, unescaped)
 * @param {string} o.description   meta description (unescaped)
 * @param {string} [o.canonicalPath] root-relative page path, e.g. 'm/classic-33fb-2026.html'
 * @param {string} [o.imagePath]   root-relative image path (canonical, pre-hash);
 *                                  falls back to the brand default
 * @param {string} [o.type]        og:type ('website' | 'article' | 'product')
 * @returns {string} HTML <meta>/<link> lines for the document head
 */
export function socialMeta({ title, description, canonicalPath = '', imagePath, type = 'website' } = {}) {
  const img = absUrl(imagePath || DEFAULT_OG_IMAGE);
  const url = absUrl(canonicalPath);
  const t = esc(title || SITE_NAME);
  const d = esc(description || '');
  return [
    `<link rel="canonical" href="${esc(url)}">`,
    `<meta property="og:site_name" content="${esc(SITE_NAME)}">`,
    `<meta property="og:type" content="${esc(type)}">`,
    `<meta property="og:title" content="${t}">`,
    `<meta property="og:description" content="${d}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:image" content="${esc(img)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${t}">`,
    `<meta name="twitter:description" content="${d}">`,
    `<meta name="twitter:image" content="${esc(img)}">`,
  ].join('\n');
}

/**
 * Product structured data (schema.org/Product) for a model detail page, so
 * Google can understand each floorplan as a distinct product and surface a
 * richer result (name, image, brand).
 *
 * DELIBERATELY no `offers`/price: this is an independent enthusiast reference,
 * not a storefront. We never emit a commercial/buyable signal — Product +
 * brand + category + image is valid structured data on its own.
 *
 * @param {object} o
 * @param {string} o.name        full model name
 * @param {string} o.description meta description
 * @param {string} [o.imagePath] root-relative hero (canonical, pre-hash)
 * @param {string} [o.canonicalPath] root-relative page path
 * @param {string} [o.category] e.g. 'Travel Trailer', 'Class B Motorhome'
 * @returns {string} a <script type="application/ld+json"> block
 */
export function productJsonLd({ name, description, imagePath, canonicalPath = '', category = 'Travel Trailer' } = {}) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description,
    image: absUrl(imagePath || DEFAULT_OG_IMAGE),
    url: absUrl(canonicalPath),
    category,
    brand: { '@type': 'Brand', name: 'Airstream' },
  };
  // JSON.stringify already escapes </ safely for our content, but guard the
  // script-close sequence defensively in case any field ever contains it.
  const json = JSON.stringify(data).replace(/<\//g, '<\\/');
  return `<script type="application/ld+json">${json}</script>`;
}

/**
 * BreadcrumbList structured data (schema.org/BreadcrumbList) for navigation and
 * SEO. Produces a <script type="application/ld+json"> block that helps search
 * engines understand the page hierarchy.
 *
 * @param {Array<{name: string, path: string}>} items ordered breadcrumb items;
 *        each carries a human-readable name and a root-relative path. The last
 *        item is the current page (no link in the visual trail, but still
 *        present in the structured data).
 * @returns {string} a <script type="application/ld+json"> block
 */
export function breadcrumbJsonLd(items) {
  if (!items || items.length < 2) return '';
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: absUrl(it.path),
    })),
  };
  const json = JSON.stringify(data).replace(/<\//g, '<\\/');
  return `<script type="application/ld+json">${json}</script>`;
}

/**
 * FAQPage structured data (schema.org/FAQPage) for a model detail page.
 * Each question-answer pair becomes a mainEntity entry so Google can surface
 * rich FAQ results. All answers are derived from real spec data — nothing
 * fabricated.
 *
 * @param {Array<{question: string, answer: string}>} faqs
 * @returns {string} a <script type="application/ld+json"> block, or '' if empty
 */
export function faqJsonLd(faqs) {
  if (!faqs || faqs.length === 0) return '';
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
  const json = JSON.stringify(data).replace(/<\//g, '<\\/');
  return `<script type="application/ld+json">${json}</script>`;
}
