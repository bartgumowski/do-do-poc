// /api/stripe-create-checkout.js
// Creates a Stripe Checkout session for upgrading to Do-Do Family plan.
// Input (POST body): { priceId, userId, pairId, successUrl, cancelUrl }
// Output: { url } - redirect the user to this URL to complete payment.

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { priceId, userId, pairId, successUrl, cancelUrl } = req.body || {};

  if (!priceId || !userId || !pairId) {
    return res.status(400).json({ error: "Missing required fields: priceId, userId, pairId" });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: "Stripe not configured" });
  }

  try {
    // Look up or create Stripe customer for this user
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id, display_name")
      .eq("id", userId)
      .maybeSingle();

    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      // Get user email from auth
      const { data: { user } } = await supabase.auth.admin.getUserById(userId);
      const customer = await stripe.customers.create({
        email: user?.email,
        name: profile?.display_name || undefined,
        metadata: { userId, pairId },
      });
      customerId = customer.id;

      // Persist customer ID on profile
      await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", userId);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl || `${req.headers.origin || ""}/?checkout=success`,
      cancel_url: cancelUrl || `${req.headers.origin || ""}/?checkout=cancelled`,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { pairId },
        trial_period_days: 14,
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("stripe-create-checkout error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
