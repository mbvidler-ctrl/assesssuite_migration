import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    const { stripeCustomerId } = await req.json();
    const stripeKey = Deno.env.get("Stripe_Secret_Key") || "";
    const appUrl = Deno.env.get("APP_URL") || "https://demo.unimatter.com.au";
    if (!stripeCustomerId) return new Response(JSON.stringify({ error: "No Stripe customer ID found." }), { status: 400, headers: { "Content-Type": "application/json" } });
    const params = new URLSearchParams();
    params.append("customer", stripeCustomerId);
    params.append("return_url", appUrl + "/Settings");
    const response = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: { "Authorization": "Bearer " + stripeKey, "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString()
    });
    const session = await response.json();
    if (!response.ok) throw new Error(session.error?.message || "Stripe error");
    return new Response(JSON.stringify({ url: session.url }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});