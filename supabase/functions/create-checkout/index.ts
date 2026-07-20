import Stripe from "npm:stripe@^22";
import { corsHeaders, isAllowedOrigin, json, requestOrigin } from "../_shared/cors.ts";

const campaignPattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]{2,79}$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);
  if (!isAllowedOrigin(req)) return json(req, { error: "Origin not allowed" }, 403);

  try {
    const secret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!secret) return json(req, { error: "Stripe is not configured" }, 503);

    const body = await req.json();
    const amountCents = Number(body.amountCents);
    const campaignId = String(body.campaignId ?? "");
    const returnUrl = new URL(String(body.returnUrl ?? ""));
    const origin = requestOrigin(req);
    const minCents = Number(Deno.env.get("MIN_DONATION_CENTS") ?? 100);
    const maxCents = Number(Deno.env.get("MAX_DONATION_CENTS") ?? 100000);
    const currency = (Deno.env.get("DONATION_CURRENCY") ?? "eur").toLowerCase();

    if (!Number.isSafeInteger(amountCents) || amountCents < minCents || amountCents > maxCents) {
      return json(req, { error: `Amount must be between ${minCents} and ${maxCents} cents` }, 400);
    }
    if (!campaignPattern.test(campaignId)) return json(req, { error: "Invalid campaign id" }, 400);
    if (returnUrl.origin !== origin || !["http:", "https:"].includes(returnUrl.protocol)) {
      return json(req, { error: "Invalid return URL" }, 400);
    }

    returnUrl.search = "";
    returnUrl.hash = "";
    const stripe = new Stripe(secret);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        quantity: 1,
        price_data: {
          currency,
          unit_amount: amountCents,
          product_data: {
            name: "Riduzione ufficiale dello stress",
            description: `Contributo allo Stressometro · campagna ${campaignId}`
          }
        }
      }],
      metadata: { campaign_id: campaignId, source: "stressometro" },
      payment_intent_data: { metadata: { campaign_id: campaignId, source: "stressometro" } },
      success_url: `${returnUrl.toString()}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${returnUrl.toString()}?payment=cancelled`,
      locale: "it",
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60
    });

    if (!session.url) return json(req, { error: "Stripe did not return a checkout URL" }, 502);
    return json(req, { url: session.url });
  } catch (error) {
    console.error("create-checkout", error);
    return json(req, { error: "Unable to create checkout session" }, 500);
  }
});
