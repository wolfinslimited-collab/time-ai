# Timeless Studio launch runbook

## What is implemented

- `https://timelessapp.ai/studio` is routed by the existing Flutter web app.
- Timeless Supabase Auth is reused; there is no second account system.
- Projects, realtime generations, private inputs/outputs, wallets, and the
  credit ledger use the existing Studio schema and RLS.
- Kie Market tasks are created only by `studio-kie-adapter`. The key never
  reaches Flutter. Kie completion is re-read from the authenticated Kie status
  endpoint before a result is copied into private Timeless storage.
- Stripe hosted Checkout sells server-controlled one-time credit packs.
  Credits are granted only from a signature-verified, paid Checkout webhook.
- The existing Timeless admin portal has an **AI Studio** section for model
  activation, generation prices, credit packs, recent jobs, and provider-cost
  review.

## Pricing model

Generation prices and pack prices are independent, admin-editable controls:

- `studio_models.credit_cost` is the exact quote reserved before generation.
- `studio_models.provider_credit_cost` is an audit hint based on observed Kie
  usage; the completed task's actual value is stored on the generation.
- failed or canceled generations refund their complete reserved charge once;
- Stripe packs launch at 1,000 / 3,500 / 10,000 credits for $9.99 / $29.99 /
  $79.99, with volume discounts;
- variable-cost options are separate model rows. Do not add a browser parameter
  that can increase provider cost beyond the row's fixed customer quote.

Before enabling a new model, run a small test matrix for every allowed quality,
duration, and input mode, then set customer credits high enough to cover the
worst observed Kie cost, Stripe fees, storage/egress, failures, and target gross
margin. Recheck the admin provider-cost column weekly at launch.

## Required server secrets

Copy names from `supabase/functions/.env.studio.example`. Set values in the
Supabase secret manager; do not commit a populated file.

```sh
supabase secrets set \
  KIE_API_KEY=... \
  STUDIO_PROVIDER_SUBMIT_URL=https://YOUR_PROJECT_REF.supabase.co/functions/v1/studio-kie-adapter \
  STUDIO_PROVIDER_API_KEY=... \
  STUDIO_CLEANUP_SECRET=... \
  STRIPE_SECRET_KEY=... \
  STRIPE_WEBHOOK_SECRET=... \
  STUDIO_WEB_URL=https://timelessapp.ai/studio \
  STUDIO_ALLOWED_ORIGIN=https://timelessapp.ai
```

Store the exact same `STUDIO_CLEANUP_SECRET` in Supabase Vault under
`studio_cleanup_secret`. The scheduled database job reads it from Vault when
calling the cleanup function:

```sql
select vault.create_secret(
  'PASTE_THE_SAME_STUDIO_CLEANUP_SECRET',
  'studio_cleanup_secret'
);
```

`STUDIO_PROVIDER_API_KEY` must be a new random server-to-server value. The
legacy `STUDIO_PROVIDER_WEBHOOK_SECRET` is still required only while the older
generic provider webhook is deployed.

## Stripe Dashboard

Create an event destination for:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/studio-stripe-webhook
```

Subscribe to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`

Use the endpoint's `whsec_...` signing secret as `STRIPE_WEBHOOK_SECRET`.
Checkout product and price data come from the trusted database pack row, so no
Stripe Price IDs are required for launch.

Add `https://timelessapp.ai/studio` to the Supabase Auth redirect allow-list so
email verification, password recovery, and social sign-in return to Studio.

## Deploy

```sh
supabase db push

for function in \
  studio-upload-url \
  studio-create-generation \
  studio-asset-url \
  studio-retain-asset \
  studio-cleanup \
  studio-refresh-generation \
  studio-kie-adapter \
  studio-stripe-checkout \
  studio-stripe-webhook
do
  supabase functions deploy "$function"
done

flutter build web --release
```

The production web host must rewrite `/studio` and `/studio/*` to
`/index.html`. Do not cache `index.html` aggressively; hashed Flutter assets can
be cached indefinitely.

## Smoke test

1. Open `/studio` signed out and use the normal Timeless sign-in.
2. Confirm a default project is created and the wallet reads `0`.
3. Add a temporary admin grant with `studio_add_credits` from the SQL editor.
4. Generate one 1K image; confirm queued → processing → succeeded and that the
   private output opens with an expiry date seven days in the future.
5. Keep that output and confirm its expiry disappears and it remains available.
6. Invoke `studio-cleanup` with an invalid secret and confirm it returns 401.
7. Force an invalid prompt/model failure and confirm one refund ledger entry.
8. Complete a Stripe test-mode pack purchase; confirm exactly one purchase
   ledger entry after replaying the webhook.
9. Open the admin portal, change a model price, and verify the new quote appears
   on `/studio` without a frontend deploy.

## Security notes

- Never put Kie, Stripe, service-role, or webhook secrets in Dart defines.
- Keep `studio-kie-adapter` and `studio-stripe-webhook` at `verify_jwt = false`;
  both perform their own request authentication. User-facing functions retain
  JWT verification and also validate the user inside the function.
- Kie callback URLs carry a per-job random token. A callback cannot finalize a
  job from its payload alone; the adapter verifies task state and result URLs
  through Kie's authenticated status API.
- Kie result URLs expire, so successful outputs are streamed immediately into
  private Timeless storage.
- Ready inputs, outputs, and thumbnails expire after seven days. Incomplete
  uploads expire after one day. The hourly cleanup job removes expired Storage
  objects through the Storage API while retaining metadata for history and
  billing. Owners can explicitly keep completed output assets.
