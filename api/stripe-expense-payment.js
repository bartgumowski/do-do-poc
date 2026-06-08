// /api/stripe-expense-payment.js
// Creates a Stripe PaymentIntent for a shared expense and emails the co-parent a payment link.
//
// POST body: { cardId, amount, currency, description, requestedByName }
// Returns:   { paymentUrl, intentId, emailSent }
//
// Env vars required (same as SEG-05):
//   STRIPE_SECRET_KEY, RESEND_API_KEY (optional), RESEND_FROM_EMAIL (optional)
// New env var:
//   VERCEL_PROJECT_PRODUCTION_URL or APP_BASE_URL - used to build the /pay/:id link

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function baseUrl() {
  // Vercel sets VERCEL_URL for preview deployments; prefer APP_BASE_URL for prod.
  const url = process.env.APP_BASE_URL || process.env.VERCEL_URL;
  if (!url) return "https://do-do.app";
  return url.startsWith("http") ? url : `https://${url}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    cardId,
    amount,
    currency = "chf",
    description,
    requestedByName,
  } = req.body || {};

  if (!cardId || !amount) {
    return res.status(400).json({ error: "cardId and amount are required" });
  }

  const amountFloat = parseFloat(amount);
  if (isNaN(amountFloat) || amountFloat < 0.5) {
    return res.status(400).json({ error: "Invalid amount (minimum 0.50)" });
  }
  const amountCents = Math.round(amountFloat * 100);

  try {
    // 1. Look up card to verify it exists and get pair_id
    const { data: card, error: cardErr } = await supabase
      .from("unified_cards")
      .select("id, pair_id, title")
      .eq("id", cardId)
      .single();

    if (cardErr || !card) {
      return res.status(404).json({ error: "Card not found" });
    }

    // 2. Get co-parent email from the pair record
    const { data: pair } = await supabase
      .from("pairs")
      .select("invite_email")
      .eq("id", card.pair_id)
      .single();

    const coParentEmail = pair?.invite_email || null;

    // 3. Create Stripe PaymentIntent
    const intent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: currency.toLowerCase(),
      description: description || `Do-Do expense: ${card.title || cardId}`,
      metadata: { cardId, pairId: card.pair_id },
      automatic_payment_methods: { enabled: true },
    });

    const paymentUrl = `${baseUrl()}/pay/${intent.id}`;

    // 4. Update card columns in Supabase
    const { error: updateErr } = await supabase
      .from("unified_cards")
      .update({
        payment_intent_id: intent.id,
        payment_status: "pending",
        payment_amount: amountFloat,
      })
      .eq("id", cardId);

    if (updateErr) {
      console.error("Card payment update failed:", updateErr.message);
    }

    // 5. Email co-parent if possible
    let emailSent = false;
    if (coParentEmail && process.env.RESEND_API_KEY) {
      try {
        const { Resend } = require("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        const from = process.env.RESEND_FROM_EMAIL || "Do-Do <onboarding@resend.dev>";
        const currencyLabel = currency.toUpperCase();
        const amountLabel = `${currencyLabel} ${amountFloat.toFixed(2)}`;
        const cardTitle = card.title || "shared expense";
        const requester = requestedByName || "Your co-parent";

        await resend.emails.send({
          from,
          to: coParentEmail,
          subject: `Payment request: ${amountLabel} for "${cardTitle}"`,
          html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;background:#f9fafb;margin:0;padding:32px">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;box-shadow:0 1px 8px rgba(0,0,0,.07)">
    <p style="font-weight:800;font-size:20px;margin:0 0 4px">Do-Do</p>
    <p style="color:#6b7280;font-size:14px;margin:0 0 24px">Family coordination</p>
    <h1 style="font-size:28px;font-weight:800;margin:0 0 4px">${amountLabel}</h1>
    <p style="color:#374151;margin:0 0 8px"><strong>${requester}</strong> is requesting payment for:</p>
    <p style="font-size:18px;font-weight:700;color:#111827;margin:0 0 28px">${cardTitle}</p>
    <a href="${paymentUrl}"
       style="display:inline-block;padding:14px 28px;background:#111827;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px">
      Pay ${amountLabel}
    </a>
    <p style="margin-top:24px;color:#9ca3af;font-size:13px">
      Secure payment via card, Apple Pay, or Google Pay. Powered by Stripe.
    </p>
  </div>
</body>
</html>`,
        });
        emailSent = true;
      } catch (emailErr) {
        console.error("Payment email send failed:", emailErr.message);
      }
    }

    return res.status(200).json({ paymentUrl, intentId: intent.id, emailSent });
  } catch (err) {
    console.error("stripe-expense-payment error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
