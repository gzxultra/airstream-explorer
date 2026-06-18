// Payload (packing) calculator: how much cargo can you actually bring?
//
// Pure functions over a trailer's REAL spec fields — no DOM, no I/O — so the
// exact same math is unit-tested here and mirrored in the client.
//
// The problem: Airstream publishes a CCC (Cargo Carrying Capacity) number, but
// that's the TOTAL you can add to the dry trailer. In practice, much of it is
// consumed by water, propane, and the battery (if lithium upgrade). Users need
// to know: "After I fill the tanks, how much is left for my stuff?"
//
// This calculator decomposes CCC into:
//   1. Water weight (fresh water tank × 8.34 lb/gal)
//   2. Propane weight (standard dual 20 lb or 30 lb tanks)
//   3. Battery weight (if upgraded from AGM to lithium, net change)
//   4. Remaining personal cargo capacity
//
// Sources:
//   - Water: 8.34 lb/gal (exact at 60°F, USGS)
//   - Propane: 4.24 lb/gal liquid; standard 20 lb tank holds ~4.7 gal
//   - Standard Airstream propane: two 20 lb tanks (40 lb total propane weight)
//     or two 30 lb tanks on larger models
//   - Airstream owner's manual: CCC includes full LP gas but NOT fresh water
//     on some models. We model conservatively: CCC minus ALL consumables.

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------

/** Weight of water per gallon at standard conditions (USGS). */
export const WATER_LB_PER_GAL = 8.34;

/**
 * Propane tank presets. Airstream ships with either two 20 lb or two 30 lb
 * tanks depending on model size. The "weight" here is the propane itself
 * (the payload), not the empty tank (which is part of dry weight).
 */
export const PROPANE_PRESETS = {
  none: { label: 'Empty (0 lb)', weightLb: 0 },
  single20: { label: 'One 20 lb tank', weightLb: 20 },
  dual20: { label: 'Two 20 lb tanks (standard)', weightLb: 40 },
  dual30: { label: 'Two 30 lb tanks', weightLb: 60 },
};

/** Default propane load (most Airstream models ship with dual 20 lb). */
export const DEFAULT_PROPANE = 'dual20';

/**
 * Common gear category presets with typical weights. These help users
 * estimate their personal cargo without weighing every item.
 */
export const GEAR_PRESETS = {
  bedding: { label: 'Bedding & linens', weightLb: 25, description: 'Sheets, blankets, pillows for 2' },
  kitchen: { label: 'Kitchen essentials', weightLb: 30, description: 'Pots, pans, dishes, utensils' },
  clothing: { label: 'Clothing (2 people, 1 week)', weightLb: 40, description: 'Clothes, shoes, jackets' },
  food: { label: 'Food & drinks (1 week)', weightLb: 60, description: 'Groceries, beverages, cooler items' },
  outdoor: { label: 'Outdoor gear', weightLb: 35, description: 'Chairs, table, grill, awning mat' },
  tools: { label: 'Tools & maintenance', weightLb: 20, description: 'Leveling blocks, hoses, basic tools' },
  electronics: { label: 'Electronics', weightLb: 15, description: 'Laptop, cameras, chargers, Starlink' },
  bikes: { label: 'Bikes (2)', weightLb: 60, description: 'Two adult bikes on rear rack' },
};

// ---------------------------------------------------------------------------
// THE CALCULATION
// ---------------------------------------------------------------------------

/**
 * Calculate the weight of water at a given fill level.
 *
 * @param {number} tankGal    tank capacity in gallons
 * @param {number} fillPct    fill percentage (0–1), default 1.0 (full)
 * @returns {number} water weight in pounds
 */
export function waterWeight(tankGal, fillPct = 1.0) {
  if (!(tankGal > 0)) return 0;
  const fill = Math.max(0, Math.min(1, fillPct));
  return Math.round(tankGal * fill * WATER_LB_PER_GAL);
}

/**
 * Calculate remaining cargo capacity after consumables.
 *
 * @param {object} trailer  trailer record (cccLb, freshGal)
 * @param {object} [opts]
 * @param {number} [opts.waterFillPct=1.0]  fresh water fill (0–1)
 * @param {string} [opts.propane='dual20']  propane preset key
 * @param {number} [opts.additionalLb=0]    additional known cargo weight
 * @returns {{
 *   cccLb: number,
 *   waterLb: number,
 *   propaneLb: number,
 *   additionalLb: number,
 *   consumablesLb: number,
 *   remainingLb: number,
 *   usedPct: number,
 *   status: 'ok'|'tight'|'over'
 * }}
 */
export function calculatePayload(trailer, opts = {}) {
  const ccc = trailer.cccLb || 0;
  const waterFill = opts.waterFillPct != null ? opts.waterFillPct : 1.0;
  const propaneKey = opts.propane && PROPANE_PRESETS[opts.propane] ? opts.propane : DEFAULT_PROPANE;
  const additional = opts.additionalLb || 0;

  const waterLb = waterWeight(trailer.freshGal, waterFill);
  const propaneLb = PROPANE_PRESETS[propaneKey].weightLb;
  const consumablesLb = waterLb + propaneLb;
  const totalUsed = consumablesLb + additional;
  const remainingLb = ccc - totalUsed;

  // Usage percentage and status
  const usedPct = ccc > 0 ? totalUsed / ccc : 0;
  let status;
  if (usedPct > 1.0) status = 'over';
  else if (usedPct > 0.85) status = 'tight';
  else status = 'ok';

  return {
    cccLb: ccc,
    waterLb,
    propaneLb,
    additionalLb: additional,
    consumablesLb,
    remainingLb,
    usedPct: Math.round(usedPct * 100) / 100,
    status,
  };
}

/**
 * Format remaining payload for display.
 * Positive: "425 lb remaining". Negative: "125 lb OVER".
 */
export function formatRemaining(lb) {
  if (lb == null || !Number.isFinite(lb)) return '—';
  if (lb >= 0) {
    return `${Math.round(lb).toLocaleString('en-US')} lb remaining`;
  }
  return `${Math.round(Math.abs(lb)).toLocaleString('en-US')} lb OVER`;
}

/**
 * Format a weight breakdown item. 167 -> "167 lb".
 */
export function formatLb(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${Math.round(n).toLocaleString('en-US')} lb`;
}
