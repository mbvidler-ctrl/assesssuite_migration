import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
  if (sig && webhookSecret) {
    try {
      const parts = sig.split(",");
      const t = parts.find(p => p.startsWith("t="))?.split("=")[1];
      const v1 = parts.find(p => p.startsWith("v1="))?.split("=")[1];
      const signed = t + "." + body;
      const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(webhookSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signed));
      const expected = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2,"0")).join("");
      if (expected !== v1) return new Response("Invalid signature", { status: 400 });
    } catch { return new Response("Signature error", { status: 400 }); }
  }
  let event;
  try { event = JSON.parse(body); } catch { return new Response("Invalid JSON", { status: 400 }); }

  const base44 = createClientFromRequest(req);

  try {
     if (event.type === "checkout.session.completed") {
       const s = event.data.object;
       const data = { account_status: "active", subscription_status: "active", stripe_customer_id: s.customer, stripe_subscription_id: s.subscription, subscription_start_date: new Date().toISOString() };
       let updated = false;

       // Try client_reference_id first
       if (s.client_reference_id) {
         try {
           await base44.asServiceRole.entities.User.update(s.client_reference_id, data);
           updated = true;
         } catch (e) {
           console.log("Failed to update by client_reference_id, trying email...", e);
         }
       }

       // If not updated, try by email (case-insensitive)
       if (!updated && (s.customer_email || s.customer_details?.email)) {
         const email = (s.customer_email || s.customer_details.email).toLowerCase();
         const users = await base44.asServiceRole.entities.User.filter({});
         const matchedUser = users?.find(u => u.email?.toLowerCase() === email);
         if (matchedUser) {
           await base44.asServiceRole.entities.User.update(matchedUser.id, data);
           updated = true;
         }
       }

       if (!updated) {
         console.warn("Could not find user for checkout session", { client_ref: s.client_reference_id, email: s.customer_email || s.customer_details?.email });
       }
     }
    if (event.type === "customer.subscription.deleted" || event.type === "customer.subscription.paused") {
      const s = event.data.object;
      const data = { account_status: "suspended", subscription_status: "cancelled" };
      if (s.metadata?.userId) {
        await base44.asServiceRole.entities.User.update(s.metadata.userId, data);
      } else if (s.metadata?.userEmail) {
        const users = await base44.asServiceRole.entities.User.filter({ email: s.metadata.userEmail });
        if (users?.length > 0) await base44.asServiceRole.entities.User.update(users[0].id, data);
      }
    }
    if (event.type === "invoice.payment_failed") {
      const users = await base44.asServiceRole.entities.User.filter({ stripe_customer_id: event.data.object.customer });
      if (users?.length > 0) await base44.asServiceRole.entities.User.update(users[0].id, { account_status: "suspended", subscription_status: "payment_failed" });
    }
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response("Internal error", { status: 500 });
  }
  return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
});