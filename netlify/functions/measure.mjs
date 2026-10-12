// POST { address } → { geo, parcel }
// Server-side so the Census geocoder (no CORS) can be used and so the same
// measurement feeds checkout re-pricing.
import { measureServer } from '../../site/js/measure.js';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  let address;
  try { ({ address } = await req.json()); } catch { return json({ error: 'Bad request' }, 400); }
  address = String(address || '').trim().slice(0, 200);
  if (address.length < 6) return json({ error: 'Enter a street address.' }, 400);
  try {
    return json(await measureServer(address));
  } catch (e) {
    console.log('measure failed', JSON.stringify({ address, error: e.message }));
    return json({ error: e.message }, 422);
  }
};

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
