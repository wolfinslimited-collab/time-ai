import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { clearAuthErrorUrl, googleSignInUrl, socialAuthErrorMessage } from "../app/(pages)/studio/auth.ts";

test("Google OAuth uses the SDK with the Studio callback and account selection", async () => {
  const client = createClient("https://example.supabase.co", "test-publishable-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const url = new URL(await googleSignInUrl(client.auth, "https://timelessapp.ai"));
  assert.equal(url.origin, "https://example.supabase.co");
  assert.equal(url.pathname, "/auth/v1/authorize");
  assert.equal(url.searchParams.get("provider"), "google");
  assert.equal(url.searchParams.get("redirect_to"), "https://timelessapp.ai/studio");
  assert.equal(url.searchParams.get("prompt"), "select_account");
});

test("Google setup preserves the local origin and leaves navigation to the dialog", async () => {
  const auth = { signInWithOAuth: async (request) => {
    assert.equal(request.options.redirectTo, "http://127.0.0.1:3000/studio");
    assert.equal(request.options.skipBrowserRedirect, true);
    return { data: { url: "https://example.supabase.co/auth/v1/authorize?provider=google" }, error: null };
  } };
  assert.match(await googleSignInUrl(auth, "http://127.0.0.1:3000"), /provider=google/);
});

test("Google failures reject so the dialog can show an error and allow retry", async () => {
  const providerError = new Error("Unsupported provider: provider is not enabled");
  await assert.rejects(googleSignInUrl({ signInWithOAuth: async () => ({ data: {}, error: providerError }) }, "https://timelessapp.ai"), providerError);
  await assert.rejects(googleSignInUrl({ signInWithOAuth: async () => { throw new TypeError("Failed to fetch"); } }, "https://timelessapp.ai"), /Failed to fetch/);
  await assert.rejects(googleSignInUrl({ signInWithOAuth: async () => ({ data: { url: null }, error: null }) }, "https://timelessapp.ai"), /redirect URL/);
});

test("OAuth failures use safe, actionable messages", () => {
  assert.match(socialAuthErrorMessage({ code: "access_denied" }), /canceled/);
  assert.match(socialAuthErrorMessage(new Error("Unsupported provider: provider is not enabled")), /temporarily unavailable/);
  assert.equal(socialAuthErrorMessage(new Error("private server details")), "We could not complete sign-in. Please try again or use email.");
});

test("failed OAuth returns are cleaned without losing unrelated parameters", () => {
  const url = new URL(clearAuthErrorUrl("https://timelessapp.ai/studio?mode=video&error=access_denied#error_code=denied&error_description=private+details"));
  assert.equal(url.search, "?mode=video");
  assert.equal(url.hash, "");
  assert.equal(clearAuthErrorUrl("https://timelessapp.ai/studio?mode=image#panel=projects"), "https://timelessapp.ai/studio?mode=image#panel=projects");
});

test("email failures explain invalid credentials, verification, rate limits, and network errors", async () => {
  const { emailAuthErrorMessage } = await import("../app/(pages)/studio/auth.ts");
  assert.match(emailAuthErrorMessage({ code: "invalid_credentials" }), /email or password is incorrect/);
  assert.match(emailAuthErrorMessage({ code: "email_not_confirmed" }), /verify your email/);
  assert.match(emailAuthErrorMessage({ status: 429 }), /Too many attempts/);
  assert.match(emailAuthErrorMessage(new TypeError("Failed to fetch")), /Check your connection/);
  assert.doesNotMatch(emailAuthErrorMessage(new Error("private backend details")), /private backend details/);
});

test("sign-in errors render inside the form and Apple stays removed", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../app/(pages)/studio/auth-dialog.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /Continue with Apple|social\("apple"\)/);
  assert.match(source, /<form[^>]+onSubmit=\{submit\}[\s\S]*emailError && \(\s*<p className="studio-auth-error" role="alert"/);
  assert.match(source, /Signing in…/);
  assert.match(source, /minLength=\{mode === "signup" \? 8 : undefined\}/);
});
