# Northstall - release-ready marketplace demo

Interactive demo of an Expo + Supabase + Stripe Connect Express marketplace, prepared for App Store and Google Play release.

**Live demo:** open the GitHub Pages link of this repository.

## What the demo shows

| Section | What you can try |
|---|---|
| Live prototype | Sign in, onboard as a seller (Express), get verified by webhook, list an item, buy with a test card. A side panel shows every Edge Function call, signed webhook and database row. |
| Money flow (3D) | Change price and platform fee. See what buyer, seller and platform really keep with destination charges. |
| Row level security | Pick a user and a query. See which rows RLS returns, with the matching policy highlighted in the real migration. |
| OTA updates | Publish, promote, add a native module, rebuild, roll back. See how channels, branches and the fingerprint runtime protect old builds. |
| Store review | Pre-flight checklist for App Store and Google Play. |

The web demo is a simulation that runs in the browser in test mode. No real payments, no real data.

## Reference implementation in this repo

```
supabase/
  migrations/20261120000000_marketplace.sql   schema + RLS policies + signup trigger
  functions/_shared/clients.ts                Stripe + service-role client, auth helper
  functions/stripe-onboarding/index.ts        Express account + Account Link
  functions/create-payment/index.ts           destination charge with application fee
  functions/stripe-webhook/index.ts           signed, idempotent webhook handler
  functions/delete-account/index.ts           in-app account deletion
  config.toml                                 verify_jwt off for the webhook only
src/checkout.ts                               PaymentSheet flow in the app
eas.json                                      development / preview / production channels
app.json                                      fingerprint runtime policy, updates URL
```

Photo and video credits: [assets/CREDITS.md](assets/CREDITS.md). Northstall is a fictional brand.
