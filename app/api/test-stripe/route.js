import Stripe from 'stripe';

export async function GET() {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const balance = await stripe.balance.retrieve();
    return Response.json({ ok: true, message: `Connected (${balance.livemode ? 'LIVE mode' : 'test mode'}).` });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
