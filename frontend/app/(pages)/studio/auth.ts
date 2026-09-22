import type { SupabaseClient } from "@supabase/supabase-js";

export function emailAuthErrorMessage(error: unknown) {
  const details = error && typeof error === "object" ? error as { code?: string; message?: string; status?: number } : {};
  const message = `${details.code || ""} ${details.message || ""}`.toLowerCase();
  if (message.includes("invalid_credentials") || message.includes("invalid login credentials")) return "The email or password is incorrect. Try again, or use Google if you signed up with Google.";
  if (message.includes("email_not_confirmed") || message.includes("email not confirmed")) return "Please verify your email using the link in your inbox, then sign in.";
  if (details.status === 429 || message.includes("rate_limit") || message.includes("too many requests")) return "Too many attempts. Please wait a few minutes and try again.";
  if (message.includes("weak_password") || message.includes("password should")) return "Choose a stronger password with at least 8 characters.";
  if (message.includes("fetch") || message.includes("network")) return "We could not connect. Check your connection and try again.";
  return "We could not complete your request. Please try again or continue with Google.";
}

export async function googleSignInUrl(auth: Pick<SupabaseClient["auth"], "signInWithOAuth">, origin: string) {
  const { data, error } = await auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: new URL("/studio", origin).href,
      skipBrowserRedirect: true,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) throw error;
  if (!data.url) throw new Error("Google sign-in did not return a redirect URL.");
  return data.url;
}

export function socialAuthErrorMessage(error: unknown) {
  const details = error && typeof error === "object" ? error as { code?: string; message?: string } : {};
  const message = `${details.code || ""} ${details.message || ""}`.toLowerCase();
  if (message.includes("access_denied") || message.includes("access denied")) {
    return "Sign-in was canceled. You can try Google again or use email.";
  }
  if (message.includes("provider") && (message.includes("disabled") || message.includes("not enabled"))) {
    return "Google sign-in is temporarily unavailable. Please use email or try again later.";
  }
  return "We could not complete sign-in. Please try again or use email.";
}

export function clearAuthErrorUrl(href: string) {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.slice(1));
  for (const key of ["error", "error_code", "error_description"]) {
    url.searchParams.delete(key);
    hash.delete(key);
  }
  url.hash = hash.toString();
  return url.href;
}
