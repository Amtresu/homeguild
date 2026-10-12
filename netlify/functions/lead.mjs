// POST lead from the Free (contractor introduction) or Managed (quote request) forms.
// Validates, drops bots, and records the lead. Nothing here is paid or trusted.
const TIERS = new Set(['free', 'managed']);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  let b;
  try { b = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }

  if (b.website) return json({ ok: true }); // honeypot filled: pretend success, record nothing
  const tier = TIERS.has(b.tier) ? b.tier : null;
  const name = str(b.name, 80), email = str(b.email, 120).toLowerCase(), phone = str(b.phone, 30);
  const picked = Array.isArray(b.picked) ? b.picked.map(x => str(x, 40)).filter(Boolean).slice(0, 12) : [];
  if (!tier || !name || !EMAIL.test(email)) return json({ error: 'Name and email are required.' }, 400);
  if (tier === 'managed' && !picked.length) return json({ error: 'Pick at least one thing for the plan to cover.' }, 400);
  if (tier === 'free' && !b.consent) return json({ error: 'Please tick the box so we can act on this.' }, 400);
  if (tier !== 'free' && !phone) return json({ error: 'A phone number is needed.' }, 400);

  const lead = {
    tier, name, email, phone, picked,
    notes: str(b.notes, 1000), when: str(b.when, 120),
    address: str(b.address, 200), parcel: b.parcel || null, measurements: b.measurements || null,
    receivedAt: new Date().toISOString(), ip: req.headers.get('x-nf-client-connection-ip') || null,
  };
  // TODO(supabase): insert into leads. Free: fan out to ≤2 register firms per trade and record the
  // introduction fee. Monthly: open a Stripe subscription after the reviewer's confirmation call.
  // Until then the function log is the inbox.
  console.log('lead', JSON.stringify(lead));
  return json({ ok: true });
};

const str = (v, max) => String(v ?? '').trim().slice(0, max);
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
