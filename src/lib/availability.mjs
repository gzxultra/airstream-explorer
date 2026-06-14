// Live availability + per-site fit, parsed from Recreation.gov's public
// availability endpoint:
//   GET /api/camps/availability/campground/<id>/month?start_date=YYYY-MM-01T00:00:00.000Z
// One call returns every site's nightly status for a month, plus each site's
// campsite_type (hookup signal). Per-site Trailer max length comes from the
// per-site detail endpoint and is merged in when available.
//
// These are PURE functions over already-fetched JSON so the logic is testable
// without the network. The browser layer (app.js) fetches and calls these.

const CLEARANCE = 3; // ft, same maneuvering buffer as the campground-level fit

/** Parse "2026-09-04T00:00:00Z" (or a Date) to a YYYY-MM-DD string (UTC). */
export function dateKey(d) {
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
}

/** The API keys nights as "<YYYY-MM-DD>T00:00:00Z". Build that from a date. */
export function nightKey(ymd) {
  return `${dateKey(ymd)}T00:00:00Z`;
}

/**
 * Classify a site's hookups from its campsite_type string.
 * Returns { electric, sewer, water, full, label }.
 */
export function hookupsFromType(campsiteType, attributes) {
  const t = String(campsiteType || '').toUpperCase();
  const attrNames = (attributes || []).map((a) => String(a.attribute_name || a.name || '').toUpperCase());
  const hasAttr = (s) => attrNames.some((n) => n.includes(s));
  const nonElectric = t.includes('NONELECTRIC') || t.includes('NON-ELECTRIC') || t.includes('NO ELECTRIC');
  const electric = (!nonElectric && t.includes('ELECTRIC')) || hasAttr('ELECTRIC');
  const sewer = hasAttr('SEWER');
  const water = hasAttr('WATER HOOKUP') || hasAttr('WATER HOOKUPS');
  const full = electric && sewer && water;
  let label;
  if (full) label = 'Full hookups';
  else if (electric && sewer) label = 'Electric + sewer';
  else if (electric && water) label = 'Electric + water';
  else if (electric) label = 'Electric';
  else if (t.includes('NONELECTRIC')) label = 'No hookups';
  else label = 'Hookups not listed';
  return { electric, sewer, water, full, label };
}

/**
 * Trailer-specific max length for a site from its permitted_equipment.
 * Prefers Trailer, then RV, then the largest listed; null if none/zero.
 */
export function trailerMaxLength(permittedEquipment) {
  const eq = permittedEquipment || [];
  const byName = (name) => {
    const m = eq.find((e) => String(e.equipment_name || '').toLowerCase() === name && e.max_length > 0);
    return m ? m.max_length : null;
  };
  const trailer = byName('trailer');
  if (trailer != null) return trailer;
  const rv = byName('rv');
  if (rv != null) return rv;
  const lengths = eq.map((e) => e.max_length).filter((n) => typeof n === 'number' && n > 0);
  return lengths.length ? Math.max(...lengths) : null;
}

/** Per-site fit verdict for a rig (mirrors the campground-level fitExplain). */
export function siteFit(lengthFt, siteMaxFt) {
  if (!(lengthFt > 0)) return { cls: siteMaxFt != null ? 'limit' : 'unknown', max: siteMaxFt };
  if (siteMaxFt == null) return { cls: 'unknown', max: null };
  if (siteMaxFt >= lengthFt + CLEARANCE) return { cls: 'fits', max: siteMaxFt };
  if (siteMaxFt >= lengthFt) return { cls: 'tight', max: siteMaxFt };
  return { cls: 'no', max: siteMaxFt };
}

/**
 * Normalize the raw availability payload into a lean per-site array:
 *   [{ id, site, loop, type, maxPeople, hookups, nights: {ymd: status} }]
 * `nights` keeps only the recognized statuses; absent = unknown.
 */
export function parseAvailability(payload) {
  const cs = (payload && payload.campsites) || {};
  const out = [];
  for (const id of Object.keys(cs)) {
    const v = cs[id] || {};
    const nights = {};
    const av = v.availabilities || {};
    for (const k of Object.keys(av)) nights[dateKey(k)] = av[k];
    out.push({
      id: String(id),
      site: v.site || '',
      loop: v.loop || '',
      type: v.campsite_type || '',
      maxPeople: v.max_num_people != null ? v.max_num_people : null,
      hookups: hookupsFromType(v.campsite_type),
      nights,
    });
  }
  return out;
}

/** True if every night in [start, end) is "Available" for this parsed site. */
export function siteFreeForRange(site, startYmd, endYmd) {
  const start = new Date(startYmd + 'T00:00:00Z');
  const end = new Date(endYmd + 'T00:00:00Z');
  if (!(start < end)) return false;
  for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
    if (site.nights[dateKey(d)] !== 'Available') return false;
  }
  return true;
}

/**
 * Summarize a campground's availability for a date range and (optional) rig.
 * Returns counts of sites that are free for the whole range, split by fit.
 *   { freeTotal, freeFits, freeTight, freeUnknown, sampleSites: [...] }
 * siteMax is an optional map { siteId: trailerMaxFt } merged from detail calls;
 * when absent we fall back to the campground's blanket max (passed as cgMax).
 */
export function availabilitySummary(sites, startYmd, endYmd, opts = {}) {
  const { lengthFt = 0, siteMax = {}, cgMax = null } = opts;
  let freeTotal = 0, freeFits = 0, freeTight = 0, freeUnknown = 0, freeNo = 0;
  const sampleSites = [];
  for (const s of sites) {
    if (!siteFreeForRange(s, startYmd, endYmd)) continue;
    freeTotal += 1;
    const max = siteMax[s.id] != null ? siteMax[s.id] : cgMax;
    const fit = siteFit(lengthFt, max);
    if (fit.cls === 'fits') freeFits += 1;
    else if (fit.cls === 'tight') freeTight += 1;
    else if (fit.cls === 'no') freeNo += 1;
    else freeUnknown += 1;
    if (sampleSites.length < 8 && fit.cls !== 'no') {
      sampleSites.push({ site: s.site, loop: s.loop, hookups: s.hookups.label, fit: fit.cls, max: fit.max });
    }
  }
  return { freeTotal, freeFits, freeTight, freeUnknown, freeNo, sampleSites };
}

/**
 * The upcoming weekend (Fri->Sun, 2 nights) as { start, end } YMD strings,
 * relative to `from` (default today). If today is already Fri/Sat, use this
 * weekend; otherwise the next one.
 */
export function upcomingWeekend(from = new Date()) {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const dow = d.getUTCDay(); // 0 Sun ... 5 Fri 6 Sat
  let toFri;
  if (dow === 5 || dow === 6) toFri = dow === 5 ? 0 : -1; // within the weekend
  else toFri = (5 - dow + 7) % 7;
  const fri = new Date(d); fri.setUTCDate(d.getUTCDate() + toFri);
  const sun = new Date(fri); sun.setUTCDate(fri.getUTCDate() + 2);
  return { start: dateKey(fri), end: dateKey(sun) };
}

/** Which month-start (YYYY-MM-01) calls cover a date range (usually one or two). */
export function monthsForRange(startYmd, endYmd) {
  const out = [];
  const start = new Date(startYmd + 'T00:00:00Z');
  const end = new Date(endYmd + 'T00:00:00Z');
  let cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10));
    cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
  }
  return out;
}
