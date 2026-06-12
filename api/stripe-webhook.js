// /api/stripe-webhook.js
// Receives Stripe webhook events and updates subscription status in Supabase.
// Vercel: set STRIPE_WEBHOOK_SECRET to the signing secret from the Stripe dashboard.
// Events handled:
//   checkout.session.completed   -> subscription_status = 'active' (or 'trialing')
//   customer.subscription.updated -> sync status and period end
//   customer.subscription.deleted -> subscription_status = 'canceled'
//   invoice.payment_failed       -> subscription_status = 'past_due'

// Lazy Stripe init - without STRIPE_SECRET_KEY the function must not crash
// at load time (Stripe account not created yet).
let _stripe = null;
function getStripe() {
  if (!_stripe && process.env.STRIPE_SECRET_KEY) {
    _stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

async function updatePairSubscription(pairId, status, periodEnd = null) {
  if (!pairId) return;
  const update = { subscription_status: status };
  if (periodEnd !== null) update.subscription_period_end = periodEnd;
  const { error } = await supabase
    .from("pairs")
    .update(update)
    .eq("id", pairId);
  if (error) console.error("Pair update failed:", error.message);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // SEG-14: fail closed. Never process an unsigned webhook.
  const stripe = getStripe();
  if (!webhookSecret || !stripe) {
    console.error("Stripe webhook not configured - rejecting");
    return res.status(503).json({ error: "Webhook not configured" });
  }

  let event;
  try {
    const rawBody = await buffer(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;

        // Fetch subscription first - pairId lives in subscription metadata
        // (set via subscription_data.metadata at checkout creation).
        // session.metadata also holds pairId as a direct fallback.
        const sub = session.subscription
          ? await stripe.subscriptions.retrieve(session.subscription)
          : null;

        const pairId = sub?.metadata?.pairId || session.metadata?.pairId;
        if (!pairId) {
          console.warn("checkout.session.completed: no pairId found", session.id);
          break;
        }

        const status = sub?.status === "trialing" ? "trialing" : "active";
        const periodEnd = sub?.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null;

        await updatePairSubscription(pairId, status, periodEnd);
        console.log(`Pair ${pairId} -> ${status} (checkout.session.completed)`);
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object;
        const pairId = sub.metadata?.pairId;
        if (!pairId) break;

        const periodEnd = sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null;

        // Map Stripe statuses to our schema
        const statusMap = {
          active: "active",
          trialing: "trialing",
          past_due: "past_due",
          canceled: "canceled",
          unpaid: "past_due",
          incomplete: "past_due",
          incomplete_expired: "canceled",
          paused: "canceled",
        };
        const status = statusMap[sub.status] || "free";
        await updatePairSubscription(pairId, status, periodEnd);
        console.log(`Pair ${pairId} -> ${status} (customer.subscription.updated)`);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const pairId = sub.metadata?.pairId;
        if (!pairId) break;

        const periodEnd = sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null;

        await updatePairSubscription(pairId, "canceled", periodEnd);
        console.log(`Pair ${pairId} -> canceled (customer.subscription.deleted)`);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        // invoice.subscription_details.metadata has pairId if set on subscription
        const sub = invoice.subscription
          ? await stripe.subscriptions.retrieve(invoice.subscription)
          : null;
        const pairId = sub?.metadata?.pairId;
        if (!pairId) break;

        await updatePairSubscription(pairId, "past_due");
        console.log(`Pair ${pairId} -> past_due (invoice.payment_failed)`);
        break;
      }

      // SEG-06: expense one-time payment completed
      case "payment_intent.succeeded": {
        const intent = event.data.object;
        const { cardId } = intent.metadata || {};
        if (!cardId) break;

        const { error: cardErr } = await supabase
          .from("unified_cards")
          .update({ payment_status: "paid", payment_paid_at: new Date().toISOString() })
          .eq("id", cardId);

        if (cardErr) {
          console.error("payment_intent.succeeded card update failed:", cardErr.message);
        } else {
          console.log(`Card ${cardId} -> paid (payment_intent.succeeded)`);

          // SEG-16: append payment_confirmed ledger event (server-side, service role)
          const { pairId, amount, currency } = intent.metadata || {};
          if (pairId) {
            const ledgerRow = {
              pair_id: pairId,
              card_id: cardId,
              event_type: "payment_confirmed",
              actor_name: "Stripe",
              amount: amount ? parseFloat(amount) : null,
              currency: currency ? currency.toUpperCase() : null,
              stripe_intent_id: intent.id,
            };
            const { error: ledgerErr } = await supabase.from("expense_ledger").insert(ledgerRow);
            if (ledgerErr) console.warn("expense_ledger insert failed:", ledgerErr.message);
          }
        }
        break;
      }

      default:
        // Unhandled event - Stripe expects 200 regardless
        break;
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("Webhook handler error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
