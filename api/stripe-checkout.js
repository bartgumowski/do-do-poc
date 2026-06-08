// Consolidated Stripe checkout endpoint
// POST body must include { action: "create" | "expense", ...params }

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function baseUrl(req) {
  const url = process.env.APP_BASE_URL || process.env.VERCEL_URL;
  if (!url) return "https://do-do.app";
  return url.startsWith("http") ? url : `https://${url}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!process.env.STRIPE_SECRET_KEY) return res.status(503).json({ error: "Stripe not configured" });

  const { action, ...params } = req.body || {};

  // ── create subscription checkout ──────────────────────────────────────────
  if (action === "create") {
    const { priceId, userId, pairId, successUrl, cancelUrl } = params;
    if (!priceId || !userId || !pairId) {
      return res.status(400).json({ error: "Missing required fields: priceId, userId, pairId" });
    }

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("stripe_customer_id, display_name")
        .eq("id", userId)
        .maybeSingle();

      let customerId = profile?.stripe_customer_id;

      if (!customerId) {
        const { data: { user } } = await supabase.auth.admin.getUserById(userId);
        const customer = await stripe.customers.create({
          email: user?.email,
          name: profile?.display_name || undefined,
          metadata: { userId, pairId },
        });
        customerId = customer.id;
        await supabase.from("profiles").update({ stripe_customer_id: customerId }).eq("id", userId);
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: successUrl || `${req.headers.origin || ""}/?checkout=success`,
        cancel_url: cancelUrl || `${req.headers.origin || ""}/?checkout=cancelled`,
        allow_promotion_codes: true,
        metadata: { pairId },
        subscription_data: { metadata: { pairId }, trial_period_days: 14 },
      });

      return res.status(200).json({ url: session.url });
    } catch (err) {
      console.error("stripe-checkout/create error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  // ── expense payment intent ─────────────────────────────────────────────────
  if (action === "expense") {
    const { cardId, amount, currency = "chf", description, requestedByName } = params;
    if (!cardId || !amount) return res.status(400).json({ error: "cardId and amount are required" });

    const amountFloat = parseFloat(amount);
    if (isNaN(amountFloat) || amountFloat < 0.5) {
      return res.status(400).json({ error: "Invalid amount (minimum 0.50)" });
    }
    const amountCents = Math.round(amountFloat * 100);

    try {
      const { data: card, error: cardErr } = await supabase
        .from("unified_cards")
        .select("id, pair_id, title")
        .eq("id", cardId)
        .single();

      if (cardErr || !card) return res.status(404).json({ error: "Card not found" });

      const { data: pair } = await supabase
        .from("pairs")
        .select("invite_email")
        .eq("id", card.pair_id)
        .single();

      const coParentEmail = pair?.invite_email || null;

      const intent = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: currency.toLowerCase(),
        description: description || `Do-Do expense: ${card.title || cardId}`,
        metadata: { cardId, pairId: card.pair_id },
        automatic_payment_methods: { enabled: true },
      });

      const paymentUrl = `${baseUrl(req)}/pay/${intent.id}`;

      const { error: updateErr } = await supabase
        .from("unified_cards")
        .update({ payment_intent_id: intent.id, payment_status: "pending", payment_amount: amountFloat })
        .eq("id", cardId);

      if (updateErr) console.error("Card payment update failed:", updateErr.message);

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
            from, to: coParentEmail,
            subject: `Payment request: ${amountLabel} for "${cardTitle}"`,
            html: `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;background:#f9fafb;margin:0;padding:32px">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;box-shadow:0 1px 8px rgba(0,0,0,.07)">
    <p style="font-weight:800;font-size:20px;margin:0 0 4px">Do-Do</p>
    <p style="color:#6b7280;font-size:14px;margin:0 0 24px">Family coordination</p>
    <h1 style="font-size:28px;font-weight:800;margin:0 0 4px">${amountLabel}</h1>
    <p style="color:#374151;margin:0 0 8px"><strong>${requester}</strong> is requesting payment for:</p>
    <p style="font-size:18px;font-weight:700;color:#111827;margin:0 0 28px">${cardTitle}</p>
    <a href="${paymentUrl}" style="display:inline-block;padding:14px 28px;background:#111827;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px">Pay ${amountLabel}</a>
    <p style="margin-top:24px;color:#9ca3af;font-size:13px">Secure payment via card, Apple Pay, or Google Pay. Powered by Stripe.</p>
  </div>
</body></html>`,
          });
          emailSent = true;
        } catch (emailErr) {
          console.error("Payment email send failed:", emailErr.message);
        }
      }

      return res.status(200).json({ paymentUrl, intentId: intent.id, emailSent });
    } catch (err) {
      console.error("stripe-checkout/expense error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(400).json({ error: "Unknown action" });
};
