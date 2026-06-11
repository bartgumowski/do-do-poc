// /api/expense-pay.js
// Serves a Stripe Payment Element page for paying a shared expense.
// Route: /pay/:intentId via vercel.json rewrite -> /api/expense-pay?intent=:intentId
//
// No login required - just the PaymentIntent client_secret is needed.

// Lazy Stripe init - without STRIPE_SECRET_KEY the function must not crash
// at load time (Stripe account not created yet).
let _stripe = null;
function getStripe() {
  if (!_stripe && process.env.STRIPE_SECRET_KEY) {
    _stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}

module.exports = async function handler(req, res) {
  const stripe = getStripe();
  if (!stripe) {
    return res.status(503).send(errorPage("Payments not available.", "Payments are not set up yet. Please try again later."));
  }

  const intentId = req.query?.intent || "";

  if (!intentId || !intentId.startsWith("pi_")) {
    return res.status(400).send(errorPage("Invalid payment link.", "The link you followed is not valid."));
  }

  let intent;
  try {
    intent = await stripe.paymentIntents.retrieve(intentId);
  } catch (err) {
    return res.status(404).send(errorPage("Payment not found.", "This payment link may have expired."));
  }

  // Already paid
  if (intent.status === "succeeded") {
    return res.status(200).send(successPage());
  }

  // Canceled or other terminal state
  if (["canceled", "requires_payment_method"].includes(intent.status) && intent.cancellation_reason) {
    return res.status(200).send(errorPage("Payment unavailable.", "This payment request is no longer active."));
  }

  const pk = process.env.STRIPE_PUBLISHABLE_KEY || "";
  const amount = (intent.amount / 100).toFixed(2);
  const currency = intent.currency.toUpperCase();
  const description = intent.description || "Shared expense";
  const clientSecret = intent.client_secret;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Pay ${currency} ${amount} - Do-Do</title>
  <script src="https://js.stripe.com/v3/"></script>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,-apple-system,sans-serif;background:#f9fafb;color:#111827;
         min-height:100vh;display:flex;flex-direction:column;align-items:center;
         justify-content:flex-start;padding:24px 16px}
    .card{background:#fff;border-radius:20px;padding:32px;max-width:440px;width:100%;
          box-shadow:0 1px 12px rgba(0,0,0,.09);margin-top:24px}
    .logo{font-weight:800;font-size:18px;letter-spacing:-.5px;margin-bottom:28px;
          color:#111827;display:flex;align-items:center;gap:8px}
    .logo-dot{width:8px;height:8px;background:#111827;border-radius:50%;display:inline-block}
    h1{font-size:32px;font-weight:800;margin-bottom:4px;letter-spacing:-1px}
    .desc{color:#6b7280;font-size:15px;margin-bottom:28px;line-height:1.4}
    #payment-element{margin-bottom:20px}
    #pay-btn{width:100%;padding:16px;background:#111827;color:#fff;border:none;
             border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;
             transition:opacity .15s;letter-spacing:-.2px}
    #pay-btn:hover:not(:disabled){opacity:.85}
    #pay-btn:disabled{opacity:.45;cursor:not-allowed}
    #error-msg{margin-top:14px;font-size:14px;color:#ef4444;text-align:center;min-height:20px}
    .powered{margin-top:20px;color:#9ca3af;font-size:12px;text-align:center}
    .spinner{display:inline-block;width:16px;height:16px;border:2px solid rgba(255,255,255,.4);
             border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;vertical-align:middle;margin-right:8px}
    @keyframes spin{to{transform:rotate(360deg)}}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo"><span class="logo-dot"></span>Do-Do</div>
    <h1>${currency} ${amount}</h1>
    <p class="desc">${escapeHtml(description)}</p>
    <div id="payment-element"></div>
    <button id="pay-btn" type="button">Pay ${currency} ${amount}</button>
    <div id="error-msg"></div>
    <p class="powered">Secure payment by Stripe &middot; Apple Pay &amp; Google Pay supported</p>
  </div>

  <script>
    const stripe = Stripe(${JSON.stringify(pk)});
    const clientSecret = ${JSON.stringify(clientSecret)};
    const btnLabel = ${JSON.stringify("Pay " + currency + " " + amount)};
    let elements;

    (async () => {
      elements = stripe.elements({
        clientSecret,
        appearance: {
          theme: "stripe",
          variables: {
            colorPrimary: "#111827",
            borderRadius: "10px",
            fontFamily: "system-ui, -apple-system, sans-serif",
          },
        },
      });
      const pe = elements.create("payment", { layout: "tabs" });
      pe.mount("#payment-element");
    })();

    const btn = document.getElementById("pay-btn");
    const errEl = document.getElementById("error-msg");

    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span>Processing...';
      errEl.textContent = "";

      const returnUrl = window.location.origin + window.location.pathname + "?done=1";
      const { error } = await stripe.confirmPayment({ elements, confirmParams: { return_url: returnUrl } });

      if (error) {
        errEl.textContent = error.message;
        btn.disabled = false;
        btn.textContent = btnLabel;
      }
      // On success Stripe redirects to return_url automatically.
    });
  </script>
</body>
</html>`);
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function successPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Payment complete - Do-Do</title>
<style>body{font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center;
  min-height:100vh;margin:0;background:#f9fafb;color:#111827;text-align:center;padding:24px}
.icon{font-size:56px;margin-bottom:16px}h1{font-size:28px;font-weight:800;margin-bottom:8px}
p{color:#6b7280;margin-bottom:28px}a{color:#111827;font-weight:700;text-decoration:none;
  border-bottom:2px solid #111827;padding-bottom:2px}</style>
</head>
<body><div>
  <div class="icon">&#10003;</div>
  <h1>Payment complete</h1>
  <p>The expense has been marked as paid. Thank you!</p>
  <a href="https://do-do.app">Back to Do-Do</a>
</div></body></html>`;
}

function errorPage(title, detail) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} - Do-Do</title>
<style>body{font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center;
  min-height:100vh;margin:0;background:#f9fafb;color:#111827;text-align:center;padding:24px}
h1{font-size:24px;font-weight:800;margin-bottom:8px}p{color:#6b7280;margin-bottom:28px}
a{color:#111827;font-weight:700}</style>
</head>
<body><div>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(detail)}</p>
  <a href="https://do-do.app">Go to Do-Do</a>
</div></body></html>`;
}
