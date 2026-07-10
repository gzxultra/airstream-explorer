// Pure formatting helpers. No I/O, no DOM — trivially unit-testable.

/** Format a USD price. 222900 -> "$222,900". Null/0 -> "Price TBA". */
export function formatMsrp(n) {
  if (n == null || Number.isNaN(n) || n <= 0) return 'Price TBA';
  return '$' + Math.round(n).toLocaleString('en-US');
}

/** Format pounds. 8425 -> "8,425 lb". */
export function formatWeight(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return Math.round(n).toLocaleString('en-US') + ' lb';
}

/** Format length in feet. 33.25 -> "33' 3\"" (feet + inches). */
export function formatLength(ft) {
  if (ft == null || Number.isNaN(ft)) return '—';
  const whole = Math.floor(ft);
  const inches = Math.round((ft - whole) * 12);
  if (inches === 0) return `${whole}'`;
  if (inches === 12) return `${whole + 1}'`;
  return `${whole}' ${inches}"`;
}

/** Format gallons. 53 -> "53 gal", null -> "—". */
export function formatGal(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return `${+n.toFixed(n % 1 === 0 ? 0 : 1)} gal`;
}

/** Tank triple "fresh / gray / black". */
export function formatTanks(fresh, gray, black) {
  const f = fresh == null ? '—' : Math.round(fresh);
  const g = gray == null ? '—' : Math.round(gray);
  const b = black == null ? '—' : Math.round(black);
  return `${f} / ${g} / ${b}`;
}

/** Human title for a trailer. */
export function trailerTitle(t) {
  return `${t.year} Airstream ${t.model} ${t.floorplan}`;
}

/** Short label (no year). */
export function trailerLabel(t) {
  return `${t.model} ${t.floorplan}`;
}

/** Compact USD for ranges. 68900 -> "$69k", 222900 -> "$223k". */
export function formatMsrpShort(n) {
  if (n == null || Number.isNaN(n) || n <= 0) return 'TBA';
  if (n < 1000) return '$' + Math.round(n);
  return '$' + Math.round(n / 1000) + 'k';
}

/** A min–max price range. Equal ends collapse to one value. */
export function formatPriceRange(min, max) {
  if (min == null && max == null) return 'Price TBA';
  if (min === max || max == null) return 'from ' + formatMsrp(min);
  return formatMsrp(min) + ' – ' + formatMsrp(max);
}

/** A min–max length range in feet/inches. Equal ends collapse to one value. */
export function formatLengthRange(min, max) {
  if (min == null) return '—';
  if (min === max || max == null) return formatLength(min);
  return formatLength(min) + ' – ' + formatLength(max);
}

/** A min–max dry weight range in lb. Equal ends collapse to one value. */
export function formatWeightRange(min, max) {
  if (min == null) return '—';
  if (min === max || max == null) return formatWeight(min);
  return formatWeight(min) + ' – ' + formatWeight(max);
}

/** Hitch (tongue) weight as a percent of GVWR, rounded — handling sweet spot is 10–15%. */
export function hitchPctOfGvwr(hitchLb, gvwrLb) {
  if (!(hitchLb > 0) || !(gvwrLb > 0)) return null;
  return Math.round((hitchLb / gvwrLb) * 100);
}

/**
 * A "Save" toggle button for a floorplan (trailer or motorhome). Pure static
 * markup — the client (app.js `savedStore`) wires every `.save-btn` on load,
 * reflecting saved state from localStorage and toggling aria-pressed + label.
 * Self-contained escaping so it can be reused by both renderers.
 *
 *   slug  — stable floorplan id (e.g. "classic-33fb-2026")
 *   type  — "trailer" | "motorhome" (Saved page links to m/ vs mm/)
 *   label — human label for the aria-label ("Classic 33FB")
 *   variant — "card" (compact, icon-only) | "detail" (full, with text)
 */
export function saveButton(slug, type, label, variant = 'card') {
  const e = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const heart = '<svg class="save-heart" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path d="M12 20.3 4.6 12.9a4.6 4.6 0 1 1 6.5-6.5l.9.9.9-.9a4.6 4.6 0 1 1 6.5 6.5z"/></svg>';
  const text = variant === 'detail'
    ? '<span class="save-btn-text">Save</span>'
    : '';
  const cls = variant === 'detail' ? 'save-btn save-btn--detail' : 'save-btn save-btn--card';
  return `<button type="button" class="${cls}" data-save data-slug="${e(slug)}" data-type="${e(type)}" aria-pressed="false" aria-label="Save ${e(label)}" title="Save this floorplan">${heart}${text}</button>`;
}
