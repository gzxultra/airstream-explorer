// Dark Sky / Light Pollution Score for boondocking locations.
//
// Data model: a coarse PLANNING-GRADE estimate of artificial sky brightness,
// NOT a pixel-level satellite extraction. We model the continental US as a
// natural-dark background (most remote public land where boondocking happens)
// with a hand-built table of ~90 known metro/urban light domes layered on top.
// Each location's radiance (mcd/m²) is mapped to the Bortle Dark-Sky Scale
// (1-9) using the published thresholds from Falchi et al. (2016).
//
// What this IS: a quick "is this area generally dark, suburban, or city-bright?"
// signal for trip planning. It correctly flags sites near major cities as
// light-polluted and remote desert/mountain sites as dark.
//
// What this is NOT: a substitute for a real measured light-pollution map. The
// urban table is a representative approximation, the natural-dark default is a
// floor (not a measurement), and resolution is ~1° (~80-110 km). For a precise
// reading at an exact coordinate, consult lightpollutionmap.info (the real
// VIIRS/World Atlas data product).
//
// Scale reference (for the Bortle thresholds only — the radiance VALUES here
// are estimates, not from these sources):
//  - Falchi, F. et al. (2016). "The New World Atlas of Artificial Night Sky
//    Brightness." Science Advances, 2(6), e1600377.
//  - Light Pollution Map: https://www.lightpollutionmap.info

/**
 * Bortle Dark-Sky Scale (1-9).
 * Standard classification used by amateur astronomers worldwide.
 * Colors follow the conventional light-pollution map palette.
 */
export const BORTLE_SCALE = [
  { class: 1, label: 'Excellent dark sky', description: 'Zodiacal light, gegenschein visible. Milky Way casts shadows.', color: '#000000' },
  { class: 2, label: 'Typical dark site', description: 'Milky Way highly structured. M33 visible to naked eye.', color: '#1a1a2e' },
  { class: 3, label: 'Rural sky', description: 'Some light pollution on horizon. Milky Way still impressive.', color: '#16213e' },
  { class: 4, label: 'Rural/suburban transition', description: 'Light domes visible over cities. Milky Way visible but not overhead.', color: '#0f3460' },
  { class: 5, label: 'Suburban sky', description: 'Milky Way washed out at zenith. Clouds brighter than sky.', color: '#533483' },
  { class: 6, label: 'Bright suburban sky', description: 'Milky Way only visible near horizon. Sky glow evident.', color: '#e94560' },
  { class: 7, label: 'Suburban/urban transition', description: 'Entire sky has grayish-white hue. Milky Way invisible.', color: '#f39c12' },
  { class: 8, label: 'City sky', description: 'Sky glows white or orange. Only bright planets visible.', color: '#e74c3c' },
  { class: 9, label: 'Inner-city sky', description: 'Only Moon, planets, and a few stars visible.', color: '#ffffff' },
];

/**
 * Radiance thresholds (mcd/m²) for Bortle class boundaries.
 * From Falchi et al. (2016) Table 1, VIIRS calibration.
 * Each threshold is the UPPER bound for that Bortle class.
 */
const BORTLE_THRESHOLDS = [
  0.17,   // Bortle 1: < 0.17 mcd/m²
  0.33,   // Bortle 2: 0.17 - 0.33
  0.66,   // Bortle 3: 0.33 - 0.66
  1.30,   // Bortle 4: 0.66 - 1.30
  2.60,   // Bortle 5: 1.30 - 2.60
  5.20,   // Bortle 6: 2.60 - 5.20
  10.4,   // Bortle 7: 5.20 - 10.4
  20.8,   // Bortle 8: 10.4 - 20.8
  // Bortle 9: > 20.8
];

/**
 * Convert a radiance value (mcd/m²) to Bortle class (1-9).
 */
export function bortleFromRadiance(radiance) {
  if (radiance <= 0) return 1;
  for (let i = 0; i < BORTLE_THRESHOLDS.length; i++) {
    if (radiance <= BORTLE_THRESHOLDS[i]) return i + 1;
  }
  return 9;
}

/**
 * Convert Bortle class to a 0-100 "dark sky score" (higher = darker = better).
 * Linear mapping: Bortle 1 → 100, Bortle 9 → 0.
 */
export function darkSkyScore(bortle) {
  return Math.round(Math.max(0, Math.min(100, (9 - bortle) / 8 * 100)));
}

// ---------------------------------------------------------------------------
// Hand-built light pollution estimate table for the continental US.
//
// This is a coarse model, NOT a satellite-data extraction. We treat most of
// the continental US (esp. remote BLM/USFS land where boondocking happens) as
// naturally dark, and layer a hand-built table of ~90 known metro/urban light
// domes on top. Each entry is a representative radiance ESTIMATE in mcd/m²,
// not a measured value. Resolution is ~1° (~80-110 km cells).
//
// This is a planning-grade signal — "is this area generally dark, suburban,
// or city-bright?" — not pixel-level precision. For a precise reading at an
// exact coordinate, use lightpollutionmap.info (the real VIIRS data product).
//
// Format: lookup keyed by rounded (lat, lon) → radiance estimate in mcd/m²
// ---------------------------------------------------------------------------

// We store only cells meaningfully above natural background (the urban/suburban
// light domes). Everything else falls back to NATURAL_BACKGROUND (a dark-sky
// floor, not a measurement), which maps to Bortle 1.
const NATURAL_BACKGROUND = 0.12; // mcd/m², natural airglow

// City/urban radiance overrides. Format: [lat, lon, radiance]
// Only cells significantly above natural background are listed.
// This covers major metro areas and their light domes.
const URBAN_CELLS = [
  // California
  [34, -118, 45.0], [34, -117, 28.0], [33, -118, 32.0], [33, -117, 22.0],
  [37, -122, 35.0], [37, -121, 18.0], [38, -121, 12.0], [32, -117, 20.0],
  [33, -116, 5.5], [34, -119, 4.2], [36, -120, 3.8], [36, -119, 4.5],
  // Arizona
  [33, -112, 38.0], [33, -111, 18.0], [32, -111, 8.5], [32, -110, 5.2],
  // Nevada
  [36, -115, 42.0], [36, -114, 6.0], [39, -120, 4.5],
  // Utah
  [40, -112, 14.0], [40, -111, 12.0], [41, -112, 8.0], [41, -111, 5.5],
  // Colorado
  [39, -105, 22.0], [39, -104, 18.0], [40, -105, 15.0], [40, -104, 12.0],
  [38, -105, 3.2], [38, -104, 8.5],
  // Texas
  [32, -97, 28.0], [33, -97, 18.0], [30, -98, 15.0], [29, -95, 35.0],
  [29, -98, 14.0], [32, -96, 22.0], [31, -97, 5.5],
  // Pacific NW
  [47, -122, 22.0], [45, -123, 12.0], [45, -122, 15.0],
  // Mountain West (small cities)
  [43, -116, 8.0], [46, -112, 3.5], [47, -117, 6.0],
  // Midwest
  [41, -88, 28.0], [42, -88, 22.0], [41, -87, 35.0], [42, -87, 30.0],
  [44, -93, 18.0], [45, -93, 12.0], [39, -95, 8.0], [38, -90, 22.0],
  // Southeast
  [34, -84, 18.0], [33, -84, 25.0], [35, -87, 8.0], [36, -86, 12.0],
  [28, -82, 15.0], [26, -80, 28.0], [25, -80, 35.0], [30, -82, 5.0],
  // Northeast
  [40, -74, 45.0], [41, -74, 32.0], [42, -71, 25.0], [39, -75, 28.0],
  [38, -77, 22.0], [40, -80, 12.0], [43, -71, 5.5],
  // Suburban/exurban glow (moderate values for areas near cities)
  [34, -116, 2.8], [35, -115, 3.5], [35, -106, 8.0], [35, -107, 3.0],
  [37, -120, 2.5], [38, -122, 5.0], [39, -106, 2.0], [40, -106, 1.5],
  [41, -106, 1.0], [42, -106, 0.8], [43, -106, 0.6],
  [44, -103, 2.5], [46, -96, 3.0], [48, -122, 4.0],
  // Rural areas with some light (small towns)
  [37, -109, 0.8], [38, -109, 0.5], [39, -109, 0.6],
  [36, -112, 0.4], [37, -112, 0.5], [38, -112, 1.2],
  [42, -111, 1.5], [43, -111, 0.8], [44, -111, 0.5],
  [45, -110, 0.6], [46, -110, 0.4], [47, -110, 0.5],
];

// Build a lookup map for fast access
const GRID_MAP = new Map();
for (const [lat, lon, rad] of URBAN_CELLS) {
  GRID_MAP.set(`${lat},${lon}`, rad);
}

/**
 * Look up the approximate radiance at a given coordinate.
 * Returns mcd/m² (natural background if no urban override exists).
 */
function radianceAt(lat, lon) {
  const latRound = Math.round(lat);
  const lonRound = Math.round(lon);
  const key = `${latRound},${lonRound}`;
  return GRID_MAP.get(key) || NATURAL_BACKGROUND;
}

/**
 * Estimate light pollution at a given location.
 *
 * @param {number} lat  Latitude (degrees N)
 * @param {number} lon  Longitude (degrees W, negative)
 * @returns {{ bortle: number, score: number, label: string, color: string, radiance: number, resolution: string }}
 */
export function estimateLightPollution(lat, lon) {
  const radiance = radianceAt(lat, lon);
  const bortle = bortleFromRadiance(radiance);
  const score = darkSkyScore(bortle);
  const meta = BORTLE_SCALE[bortle - 1];

  return {
    bortle,
    score,
    label: meta.label,
    color: meta.color,
    description: meta.description,
    radiance,
    resolution: 'Planning estimate · ~1° (~80-110 km)',
  };
}
