import { corsHeaders, json } from "../_shared/cors.ts";
import { adminClient } from "../_shared/supabase.ts";

const campaignPattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]{2,79}$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req, true) });
  if (req.method !== "GET") return json(req, { error: "Method not allowed" }, 405, true);

  try {
    const campaignId = new URL(req.url).searchParams.get("campaign") ?? "";
    if (!campaignPattern.test(campaignId)) return json(req, { error: "Invalid campaign id" }, 400, true);

    const supabase = adminClient();
    const { data, error } = await supabase
      .from("stress_campaigns")
      .select("id,total_cents,donation_count,currency,updated_at")
      .eq("id", campaignId)
      .maybeSingle();
    if (error) throw error;

    return json(req, {
      campaignId,
      totalCents: data?.total_cents ?? 0,
      donationCount: data?.donation_count ?? 0,
      currency: data?.currency ?? (Deno.env.get("DONATION_CURRENCY") ?? "eur"),
      updatedAt: data?.updated_at ?? null
    }, 200, true);
  } catch (error) {
    console.error("stats", error);
    return json(req, { error: "Unable to read campaign stats" }, 500, true);
  }
});
