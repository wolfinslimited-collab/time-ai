# Studio pricing — 5 September 2026

Active image and video generation targets a minimum 30% margin after Kie API cost, before payment fees and other expenses. This is not a net profit forecast or a claim of lowest market pricing.

The lowest paid-credit value is the Production pack: $79.99 / 10,000 = $0.007999. Customer credits per request are `ceil(provider USD / (0.70 * 0.007999))`. Video rates retain fractional credits per second; only the final request is rounded. Smaller packs and integer rounding produce higher margins. Pack prices, purchased balances and historical charges are unchanged.

`studio-pricing-30pct.json` records the provider rates, previous and new prices, and pack assumptions. Kie rates were read from https://kie.ai/pricing. Wan 3.0 at 720p inconsistently lists 16 credits and $0.09; the higher dollar price is used conservatively. Recheck this discrepancy before lowering that variant further.

The SQL file applies all nine changes atomically, rejecting unexpected catalog changes or an active pack below the assumed credit value. The identical migration is retained in the main Supabase project. The browser fallback uses `app/studio/catalog-pricing.ts`; the generation endpoint continues to calculate authoritative charges from the database.

Chat is unchanged at 1 credit per message. Kie GPT-5.2 is token-priced ($0.44/million input, $3.50/million output as displayed on the verification date), so long conversations can exceed the flat charge. The 30% floor does not apply to chat, inactive audio, free/promotional credits, or operating costs. Re-audit before adding discounts, bonus credits, models or provider-cost changes.
