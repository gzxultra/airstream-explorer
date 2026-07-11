// Lifestyle fit scoring — pure functions scoring how well a trailer matches
// common camping lifestyles. All scores 0–5, driven by real spec data.

/** Clamp and scale a value within a range to 0-5. */
function scale(val, min, max) {
  if (val == null || isNaN(val)) return 0;
  const ratio = (val - min) / (max - min);
  return Math.round(Math.max(0, Math.min(5, ratio * 5)));
}

/** Inverse scale: lower values score higher. */
function scaleInv(val, min, max) {
  if (val == null || isNaN(val)) return 0;
  const ratio = 1 - (val - min) / (max - min);
  return Math.round(Math.max(0, Math.min(5, ratio * 5)));
}

/**
 * Score a trailer against 5 camping lifestyles. Returns { boondocking, family,
 * weekend, fulltime, easyTow } each 0–5, plus a short reason for each score.
 */
export function lifestyleFit(t) {
  // --- Boondocking ---
  // Weighted: off-grid score (40%), fresh tank (20%), solar (20%), battery (20%)
  const ogScore = scale(t.offGridScore || 0, 30, 95);
  const freshScore = scale(t.freshGal || 0, 15, 50);
  const solarScore = scale(t.solarW || 0, 0, 600);
  const battScore = scale(t.batteryKwh || 0, 0, 6);
  const boondocking = Math.round((ogScore * 0.4 + freshScore * 0.2 + solarScore * 0.2 + battScore * 0.2));
  const boondockReason = boondocking >= 4
    ? `${t.offGridScore}/100 off-grid score, ${t.solarW || 0}W solar`
    : boondocking >= 2
      ? 'Moderate off-grid capability'
      : 'Limited off-grid setup';

  // --- Family Camping ---
  // Weighted: sleeps (40%), CCC (30%), length (30%)
  const sleepsF = scale(t.sleeps || 0, 2, 8);
  const cccF = scale(t.cccLb || 0, 300, 2300);
  const lengthF = scale(t.lengthFt || 0, 16, 34);
  const family = Math.round((sleepsF * 0.4 + cccF * 0.3 + lengthF * 0.3));
  const familyReason = family >= 4
    ? `Sleeps ${t.sleeps}, ${t.cccLb ? t.cccLb.toLocaleString('en-US') + ' lb cargo' : 'generous cargo'}`
    : family >= 2
      ? `Sleeps ${t.sleeps}, works for smaller families`
      : `Sleeps ${t.sleeps} — best for couples`;

  // --- Weekend Getaway ---
  // Shorter, lighter = easier to hitch up and go. Inverse scales.
  const weightW = scaleInv(t.weightLb || 0, 2500, 8500);
  const lengthW = scaleInv(t.lengthFt || 0, 16, 34);
  const weekend = Math.round((weightW * 0.5 + lengthW * 0.5));
  const weekendReason = weekend >= 4
    ? 'Light and compact — quick to hitch and go'
    : weekend >= 2
      ? 'Manageable for occasional trips'
      : 'Larger rig — better for extended stays';

  // --- Full-time Living ---
  // Bigger tanks, more length, more CCC, better battery
  const freshFT = scale(t.freshGal || 0, 15, 50);
  const totalTank = (t.freshGal || 0) + (t.grayGal || 0) + (t.blackGal || 0);
  const tankFT = scale(totalTank, 30, 130);
  const lengthFT = scale(t.lengthFt || 0, 20, 34);
  const cccFT = scale(t.cccLb || 0, 500, 2300);
  const fulltime = Math.round((tankFT * 0.3 + lengthFT * 0.3 + cccFT * 0.2 + freshFT * 0.2));
  const fulltimeReason = fulltime >= 4
    ? 'Spacious with large tanks — built for living'
    : fulltime >= 2
      ? 'Livable for extended trips, modest for full-time'
      : 'Compact — designed for travel, not residence';

  // --- Easy Towing ---
  // Lower GVWR, lighter, single axle preferred
  const gvwrE = scaleInv(t.gvwrLb || 0, 3500, 11000);
  const weightE = scaleInv(t.weightLb || 0, 2500, 8500);
  const axleBonus = (t.weightLb || 0) <= 4000 ? 1 : 0; // single-axle lightweights
  const easyTow = Math.min(5, Math.round((gvwrE * 0.5 + weightE * 0.5)) + axleBonus);
  const easyTowReason = easyTow >= 4
    ? 'Light enough for many SUVs and mid-size trucks'
    : easyTow >= 2
      ? 'Needs a capable half-ton or better'
      : 'Heavy — requires a serious tow vehicle';

  return {
    boondocking, boondockReason,
    family, familyReason,
    weekend, weekendReason,
    fulltime, fulltimeReason,
    easyTow, easyTowReason,
  };
}

// ---------------------------------------------------------------------------
// AMENITY SUMMARY — parse the trailer description to categorize amenities
// ---------------------------------------------------------------------------

const AMENITY_RULES = [
  // Bathroom
  { pattern: /wet\s+bath/i, category: 'bath', label: 'Wet bath', icon: '🚿' },
  { pattern: /rear-spanning\s+shower/i, category: 'bath', label: 'Full rear bath', icon: '🛁' },
  { pattern: /two-piece.*shower/i, category: 'bath', label: 'Separate shower', icon: '🚿' },
  { pattern: /combined.*shower/i, category: 'bath', label: 'Corner shower', icon: '🚿' },
  // Bed
  { pattern: /rear\s+primary\s+bed/i, category: 'bed', label: 'Rear bed', icon: '🛏️' },
  { pattern: /front\s+primary\s+bed/i, category: 'bed', label: 'Front bed', icon: '🛏️' },
  { pattern: /rear\s+convertible\s+bed/i, category: 'bed', label: 'Convertible bed', icon: '🛏️' },
  { pattern: /rear\s+v-shape\s+twin/i, category: 'bed', label: 'Twin beds', icon: '🛏️' },
  // Kitchen
  { pattern: /l-shaped\s+galley/i, category: 'kitchen', label: 'L-shaped kitchen', icon: '🍳' },
  { pattern: /front\s+galley/i, category: 'kitchen', label: 'Front kitchen', icon: '🍳' },
  { pattern: /extended\s+mid-ship\s+galley/i, category: 'kitchen', label: 'Extended galley', icon: '🍳' },
  { pattern: /efficient\s+mid-ship\s+galley/i, category: 'kitchen', label: 'Compact galley', icon: '🍳' },
  { pattern: /mid-ship\s+galley/i, category: 'kitchen', label: 'Mid-ship galley', icon: '🍳' },
  // Dining
  { pattern: /u-seated\s+dinette/i, category: 'dining', label: 'U-seat dinette', icon: '🪑' },
  { pattern: /booth\s+style\s+dinette/i, category: 'dining', label: 'Booth dinette', icon: '🪑' },
  { pattern: /stowable\s+dinette/i, category: 'dining', label: 'Stowable dinette', icon: '🪑' },
  { pattern: /bench\s+seating/i, category: 'dining', label: 'Bench seating', icon: '🪑' },
  // Extras
  { pattern: /lounge/i, category: 'lounge', label: 'Lounge area', icon: '🛋️' },
  { pattern: /rear\s+hatch/i, category: 'outdoor', label: 'Rear hatch', icon: '🚪' },
  { pattern: /panoramic\s+windows/i, category: 'view', label: 'Panoramic windows', icon: '🪟' },
  { pattern: /smart\s+control/i, category: 'tech', label: 'Smart controls', icon: '📱' },
  { pattern: /solid\s+surface\s+countertop/i, category: 'finish', label: 'Solid countertops', icon: '✨' },
];

/**
 * Extract amenity tags from the trailer description. Returns an array of
 * { category, label, icon }. One per category to keep it compact.
 */
export function deriveAmenities(t) {
  const desc = t.description || '';
  const seen = new Set();
  const result = [];
  for (const rule of AMENITY_RULES) {
    if (rule.pattern.test(desc) && !seen.has(rule.category)) {
      seen.add(rule.category);
      result.push({ category: rule.category, label: rule.label, icon: rule.icon });
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// STORAGE & PARKING GUIDE — practical dimension-based recommendations
// ---------------------------------------------------------------------------

/**
 * Compute storage and parking recommendations from trailer dimensions.
 * Returns { storageUnit, garageNote, maneuverNote, parkingLength, clearanceHeight }.
 */
export function storageGuide(t) {
  const len = t.lengthFt || 0;
  const width = t.extWidthFt || 8;
  const height = t.extHeightFt || 10;

  // Storage unit sizing: trailer length + 2' tongue clearance + 2' walk space
  const needLen = Math.ceil(len + 4);
  // Width: trailer is ~8' + 1' clearance each side for an enclosed unit
  const needWidth = Math.ceil(width + 2);

  let storageUnit;
  if (needLen <= 22) storageUnit = '10\' × 20\' enclosed or 12\' × 25\' covered';
  else if (needLen <= 27) storageUnit = '10\' × 25\' enclosed or 12\' × 30\' covered';
  else if (needLen <= 32) storageUnit = '12\' × 30\' enclosed or 10\' × 35\' covered';
  else storageUnit = '12\' × 35\' enclosed or dedicated RV lot';

  // Garage compatibility: standard 2-car garage is 20'×20', 3-car is 30'×20'
  let garageNote;
  if (len <= 18 && height <= 10) {
    garageNote = 'May fit a deep single-car garage (20\'+)';
  } else if (len <= 22 && height <= 10.5) {
    garageNote = 'Fits a deep 2-car garage (24\'+ deep)';
  } else if (len <= 28) {
    garageNote = 'Needs an oversized or RV-height garage';
  } else {
    garageNote = 'Too large for residential garages — RV storage recommended';
  }

  // Maneuver difficulty based on length and weight
  let maneuverNote;
  if (len <= 18) {
    maneuverNote = 'Easy — compact and nimble in tight campsites';
  } else if (len <= 23) {
    maneuverNote = 'Moderate — manageable in most campgrounds';
  } else if (len <= 28) {
    maneuverNote = 'Moderate-hard — need pull-through or wide back-in sites';
  } else {
    maneuverNote = 'Challenging — best with pull-through sites and practice';
  }

  return {
    storageUnit,
    garageNote,
    maneuverNote,
    parkingLength: Math.ceil(len),
    clearanceHeight: height,
    recommendedSlotFt: needLen,
  };
}
