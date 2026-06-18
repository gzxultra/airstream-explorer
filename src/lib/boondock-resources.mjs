// Boondocking Resource Proximity — water fill stations and dump stations.
//
// Data source: OpenStreetMap (ODbL) — pre-extracted at build time.
//  - amenity=drinking_water (public water taps/spigots)
//  - amenity=sanitary_dump_station (RV dump stations)
//  - amenity=water_point (bulk water fill for RVs/boats)
//
// The dataset is a curated subset of OSM data focused on points that are:
//  1. Within the continental US (lat 24-50, lon -125 to -66)
//  2. Tagged with one of the above amenity types
//  3. Likely accessible to an RV (not inside buildings, not restricted)
//
// This is community-sourced data and may be incomplete or outdated.
// We label it honestly as "OpenStreetMap community data" in the UI.
//
// Reference: https://wiki.openstreetmap.org/wiki/Tag:amenity%3Ddrinking_water
//            https://wiki.openstreetmap.org/wiki/Tag:amenity%3Dsanitary_dump_station

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const RESOURCE_TYPES = {
  water: {
    label: 'Water fill',
    osmTag: 'amenity=drinking_water / amenity=water_point',
    icon: 'droplet',
  },
  dump: {
    label: 'Dump station',
    osmTag: 'amenity=sanitary_dump_station',
    icon: 'trash-2',
  },
};

/**
 * Haversine distance between two points in kilometers.
 * Standard formula — no external dependency.
 */
export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
    * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Validate an array of resource points.
 * Returns an array of problem strings (empty = valid).
 */
export function validateResourcePoints(points) {
  const problems = [];
  const validTypes = new Set(Object.keys(RESOURCE_TYPES));

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (!p.id) problems.push(`point[${i}]: missing id`);
    if (!validTypes.has(p.type)) problems.push(`point[${i}] ${p.id}: invalid type '${p.type}'`);
    if (p.lat == null || p.lon == null || !Number.isFinite(p.lat) || !Number.isFinite(p.lon)) {
      problems.push(`point[${i}] ${p.id}: missing or invalid coords`);
    } else if (p.lat < 24 || p.lat > 50 || p.lon < -125 || p.lon > -66) {
      problems.push(`point[${i}] ${p.id}: out of US range (${p.lat}, ${p.lon})`);
    }
  }
  return problems;
}

/**
 * Load the pre-built resource points dataset.
 */
export function loadResourcePoints(path) {
  const p = path || join(__dirname, '..', 'data', 'resource-points.json');
  const data = JSON.parse(readFileSync(p, 'utf8'));
  if (!Array.isArray(data)) throw new Error('resource-points.json must be an array');
  return data;
}

/**
 * Find the nearest resources of a given type to a location.
 *
 * @param {{ lat: number, lon: number }} origin  The boondocking site
 * @param {Array} points  All resource points
 * @param {{ type: string, limit: number }} opts  Filter options
 * @returns {Array<{ id, type, lat, lon, name, distanceKm }>}
 */
export function nearestResources(origin, points, opts = {}) {
  const { type, limit = 3 } = opts;
  const filtered = type ? points.filter((p) => p.type === type) : points;

  const withDist = filtered.map((p) => ({
    ...p,
    distanceKm: Math.round(haversineKm(origin.lat, origin.lon, p.lat, p.lon) * 10) / 10,
  }));

  withDist.sort((a, b) => a.distanceKm - b.distanceKm);
  return withDist.slice(0, limit);
}
