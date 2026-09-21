# Public pricing page sources — September 5, 2026

Timeless packs refresh from the public credit-pack table. Model prices use the September 5 catalog snapshot, with an authenticated live refresh. Production is selected initially for the calculator; the selected pack is always visible. No pack prices or generation charges changed in this page release.

Higgsfield pricing was read from its rendered public https://higgsfield.ai/pricing page. Plus: $49/1,000 credits monthly or $39/month equivalent annually. Ultra: $129/3,000 monthly or $99/month equivalent annually. Published model references: Nano Banana 2, 2 credits/image; FLUX.2 Flex, 3/image; Kling 3.0 720p/1080p/4K, 7/8/30 credits per 5s; Wan 3.0 480p/720p/1080p, 6.25/12.5/27.5 per 5s; Seedance 1.5 480p/720p/1080p, 1/3/7 per 5s. Image resolution and video audio settings are not specified in these rate rows. They are labeled reference rates, never used for a percentage-savings or identical-output claim. The 5s unit is retained rather than extrapolating to Timeless durations. Annual plans, promotions and unlimited benefits can reduce effective prices.

OpenArt: https://openart.ai/pricing — Starter $14 monthly or $13/month annual equivalent, 4,000 credits. No verified matching per-model prices on that page.

CapCut: https://www.capcut.com/help/new-capcut-subscription-pricing — regional/platform pricing and upgraded Pro 1,200-credit allowance. No verified matching per-model rates. See also https://www.capcut.com/help/credits-in-capcut.

Runway: https://runway.com/pricing — Standard $15 monthly or $12/month annual equivalent, 625 credits. Monthly Standard allocation resets; purchased add-ons do not expire. Its different model labels were not assumed equivalent to Timeless.

Official brand assets were downloaded unchanged:
- Higgsfield: https://higgsfield.ai/icon.png
- OpenArt: https://openart.ai/suite/favicon.ico?favicon.365cc937.ico
- CapCut: https://sf16-web-tos-buz.capcutstatic.com/obj/capcut-web-buz-sg/common/images/lv_web-2.ico
- Runway: https://d3phaj0sisr2ct.cloudfront.net/site/assets/runway-logo.svg

The three package SVGs are original abstract geometric illustrations. Competitor logos are identification only. No fastest/cheapest blanket claim or fabricated timing benchmark is made.

Checkout links carry an allowlisted pack key into Studio. Sign-in preserves this intent through same-tab Google OAuth using sessionStorage. Dismissing sign-in clears the intent. After authentication, a ref guards one checkout request; intent is cleared before calling Stripe. Payment settlement continues through the existing verified checkout-return flow. Both cancellation query values (`cancel` and `canceled`) are handled.
