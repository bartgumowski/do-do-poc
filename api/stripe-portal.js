// /api/stripe-portal.js
// Creates a Stripe Customer Portal session so the user can manage their subscription.
// Input (POST body): { userId }
// Output: { url } - redirect user to Stripe's hosted billing portal.

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

  const { userId } = req.body || {};

  if (!userId) {
    return res.status(400).json({ error: "userId required" });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: "Stripe not configured" });
  }

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", userId)
      .maybeSingle();

    const customerId = profile?.stripe_customer_id;

    if (!customerId) {
      return res.status(404).json({ error: "No billing account found. Please subscribe first." });
    }

    const returnUrl = req.headers.origin
      ? `${req.headers.origin}/#settings`
      : process.env.APP_URL
      ? `${process.env.APP_URL}/#settings`
      : "https://do-do.app/#settings";

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return res.status(200).json({ url: portalSession.url });
  } catch (err) {
    console.error("stripe-portal error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
