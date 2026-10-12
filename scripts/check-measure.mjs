// Smoke test for the address → parcel pipeline. Run: npm run test:measure
// Fails loudly if any address stops resolving; this is the one thing the site cannot lose.
import { measureServer } from '../site/js/measure.js';

const CASES = [
  // [input as a person would type it, expected county, expected parcel (null = any)]
  ['11334 West Fitzwilliam Loop', 'Canyon', null],            // no city
  ['11334 W Fitzwilliam Loop, Nampa', 'Canyon', 'R3145622200'],
  ['2808 S Colorado Ave', 'Ada', 'R1007120010'],               // exact assessor-address match
  ['2808 S Colorado Ave, Boise, ID 83706', 'Ada', 'R1007120010'],
  ['1715 N 21st St, Boise', 'Ada', null],
  ['412 E Parkcenter Blvd', 'Ada', null],
];
const SHOULD_FAIL = ['asdf qwerty', '123 Main St, Twin Falls'];

let bad = 0;
for (const [input, county, parcel] of CASES) {
  const t = Date.now();
  try {
    const r = await measureServer(input);
    const ok = r.parcel.county === county && (!parcel || r.parcel.parcelId === parcel);
    if (!ok) bad++;
    console.log(ok ? 'ok  ' : 'FAIL', JSON.stringify(input), '→', r.parcel.county, r.parcel.parcelId, r.parcel.lotSqft + ' sqft', r.parcel.match, (Date.now() - t) + 'ms');
  } catch (e) {
    bad++; console.log('FAIL', JSON.stringify(input), '→', e.message);
  }
}
for (const input of SHOULD_FAIL) {
  try { await measureServer(input); bad++; console.log('FAIL', JSON.stringify(input), '→ resolved but should not have'); }
  catch (e) { console.log('ok  ', JSON.stringify(input), '→ rejected:', e.message); }
}
console.log(bad ? `\n${bad} failing` : '\nall good');
process.exit(bad ? 1 : 0);
