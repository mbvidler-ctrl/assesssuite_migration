import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stripeKey = Deno.env.get("Stripe_Secret_Key") || "";
    if (!stripeKey) {
      return Response.json({ error: 'Stripe key not configured' }, { status: 500 });
    }

    // Find customer by email
    const customersRes = await fetch(`https://api.stripe.com/v1/customers?email=${encodeURIComponent(user.email)}&limit=1`, {
      headers: { "Authorization": `Bearer ${stripeKey}` }
    });
    const customersData = await customersRes.json();
    
    if (!customersData.data || customersData.data.length === 0) {
      return Response.json({ error: 'No Stripe customer found for this email' }, { status: 404 });
    }

    const customer = customersData.data[0];
    
    // Get subscriptions for this customer
    const subsRes = await fetch(`https://api.stripe.com/v1/subscriptions?customer=${customer.id}&limit=1`, {
      headers: { "Authorization": `Bearer ${stripeKey}` }
    });
    const subsData = await subsRes.json();
    
    if (!subsData.data || subsData.data.length === 0) {
      return Response.json({ error: 'No active subscription found' }, { status: 404 });
    }

    const subscription = subsData.data[0];
    
    // Update user record
    const updateData = {
      subscription_status: subscription.status === 'active' ? 'active' : subscription.status,
      stripe_customer_id: customer.id,
      stripe_subscription_id: subscription.id,
      subscription_start_date: new Date(subscription.current_period_start * 1000).toISOString()
    };
    
    await base44.auth.updateMe(updateData);
    
    return Response.json({ 
      success: true, 
      message: `Subscription synced. Status: ${updateData.subscription_status}`,
      data: updateData
    });
  } catch (error) {
    console.error("Sync error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});