// Client-side config - these are publishable/public keys, safe to expose.
// Update Stripe price IDs in the Stripe dashboard, then paste them here.
// VAPID public key must match VAPID_PUBLIC_KEY env var in Vercel.

window.VAPID_PUBLIC_KEY = "BL9FXxBgvISw1EY0bPxQrvFAFn4qvIstvvgXi297IdM8rMw9sMb6oun0o8c1SPlWryK05_AHv6g0MPPQsUx4oVI";

// Switzerland (CHF 9.90/mo, CHF 89/yr)
window.STRIPE_MONTHLY_PRICE_ID     = ""; // price_xxx  CHF 9.90/mo
window.STRIPE_ANNUAL_PRICE_ID      = ""; // price_xxx  CHF 89/yr

// Poland (PLN 19/mo, PLN 169/yr)
window.STRIPE_MONTHLY_PRICE_ID_PLN = ""; // price_xxx  PLN 19/mo
window.STRIPE_ANNUAL_PRICE_ID_PLN  = ""; // price_xxx  PLN 169/yr

// Germany / Austria / EU (EUR 7.90/mo, EUR 69/yr)
window.STRIPE_MONTHLY_PRICE_ID_EUR = ""; // price_xxx  EUR 7.90/mo
window.STRIPE_ANNUAL_PRICE_ID_EUR  = ""; // price_xxx  EUR 69/yr
