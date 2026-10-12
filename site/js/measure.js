// The HomeGuild — property measurement.
// Address → geocode → county parcel polygon → lot area. Keyless public data:
//   Ada County:    assessor parcel layer (acres, zoning, polygon)
//   Canyon County: Idaho Dept. of Water Resources statewide parcels (polygon)
// Environment-neutral ESM. In the browser, measureAddress() calls the Netlify
// function (Census geocoder has no CORS) and falls back to Photon when the
// site is served without functions, e.g. the local static preview.

const ADA_PARCELS = 'https://services2.arcgis.com/dgGjZc6xAH5m5JyP/arcgis/rest/services/Parcels/FeatureServer/5/query';
const IDWR_PARCELS = 'https://gis.idwr.idaho.gov/hosting/rest/services/Reference/Parcels/FeatureServer/0/query';
const SQFT_PER_ACRE = 43560;
const SQFT_PER_M2 = 10.7639;

export const SERVED_COUNTIES = ['Ada', 'Canyon'];

/** Server-side geocode: US Census, returns county too. No key, no CORS. */
export async function geocodeCensus(address) {
  const u = new URL('https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress');
  u.search = new URLSearchParams({ address, benchmark: 'Public_AR_Current', vintage: 'Current_Current', format: 'json' });
  const d = await getJSON(u);
  const m = d?.result?.addressMatches?.[0];
  if (!m) return null;
  return {
    address: titleCase(m.matchedAddress),
    houseNumber: (m.matchedAddress.match(/^\d+/) || [''])[0], // fromAddress is the block start, not the house
    // Assessor-style "1715 N 21ST ST" for an exact parcel match in Ada
    streetKey: [(m.matchedAddress.match(/^\d+/) || [''])[0], m.addressComponents?.preDirection, m.addressComponents?.streetName, m.addressComponents?.suffixType, m.addressComponents?.suffixDirection].filter(Boolean).join(' ').toUpperCase(),
    lat: m.coordinates.y, lng: m.coordinates.x,
    county: (m.geographies?.Counties?.[0]?.NAME || '').replace(/ County$/, ''),
    source: 'census',
  };
}

/** Browser fallback geocode: Photon (komoot). CORS-enabled, no key; dev and static-host volumes only. */
export async function geocodePhoton(address) {
  const u = new URL('https://photon.komoot.io/api/');
  // bbox = Idaho, so a nonsense query can't wander off to another continent
  u.search = new URLSearchParams({ q: address + ', Idaho', limit: 1, lang: 'en', bbox: '-117.3,41.9,-111.0,49.0' });
  const d = await getJSON(u);
  const f = d?.features?.[0];
  if (!f) return null;
  const a = f.properties || {};
  const [lng, lat] = f.geometry.coordinates;
  // Photon often drops the house number for interpolated hits; take it from what the user typed.
  const typed = (address.match(/^\s*(\d+)/) || [])[1] || '';
  return {
    address: [a.housenumber || typed, a.street].filter(Boolean).join(' ') + ', ' + (a.city || a.town || a.village || '') + ', ID ' + (a.postcode || ''),
    houseNumber: a.housenumber || typed,
    lat, lng,
    county: (a.county || '').replace(/ County$/, ''),
    source: 'photon',
  };
}

// A single-family lot in the valley. Anything bigger within reach of the pin is
// almost always a subdivision common lot, the road, or acreage.
const MIN_LOT_SQFT = 1500, MAX_LOT_SQFT = SQFT_PER_ACRE;

/**
 * The homeowner's parcel near a geocoded point. Geocoders interpolate along the
 * street centreline, so the pin is in the road in front of the house: search a
 * radius, keep lots that look residential, and take the nearest. An address
 * match (Ada only) beats proximity. Returns null when nothing is there.
 */
export async function parcelAtPoint({ lat, lng, county, houseNumber, streetKey }) {
  // Ada: the assessor layer carries the site address, so match it outright when we have one.
  if (county === 'Ada' && streetKey) {
    const u = new URL(ADA_PARCELS);
    u.search = new URLSearchParams({ where: `ADDRESS LIKE '${streetKey.replace(/'/g, "''")}%'`, outFields: 'PARCEL,ADDRESS,CITY_STATE,PROPCODE,ZONING,ACRES', returnGeometry: true, outSR: 4326, f: 'json' });
    const d = await getJSON(u);
    const f = d?.features?.find(x => x.geometry?.rings?.length && x.attributes.ADDRESS.trim().startsWith(streetKey + ' ') || x.attributes.ADDRESS.trim() === streetKey);
    if (f) {
      const a = f.attributes;
      return {
        parcelId: a.PARCEL, county: 'Ada',
        siteAddress: titleCase(a.ADDRESS.trim() + ', ' + a.CITY_STATE.trim().replace(/-0000$/, '')),
        houseNumber: a.ADDRESS.trim().split(' ')[0], zoning: a.ZONING, propCode: a.PROPCODE,
        lotSqft: Math.round(a.ACRES * SQFT_PER_ACRE), polygon: f.geometry.rings[0].map(([x, y]) => [y, x]),
        source: 'Ada County Assessor', match: 'address',
      };
    }
  }
  const base = {
    geometry: `${lng},${lat}`, geometryType: 'esriGeometryPoint', inSR: 4326,
    distance: 25, units: 'esriSRUnit_Meter', spatialRel: 'esriSpatialRelIntersects',
    returnGeometry: true, outSR: 4326, f: 'json',
  };
  const ada = county === 'Ada';
  const u = new URL(ada ? ADA_PARCELS : IDWR_PARCELS);
  u.search = new URLSearchParams({ ...base, outFields: ada ? 'PARCEL,ADDRESS,CITY_STATE,PROPCODE,ZONING,ACRES' : 'PIN,COUNTY,Shape__Area' });
  const d = await getJSON(u);
  const feats = (d?.features || []).filter(f => f.geometry?.rings?.length).map(f => {
    const a = f.attributes;
    const polygon = f.geometry.rings[0].map(([x, y]) => [y, x]);
    return ada ? {
      parcelId: a.PARCEL, county: 'Ada',
      siteAddress: titleCase(a.ADDRESS.trim() + ', ' + a.CITY_STATE.trim().replace(/-0000$/, '')),
      houseNumber: a.ADDRESS.trim().split(' ')[0],
      zoning: a.ZONING, propCode: a.PROPCODE,
      lotSqft: Math.round(a.ACRES * SQFT_PER_ACRE), polygon,
      source: 'Ada County Assessor',
    } : {
      parcelId: a.PIN, county: a.COUNTY, siteAddress: null, houseNumber: null, zoning: null, propCode: null,
      lotSqft: Math.round(a.Shape__Area * SQFT_PER_M2), polygon,
      source: 'Idaho Dept. of Water Resources / ' + a.COUNTY + ' County Assessor',
    };
  });
  if (!feats.length) return null;

  const byAddress = houseNumber && feats.find(p => p.houseNumber === houseNumber);
  if (byAddress) return { ...byAddress, match: 'address' };

  const plausible = feats.filter(p => p.lotSqft >= MIN_LOT_SQFT && p.lotSqft <= MAX_LOT_SQFT);
  const pool = plausible.length ? plausible : feats;
  const nearest = pool.map(p => ({ p, d: distanceM(lat, lng, centroid(p.polygon)) })).sort((a, b) => a.d - b.d)[0].p;
  return { ...nearest, match: 'nearest' };
}

function centroid(poly) {
  const n = poly.length;
  return [poly.reduce((s, p) => s + p[0], 0) / n, poly.reduce((s, p) => s + p[1], 0) / n];
}
function distanceM(lat, lng, [lat2, lng2]) {
  const k = Math.PI / 180, dy = (lat2 - lat) * 111320, dx = (lng2 - lng) * 111320 * Math.cos(lat * k);
  return Math.hypot(dx, dy);
}

/** Full server-side pipeline. Throws with a user-facing message on failure. */
const CITIES = ['Boise', 'Meridian', 'Nampa', 'Eagle', 'Star', 'Kuna', 'Caldwell', 'Middleton', 'Garden City'];
const hasCity = a => CITIES.some(c => new RegExp('\b' + c + '\b', 'i').test(a));

/**
 * Geocode the way people actually type: with or without a city, with or without "ID".
 * Races the Census geocoder (precise, needs a city) against Photon (forgiving) and, when no
 * city was given, Census once per served city. Keeps the most precise hit inside Ada/Canyon.
 */
export async function geocodeAny(address) {
  const tries = [geocodeCensus(address), geocodePhoton(address)];
  if (!hasCity(address)) for (const c of CITIES) tries.push(geocodeCensus(`${address}, ${c}, ID`));
  const hits = (await Promise.allSettled(tries)).filter(r => r.status === 'fulfilled' && r.value).map(r => r.value);
  const served = hits.filter(g => SERVED_COUNTIES.includes(g.county));
  const photon = served.find(g => g.source === 'photon');
  const census = served.filter(g => g.source === 'census');
  // Several cities may "match" a street name; trust the one Photon also points at.
  const city = photon && (photon.address.split(',')[1] || '').trim().toLowerCase();
  return census.find(g => city && g.address.toLowerCase().includes(city)) || census[0] || photon || hits[0] || null;
}

export async function measureServer(address) {
  const geo = await geocodeAny(address);
  return finish(geo);
}

/** Browser entry: function first, Photon fallback for static previews. */
export async function measureAddress(address) {
  let r = null;
  try {
    r = await fetch('/.netlify/functions/measure', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address }) });
  } catch { /* offline or no functions runtime: fall through */ }
  // A real function answers JSON; a static server answers 404/501 HTML.
  if (r && /json/.test(r.headers.get('content-type') || '')) {
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Measurement failed.');
    return d;
  }
  const geo = await geocodePhoton(address);
  return finish(geo);
}

async function finish(geo) {
  if (!geo) throw new Error("We couldn't place that address. Add the city, e.g. 1601 N 13th St, Boise.");
  if (!SERVED_COUNTIES.includes(geo.county)) throw new Error(`We only serve Ada and Canyon counties for now — that address is in ${geo.county || 'another'} County.`);
  const parcel = await parcelAtPoint(geo);
  if (!parcel) throw new Error("We found the address but not its parcel. A reviewer will measure it by hand — leave your email below.");
  return { geo, parcel };
}

async function getJSON(url) {
  const r = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'HomeGuild quote tool (conor.follette@gmail.com)' } });
  if (!r.ok) throw new Error(`Lookup failed (${r.status}).`);
  return r.json();
}

function titleCase(s) {
  return s.toLowerCase().replace(/\b([a-z])/g, c => c.toUpperCase()).replace(/\bId\b/g, 'ID').replace(/\b(Ne|Nw|Se|Sw|N|S|E|W)\b/g, c => c.toUpperCase());
}
