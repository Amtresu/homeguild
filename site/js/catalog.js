// The HomeGuild — exterior service catalog and pricing rules.
// Environment-neutral ESM: the browser prices the quote with it, and the
// checkout function re-prices with the same file so the client can't be trusted
// for a single cent. All money is integer cents.

/** Derive the working measurements of a property from its parcel. */
export function deriveMeasurements(parcel, overrides = {}) {
  const lot = Math.max(0, Math.round(parcel.lotSqft || 0));
  // Treasure Valley single-family coverage heuristics; the homeowner can correct
  // the lawn on the quote page and the field tech corrects the rest on visit one.
  const footprint = clamp(Math.round(lot * 0.28), 900, 3200);
  const driveway = 600;
  const hardscape = Math.max(250, Math.round(lot * 0.06));
  const beds = Math.max(150, Math.round(lot * 0.08));
  const lawnEstimate = Math.max(0, lot - footprint - driveway - hardscape - beds);
  const lawn = overrides.lawnSqft != null ? clamp(Math.round(overrides.lawnSqft), 0, lot) : lawnEstimate;
  const perimeter = Math.round(4 * Math.sqrt(footprint) * 1.15);
  const roof = Math.round(footprint * 1.18);
  const zones = Math.max(3, Math.ceil(lawn / 1800));
  return { lotSqft: lot, footprintSqft: footprint, drivewaySqft: driveway, hardscapeSqft: hardscape,
    bedSqft: beds, lawnSqft: lawn, lawnEstimateSqft: lawnEstimate, perimeterFt: perimeter,
    roofSqft: roof, zones };
}

function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }
const sqft = n => n.toLocaleString('en-US') + ' sq ft';

export const SERVICES = [
  {
    id: 'mowing', group: 'Lawn', name: 'Weekly mowing',
    blurb: 'Mow, edge, trim, blow. Same crew, same day each week, April through October.',
    cadence: { label: 'per visit', perYear: 28 },
    basis: m => sqft(m.lawnSqft) + ' of lawn',
    price: m => Math.max(3800, 3000 + Math.round(m.lawnSqft * 0.004)),
  },
  {
    id: 'fert', group: 'Lawn', name: 'Fertilization & weed control',
    blurb: 'Five-application program timed to the valley: pre-emergent in March, broadleaf through summer, winterizer in October.',
    cadence: { label: 'per application', perYear: 5 },
    basis: m => sqft(m.lawnSqft) + ' of lawn',
    price: m => Math.max(5200, 4000 + Math.round(m.lawnSqft * 0.007)),
  },
  {
    id: 'aeration', group: 'Lawn', name: 'Core aeration',
    blurb: 'Fall plug aeration so irrigation and fertilizer reach the roots through our clay.',
    cadence: { label: 'once a year', perYear: 1 },
    basis: m => sqft(m.lawnSqft) + ' of lawn',
    price: m => Math.max(6500, 5500 + Math.round(m.lawnSqft * 0.009)),
  },
  {
    id: 'pest', group: 'Pest', name: 'Perimeter pest control',
    blurb: 'Quarterly exterior barrier for spiders, ants, earwigs, and boxelder bugs. Interior on request at no charge.',
    cadence: { label: 'per quarter', perYear: 4 },
    basis: m => m.perimeterFt.toLocaleString('en-US') + ' ft of foundation',
    price: m => 7500 + m.perimeterFt * 15,
  },
  {
    id: 'mosquito', group: 'Pest', name: 'Mosquito treatment',
    blurb: 'Monthly barrier spray May through September on shrubs, shade, and standing-water edges.',
    cadence: { label: 'per month', perYear: 5 },
    basis: m => sqft(m.lotSqft) + ' lot',
    price: m => 6000 + Math.round(m.lotSqft * 0.002),
  },
  {
    id: 'blowout', group: 'Irrigation', name: 'Sprinkler blowout',
    blurb: 'Compressed-air winterization of every zone before the first hard freeze, usually mid-October.',
    cadence: { label: 'once a year', perYear: 1 },
    basis: m => m.zones + ' zones (estimated)',
    price: m => 4500 + m.zones * 600,
  },
  {
    id: 'startup', group: 'Irrigation', name: 'Sprinkler spring start-up',
    blurb: 'Pressurize, check each head and valve, set the controller for the season.',
    cadence: { label: 'once a year', perYear: 1 },
    basis: m => m.zones + ' zones (estimated)',
    price: m => 5500 + m.zones * 500,
  },
  {
    id: 'gutters', group: 'Exterior', name: 'Gutter cleaning',
    blurb: 'Clear, flush, and check downspouts. Spring after the cottonwoods, fall after the leaves.',
    cadence: { label: 'per visit', perYear: 2 },
    basis: m => sqft(m.roofSqft) + ' of roof (estimated)',
    price: m => 8000 + Math.round(m.roofSqft * 0.035),
  },
  {
    id: 'windows', group: 'Exterior', name: 'Exterior window washing',
    blurb: 'Pure-water pole wash of every exterior pane, screens included.',
    cadence: { label: 'per visit', perYear: 2 },
    basis: m => sqft(m.footprintSqft) + ' footprint (estimated)',
    price: m => 9000 + Math.round(m.footprintSqft * 0.04),
  },
  {
    id: 'shrubs', group: 'Beds', name: 'Shrub & hedge trimming',
    blurb: 'Shape and thin in late spring and again after summer growth. Clippings hauled.',
    cadence: { label: 'per visit', perYear: 2 },
    basis: m => sqft(m.bedSqft) + ' of beds (estimated)',
    price: m => 9000 + Math.round(m.bedSqft * 0.15),
  },
  {
    id: 'mulch', group: 'Beds', name: 'Bark & mulch refresh',
    blurb: 'Two inches of medium bark over every bed each spring, edges re-cut.',
    cadence: { label: 'once a year', perYear: 1 },
    basis: m => sqft(m.bedSqft) + ' of beds (estimated)',
    price: m => 15000 + Math.round(m.bedSqft * 0.45),
  },
  {
    id: 'snow', group: 'Exterior', name: 'Snow removal',
    blurb: 'Driveway, walk, and front steps cleared by 7am after any storm over two inches.',
    cadence: { label: 'per storm', perYear: 6 },
    basis: m => sqft(m.drivewaySqft) + ' driveway (estimated)',
    price: m => 3000 + Math.round(m.drivewaySqft * 0.03),
  },
];

export const GROUPS = ['Lawn', 'Irrigation', 'Pest', 'Beds', 'Exterior'];

/** The Monthly plan's membership: white-glove dispatch, billed monthly. Placeholder price. */
export const MEMBERSHIP = { id: 'membership', name: 'White-glove dispatch', cadence: 'per month', basis: 'any trade, one number to text', unitCents: 7900, annualCents: 7900 * 12 };

/** Price every service for a property. */
export function priceAll(m) {
  return SERVICES.map(s => ({ id: s.id, unitCents: s.price(m), annualCents: s.price(m) * s.cadence.perYear }));
}

/** Price a selection; unknown ids are ignored so a stale cart can't price a phantom service. */
export function priceSelection(m, ids) {
  const chosen = SERVICES.filter(s => ids.includes(s.id));
  const lines = chosen.map(s => ({ id: s.id, name: s.name, cadence: s.cadence.label, basis: s.basis(m),
    unitCents: s.price(m), annualCents: s.price(m) * s.cadence.perYear }));
  return { lines,
    firstVisitCents: lines.reduce((a, l) => a + l.unitCents, 0),
    annualCents: lines.reduce((a, l) => a + l.annualCents, 0) };
}

export const money = cents => (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
