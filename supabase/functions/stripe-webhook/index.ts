import Stripe from "npm:stripe@^22";
import { adminClient } from "../_shared/supabase.ts";

const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const stripe = new Stripe(stripeSecret);
const cryptoProvider = Stripe.createSubtleCryptoProvider();

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!stripeSecret || !webhookSecret) return new Response("Webhook not configured", { status: 503 });

  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing Stripe signature", { status: 400 });

  let event: Stripe.Event;
  try {
    const rawBody = await req.text();
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider
    );
  } catch (error) {
    console.error("Invalid Stripe signature", error);
    return new Response("Invalid signature", { status: 400 });
  }

  if (!["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) {
    return Response.json({ received: true, ignored: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== "paid") {
    return Response.json({ received: true, ignored: true, reason: "not paid" });
  }

  const campaignId = session.metadata?.campaign_id;
  const amountCents = session.amount_total;
  const currency = session.currency;
  if (!campaignId || !amountCents || amountCents <= 0 || !currency) {
    console.error("Missing checkout data", { sessionId: session.id, campaignId, amountCents, currency });
    return new Response("Missing checkout data", { status: 400 });
  }

  try {
    const supabase = adminClient();
    const { data, error } = await supabase.rpc("record_stripe_donation", {
      p_session_id: session.id,
      p_event_id: event.id,
      p_campaign_id: campaignId,
      p_amount_cents: amountCents,
      p_currency: currency
    });
    if (error) throw error;
    console.log("Donation recorded", data);
    return Response.json({ received: true, result: data });
  } catch (error) {
    console.error("Database error", error);
    // Restituendo 500 Stripe riproverà automaticamente il webhook.
    return new Response("Database error", { status: 500 });
  }
});
