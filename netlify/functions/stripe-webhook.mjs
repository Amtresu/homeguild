// Stripe → us. Verifies the signature, then records the order.
// Anything unsigned is dropped; nobody can mark an order paid by POSTing here.
import Stripe from 'stripe';

export default async (req) => {
  const key = process.env.STRIPE_SECRET_KEY, secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!key || !secret) return new Response('Not configured', { status: 503 });
  const stripe = new Stripe(key);

  let event;
  try {
    event = stripe.webhooks.constructEvent(await req.text(), req.headers.get('stripe-signature'), secret);
  } catch (e) {
    return new Response(`Bad signature: ${e.message}`, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const s = event.data.object;
    // TODO(supabase): insert into orders {session: s.id, email: s.customer_details?.email,
    //   address: s.metadata.address, parcel: s.metadata.parcel, services: s.metadata.services,
    //   amount: s.amount_total, status: 'authorized'} and notify dispatch.
    console.log('order authorized', s.id, s.metadata.parcel, s.metadata.services, s.amount_total);
  }
  return new Response('ok');
};
