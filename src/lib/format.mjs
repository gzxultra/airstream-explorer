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

/** Hitch (tongue) weight as a percent of GVWR, rounded — handling sweet spot is 10–15%. */
export function hitchPctOfGvwr(hitchLb, gvwrLb) {
  if (!(hitchLb > 0) || !(gvwrLb > 0)) return null;
  return Math.round((hitchLb / gvwrLb) * 100);
}
