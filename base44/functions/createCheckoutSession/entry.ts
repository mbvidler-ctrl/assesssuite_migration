import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    const { plan, priceId: directPriceId, userId, userEmail, userName, successUrl, cancelUrl } = await req.json();
    const stripeKey = Deno.env.get("Stripe_Secret_Key") || "";
    const appUrl = Deno.env.get("APP_URL") || "https://preview--clinic-flow-774f3d05.base44.app";
    const priceId = directPriceId || (plan === "annual" ? "price_1TbH07LVAtM9m2RxqiPCaZ8M" : "price_1TbH07LVAtM9m2RxqiPCaZ8M");
    const params = new URLSearchParams();
    params.append("mode", "subscription");
    params.append("line_items[0][price]", priceId);
    params.append("line_items[0][quantity]", "1");
    params.append("success_url", successUrl || appUrl + "/Dashboard");
    params.append("cancel_url", cancelUrl || appUrl + "/PaymentRequired");
    if (userEmail) params.append("customer_email", userEmail);
    if (userId) params.append("client_reference_id", userId);
    if (userId) params.append("metadata[userId]", userId);
    if (userEmail) params.append("metadata[userEmail]", userEmail);
    if (userId) params.append("subscription_data[metadata][userId]", userId);
    if (userEmail) params.append("subscription_data[metadata][userEmail]", userEmail);
    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
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