// POST { address, lawnSqft, services[] } → { url } (Stripe Checkout)
// The browser's prices are never trusted: the property is re-measured and the
// selection re-priced here with the same catalog before a session is created.
// Card details never touch this code — Stripe's hosted page collects them.
import Stripe from 'stripe';
import { measureServer } from '../../site/js/measure.js';
import { deriveMeasurements, priceSelection, MEMBERSHIP } from '../../site/js/catalog.js';

export default async (req, context) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return json({ error: 'Checkout is not configured yet.' }, 503);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }
  const address = String(body.address || '').trim().slice(0, 200);
  const services = Array.isArray(body.services) ? body.services.map(String).slice(0, 20) : [];
  const lawnSqft = Number.isFinite(body.lawnSqft) ? body.lawnSqft : null;
  if (!address) return json({ error: 'Start with your address.' }, 400);

  let measured;
  try { measured = await measureServer(address); } catch (e) { return json({ error: e.message }, 422); }
  const m = deriveMeasurements(measured.parcel, { lawnSqft });
  const quote = priceSelection(m, services);
  // TODO(stripe): make the membership a recurring Price (mode 'subscription') once the product exists;
  // until then the first month is charged alongside the first visits.
  const lines = [MEMBERSHIP, ...quote.lines];

  const stripe = new Stripe(key);
  const origin = new URL(req.url).origin;
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    // First visit of each service is authorized now and captured when scheduled.
    payment_intent_data: { capture_method: 'manual', metadata: { address, parcel: measured.parcel.parcelId } },
    line_items: lines.map(l => ({
      quantity: 1,
      price_data: { currency: 'usd', unit_amount: l.unitCents, product_data: { name: l.name, description: `${l.basis} · ${l.cadence}` } },
    })),
    metadata: { address, parcel: measured.parcel.parcelId, county: measured.parcel.county, lawnSqft: String(m.lawnSqft), services: services.join(',') },
    success_url: `${origin}/welcome.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/quote.html`,
  }, { idempotencyKey: `${measured.parcel.parcelId}:${services.slice().sort().join(',')}:${m.lawnSqft}:${dayStamp()}` });

  return json({ url: session.url });
};

const dayStamp = () => new Date().toISOString().slice(0, 13); // one key per parcel+selection per hour
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
