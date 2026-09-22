import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

async function readStudioSources() {
  const paths = [
    "../app/(pages)/studio/studio-workspace.tsx",
    "../app/(pages)/studio/hooks/use-studio-invoke.ts",
    "../app/(pages)/studio/hooks/use-studio-catalog.ts",
    "../app/(pages)/studio/hooks/use-studio-checkout.ts",
    "../app/(pages)/studio/hooks/use-studio-workspace-data.ts",
    "../app/(pages)/studio/data/showcase-examples.ts",
    "../app/lib/studio/studio-types.ts",
    "../app/lib/studio/studio-errors.ts",
    "../app/components/studio/studio-dialogs.tsx",
    "../app/components/studio/studio-model-picker.tsx",
    "../app/components/studio/tool-library.tsx",
  ];
  const chunks = await Promise.all(
    paths.map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );
  return chunks.join("\n");
}

test("server-renders the Timeless short-drama product page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Timeless: Short Dramas<\/title>/i);
  assert.match(html, /mobile streaming app for addictive short dramas/i);
  assert.match(html, /The Frozen Mind/i);
  assert.match(html, /Get it on Google Play/i);
  assert.match(html, /Download for iPhone/i);
  assert.match(html, /frozen-mind-02\.jpg/i);
  assert.match(html, /series\/dqn\.png/i);
  assert.match(html, /series\/kusanscar\.png/i);
  assert.match(html, /series\/frozen-mind\.jpg/i);
  assert.doesNotMatch(html, /TIMELESS VIP|One subscription|\$79\.99/i);
  assert.doesNotMatch(html, /AI Academy|Learn AI/i);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("server-renders Timeless legal pages", async () => {
  const privacyResponse = await render("/privacy");
  assert.equal(privacyResponse.status, 200);
  assert.match(await privacyResponse.text(), /Privacy Policy — Timeless/i);

  const termsResponse = await render("/terms");
  assert.equal(termsResponse.status, 200);
  const termsHtml = await termsResponse.text();
  assert.match(termsHtml, /Terms of Service — Timeless/i);
  assert.match(termsHtml, /Studio web payments are securely processed by Stripe/i);

  const refundResponse = await render("/refund");
  assert.equal(refundResponse.status, 200);
  const refundHtml = await refundResponse.text();
  assert.match(refundHtml, /Refund Policy — Timeless/i);
  assert.match(refundHtml, /payments securely processed by Stripe/i);
  assert.match(refundHtml, /failed generations automatically restore credits/i);
});

test("server-renders transparent Timeless Studio pricing", async () => {
  const response = await render("/pricing");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /Timeless Studio Pricing — AI Creation Credits/i);
  assert.match(html, /1,000.*credits/i);
  assert.match(html, /3,500.*credits/i);
  assert.match(html, /10,000.*credits/i);
  assert.match(html, /\$9\.99/i);
  assert.match(html, /\$29\.99/i);
  assert.match(html, /\$79\.99/i);
  assert.match(html, /No recurring Studio subscription/i);
  assert.match(html, /payments are securely processed by Stripe/i);
});

test("server-renders the iOS and Android download page", async () => {
  const response = await render("/download");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /Download Timeless for iPhone and Android/i);
  assert.match(html, /Download on the/);
  assert.match(html, /App Store/);
  assert.match(html, /Google Play/);
  assert.match(html, /apps\.apple\.com\/app\/id6740804440/);
  assert.match(html, /play\.google\.com\/store\/apps\/details\?id=com\.wolfine\.app/);
});

test("server-renders the native Timeless Studio desktop workspace", async () => {
  const response = await render("/studio");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Timeless Studio — Create with AI<\/title>/i);
  assert.match(html, /studio-tool-library/i);
  assert.match(html, /Create image/i);
  assert.match(html, /Sound/i);
  assert.match(html, /Chat/i);
  assert.match(html, /My studio/i);
  assert.match(html, />Explore</i);
  assert.match(html, /Trending creations to recreate/i);
  assert.match(html, /All image tools/i);
  assert.match(html, /Last stop before dawn/i);
  assert.match(html, /The white citadel/i);
  assert.match(html, /class="studio-mark" src="\/timeless-icon\.png"/i);
  assert.doesNotMatch(html, /flutter_bootstrap\.js|\/studio-app\//i);
  assert.doesNotMatch(html, /class="studio-mark"[^>]*>T</i);
});

test("Studio showcase copies and loads prompts into the generator", async () => {
  const source = await readStudioSources();

  assert.match(source, /navigator\.clipboard\.writeText\(example\.prompt\)/);
  assert.match(source, /setPrompt\(example\.prompt\)/);
  assert.match(source, /Prompt copied and ready to recreate/);
  assert.match(source, /aria-label=\{`Recreate \$\{example\.title\}`\}/);
  assert.match(source, /studio-showcase\/neon-diner\.jpg/);
  assert.match(source, /studio-showcase\/direct-flash-night\.jpg/);
  assert.match(source, /studio-showcase\/liquid-cobalt\.jpg/);
  assert.match(source, /studio-showcase\/petal-freeze\.jpg/);
  assert.match(source, /studio-showcase\/strawberry-atelier\.jpg/);
});

test("adds production security headers to every route", async () => {
  for (const pathname of ["/", "/studio", "/privacy"]) {
    const response = await render(pathname);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.match(
      response.headers.get("strict-transport-security") ?? "",
      /max-age=63072000/i,
    );
    assert.match(
      response.headers.get("content-security-policy") ?? "",
      /frame-ancestors 'none'/i,
    );
  }
});

test("Studio handles non-Response function errors and missing Stripe safely", async () => {
  const source = await readStudioSources();
  assert.match(source, /typeof clone === "function"/);
  assert.match(source, /stripe_not_configured/);
  assert.match(source, /studio-catalog/);
  assert.doesNotMatch(source, /modelKey:\s*"elevenlabs-dialogue-v3"/);
  assert.doesNotMatch(source, /modelKey:\s*"gemini-3-1-flash-tts"/);
  assert.doesNotMatch(source, /modelKey:\s*"gemini-2-5-pro-tts"/);
  assert.doesNotMatch(source, /modelKey:\s*"elevenlabs-turbo-2-5"/);
  assert.doesNotMatch(source, /modelKey:\s*"elevenlabs-multilingual-v2"/);
  assert.match(source, /temporarily paused while Kie restores audio capacity/);
});

test("Studio verifies Stripe returns and confirms delivered credits", async () => {
  const source = await readStudioSources();

  assert.match(source, /studio_stripe_checkouts/);
  assert.match(source, /stripe_session_id/);
  assert.match(source, /PAYMENT CONFIRMED/);
  assert.match(source, /Credits added/);
  assert.match(source, /New balance/);
  assert.match(source, /Payment received\. Confirming your credits/);
});

test("Meta Pixel measures the web purchase funnel without sending checkout identifiers", async () => {
  const [pixelSource, pixelConfigSource, pixelBootstrapSource, layoutSource, studioSource, workerSource] = await Promise.all([
    readFile(new URL("../app/meta-pixel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/meta-pixel-config.ts", import.meta.url), "utf8"),
    readFile(new URL("../public/meta-pixel-bootstrap.js", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readStudioSources(),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
  ]);

  assert.match(pixelConfigSource, /META_PIXEL_ID = "1767429987632321"/);
  assert.match(pixelBootstrapSource, /fbevents\.js/);
  assert.match(pixelBootstrapSource, /1767429987632321/);
  assert.match(pixelBootstrapSource, /fbq\('track','PageView'\)/);
  assert.match(pixelBootstrapSource, /dataset\.timelessMetaPixelInitialized/);
  assert.match(pixelSource, /"PageView"/);
  assert.match(layoutSource, /<MetaPixel \/>/);
  assert.match(layoutSource, /src="\/meta-pixel-bootstrap\.js"/);
  assert.match(studioSource, /trackMetaEvent\("InitiateCheckout"/);
  assert.match(studioSource, /trackMetaEvent\("Purchase"/);
  assert.match(pixelSource, /eventID: eventId/);
  assert.match(studioSource, /metaInitiateCheckoutEventId/);
  assert.match(studioSource, /metaPurchaseEventId/);
  assert.match(studioSource, /getMetaBrowserIdentifiers/);
  assert.doesNotMatch(studioSource, /trackMetaEvent\([^)]*sessionId/s);
  assert.match(workerSource, /https:\/\/connect\.facebook\.net/);
  assert.match(workerSource, /https:\/\/www\.facebook\.com/);
});

test("Studio discloses seven-day media retention and supports keeping outputs", async () => {
  const source = await readStudioSources();

  assert.match(source, /Files expire after 7 days unless kept/);
  assert.match(source, /studio-retain-asset/);
  assert.match(source, /Expires in \$\{days\} days/);
  assert.match(source, /\}\s+Keep\s*<\/button>/);
  assert.match(source, /File expired/);
});

test("Studio loads models from the regulated catalog and quotes credits live", async () => {
  const source = await readStudioSources();
  const pricing = await readFile(
    new URL("../app/lib/studio/pricing.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /Choose the right engine/);
  assert.match(source, /Price updates with every setting/);
  assert.match(source, /invoke\("studio-catalog"\)|invoke<[^>]*>\("studio-catalog"\)/);
  assert.match(source, /loadCatalog/);
  assert.match(source, /TOOL_ICONS/);
  assert.match(source, /hydrateTool/);
  assert.match(source, /toolKey: activeTool\?\.key/);
  assert.doesNotMatch(source, /fallbackModels/);
  assert.doesNotMatch(source, /const tools: StudioTool\[\] = \[/);
  assert.doesNotMatch(source, /video-models\.json/);
  assert.doesNotMatch(source, /reference-overrides\.json/);
  assert.match(source, /quotedCredits/);
  assert.match(source, /From \{defaultModelCredits\(model\)\} cr/);
  assert.match(pricing, /rules\.multiplierKey/);
  assert.match(pricing, /Math\.ceil\(rate \* multiplier \+ extra\)/);
});

test("Dedicated pricing page shows purchase links, model calculator and sourced comparisons", async () => {
  const response = await render("/pricing");
  assert.equal(response.status, 200);
  const html = await response.text();
  for (const pack of ["spark", "creator", "production"]) {
    assert.ok(html.includes(`/studio?buy=${pack}`));
    assert.ok(html.includes(`/pricing/${pack}.svg`));
  }
  for (const brand of ["Higgsfield", "OpenArt", "CapCut", "Runway"]) assert.ok(html.includes(`${brand} logo`));
  assert.match(html, /Compare the output/);
  assert.match(html, /Quality &amp; audio/);
  assert.match(html, /0\.064/);
  assert.match(html, /Some subscriptions can cost less at high usage/);
  assert.match(html, /no cross-platform speed benchmark is claimed/);
  assert.match(html, /openart\.ai\/pricing/);
  const studio = await readStudioSources();
  assert.doesNotMatch(studio, /function CreditsDialog/);
  assert.match(studio, /window\.location\.assign\("\/pricing"\)/);
  const pricingSource = await readFile(new URL("../app/(pages)/pricing/pricing-experience.tsx", import.meta.url), "utf8");
  assert.match(pricingSource, /studio-catalog/);
  assert.doesNotMatch(pricingSource, /from\("studio_models"\)/);
});

test("uses the original Timeless icon for favicon and shared brand marks", async () => {
  const home = await render();
  const homeHtml = await home.text();
  assert.match(homeHtml, /rel="icon" href="(?:https:\/\/timelessapp\.ai)?\/favicon\.png"/i);

  for (const pathname of ["/privacy", "/terms", "/pricing", "/refund"]) {
    const response = await render(pathname);
    const html = await response.text();
    assert.match(html, /class="brand-mark" src="\/timeless-icon\.png"/i);
    assert.doesNotMatch(html, /class="brand-mark"[^>]*>\s*T\s*</i);
  }
});

test("keeps full-bleed dark sections responsive without horizontal overflow", async () => {
  const css = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );

  assert.match(
    css,
    /\.hero\.shell,\s*\.footer\.shell\s*\{[^}]*width:\s*100%;[^}]*margin-inline:\s*0;/s,
  );
  assert.match(
    css,
    /\.hero\s*\{[^}]*padding-inline:\s*var\(--page-gutter\);/s,
  );
  assert.match(
    css,
    /\.footer\s*\{[^}]*padding-inline:\s*var\(--page-gutter\);/s,
  );
  assert.match(css, /@media\s*\(max-width:\s*720px\)/);
  assert.match(css, /\.hero\s*\{[^}]*padding-inline:\s*16px;/s);
  assert.match(css, /\.footer\s*\{[^}]*padding-inline:\s*16px;/s);
});

test("keeps small text readable across every site route", async () => {
  const css = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );

  assert.match(css, /--text-micro:\s*11px/);
  assert.match(css, /--text-caption:\s*12px/);
  assert.match(css, /--text-ui:\s*13px/);
  assert.match(css, /text-size-adjust:\s*100%/);
  assert.doesNotMatch(css, /font-size:\s*(?:[1-9]|10)px/);
});

test("personal Studio filters admin-readable projects by owner and refreshes chat balance", async () => {
  const source = await readStudioSources();
  assert.match(source, /from\("studio_projects"\)\.select\("id,name"\)\.eq\("user_id", user\.id\)/);
  const chat = source.slice(source.indexOf("async function sendChat()"), source.indexOf("async function refreshGeneration"));
  assert.match(chat, /from\("studio_credit_wallets"\)/);
  assert.match(chat, /setBalance\(Number\(wallet\.balance\)\)/);
});

test("Studio and pricing load credit packs from studio-catalog, not a hardcoded buy allowlist", async () => {
  const [studio, pricing] = await Promise.all([
    readStudioSources(),
    readFile(new URL("../app/(pages)/pricing/pricing-experience.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(studio, /invoke<[^>]*>\("studio-catalog"\)/);
  assert.match(studio, /if \(!catalogReady\) return/);
  assert.match(studio, /creditPacks\.some\(\(pack\) => pack\.key === selected\)/);
  assert.match(studio, /!authReady \|\| !catalogReady \|\| !pendingPack/);
  assert.doesNotMatch(studio, /fallbackPacks/);
  assert.doesNotMatch(studio, /\["spark", "creator", "production"\]\.includes\(selected\)/);

  assert.match(pricing, /studio-catalog/);
  assert.match(pricing, /placeholderCreditPacks/);
  assert.match(pricing, /packArtSrc/);
  assert.doesNotMatch(pricing, /const initialPacks/);
});

test("admin credit packs page gates on is_admin and writes studio_credit_packs", async () => {
  const [page, admin] = await Promise.all([
    readFile(new URL("../app/(pages)/admin/studio/packs/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/(pages)/admin/studio/packs/packs-admin.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(page, /PacksAdmin/);
  assert.match(page, /robots:\s*\{\s*index:\s*false/);
  assert.match(admin, /rpc\("is_admin"\)/);
  assert.match(admin, /AuthDialog/);
  assert.match(admin, /Access denied/);
  assert.match(admin, /from\("studio_credit_packs"\)/);
  assert.match(admin, /\.insert\(/);
  assert.match(admin, /\.update\(/);
  assert.match(admin, /\.delete\(\)/);
  assert.match(admin, /Deactivate it instead/);
  assert.match(admin, /CREDIT_PACK_KEY_PATTERN/);

  const response = await render("/admin/studio/packs");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Admin — Studio credit packs/i);
  assert.match(html, /Studio credit packs/i);
});
