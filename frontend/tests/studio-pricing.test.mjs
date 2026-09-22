import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { calculateStudioCredits } from "../app/(pages)/studio/pricing.ts";
import { studioCatalogPricing } from "../app/(pages)/studio/catalog-pricing.ts";

const audit = JSON.parse(readFileSync(new URL("../maintenance/studio-pricing-30pct.json", import.meta.url)));

for (const [key, model] of Object.entries(audit.models)) {
  test(`${key}: every variant meets the margin floor with the lowest possible whole-credit charge`, () => {
    const price = studioCatalogPricing[key];
    assert.deepEqual(price, model.after);
    assert.equal(calculateStudioCredits(price.credit_cost, model.defaultParameters, price.credit_rules), price.credit_cost);
    for (const [variant, providerRate] of Object.entries(model.providerUsdRates)) {
      for (const duration of model.durations) {
        const rules = price.credit_rules;
        const params = { ...model.defaultParameters };
        rules.keys?.forEach((name, i) => { params[name] = variant.split("|")[i]; });
        if (rules.multiplierKey) params[rules.multiplierKey] = duration;
        const providerUsd = providerRate * (rules.multiplierKey ? Number(duration) : 1);
        const credits = calculateStudioCredits(price.credit_cost, params, rules);
        const previous = calculateStudioCredits(model.before.credit_cost, params, model.before.credit_rules);
        assert.ok(credits < previous, `${variant}/${duration}: customer price must decrease`);
        const lowestRevenue = credits * audit.minimumUsdPerCredit;
        assert.ok((lowestRevenue - providerUsd) / lowestRevenue >= 0.30 - 1e-12);
        assert.ok((credits - 1) * audit.minimumUsdPerCredit < providerUsd / 0.7,
          `${variant}/${duration}: no unnecessary whole-credit markup`);
        for (const pack of audit.packs) {
          const revenue = credits * pack.price_cents / 100 / pack.credits;
          assert.ok((revenue - providerUsd) / revenue >= 0.30 - 1e-12,
            `${pack.key}/${variant}/${duration}: margin below 30%`);
        }
      }
    }
  });
}

test("video quotes round once after duration multiplication", () => {
  const price = studioCatalogPricing["seedance-1-5-pro-720p-8s"];
  assert.equal(calculateStudioCredits(price.credit_cost, {resolution: "480p", generate_audio: false, duration: 12}, price.credit_rules), 19);
});
