"use client";

import type { User } from "@supabase/supabase-js";
import { LoaderCircle, Sparkles, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { emailAuthErrorMessage, googleSignInUrl, socialAuthErrorMessage } from "../../lib/studio/auth";
import { studioSupabase } from "../../lib/studio/supabase";

export function displayName(user: User | null) {
  return user ? String(user.user_metadata?.full_name || user.email || "Creator") : "";
}

const fieldClass =
  "min-h-12 w-full rounded-xl border-0 bg-canvas px-3.5 text-sm text-foreground shadow-none outline-none placeholder:text-subtle focus:ring-1 focus:ring-elevated-hover";

const errorClass = "m-0 rounded-xl bg-accent-deep/20 px-3 py-2.5 text-left text-sm text-accent-soft";

export function AuthDialog({
  onClose,
  onCancel,
  onNotice,
  initialMode = "signin",
}: {
  onClose: () => void;
  onCancel?: () => void;
  onNotice: (notice: string) => void;
  initialMode?: "signin" | "signup";
}) {
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const socialInFlight = useRef(false);
  const [socialBusy, setSocialBusy] = useState(false);
  const [socialError, setSocialError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || socialInFlight.current) return;
    setSocialError(null);
    setEmailError(null);
    setBusy(true);
    try {
      if (mode === "signin") {
        const { data, error } = await studioSupabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        if (!data.session) throw new Error("No session returned");
        onClose();
      } else {
        const { data, error } = await studioSupabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: name.trim() }, emailRedirectTo: `${window.location.origin}/studio` },
        });
        if (error) throw error;
        if (!data.session) onNotice("Check your email to finish creating your Timeless account.");
        onClose();
      }
    } catch (error) {
      setEmailError(emailAuthErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function social() {
    if (busy || socialInFlight.current) return;
    socialInFlight.current = true;
    setSocialBusy(true);
    setSocialError(null);
    setEmailError(null);
    try {
      const url = await googleSignInUrl(studioSupabase.auth, window.location.origin);
      window.location.assign(url);
    } catch (error) {
      setSocialError(socialAuthErrorMessage(error));
      socialInFlight.current = false;
      setSocialBusy(false);
    }
  }

  useEffect(() => {
    const resetSocial = () => {
      socialInFlight.current = false;
      setSocialBusy(false);
    };
    window.addEventListener("pageshow", resetSocial);
    return () => window.removeEventListener("pageshow", resetSocial);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/75 p-7 backdrop-blur-lg"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && (onCancel || onClose)()}
    >
      <section
        className="relative w-full max-w-sm rounded-2xl bg-elevated px-8 pb-7 pt-10 text-center shadow-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-auth-title"
      >
        <button
          className="absolute top-3.5 right-3.5 grid size-8 place-items-center rounded-lg bg-transparent text-muted transition-colors hover:bg-elevated-hover hover:text-foreground"
          onClick={onCancel || onClose}
          type="button"
          aria-label="Close"
        >
          <X size={18} />
        </button>
        <span className="mx-auto mb-5 grid size-10 place-items-center rounded-xl bg-elevated-hover text-foreground">
          <Sparkles size={18} />
        </span>
        <h2 id="studio-auth-title" className="m-0 text-2xl font-semibold tracking-tight text-foreground">
          Welcome to Timeless
        </h2>
        <p className="mx-auto mt-2.5 mb-7 max-w-xs text-sm leading-relaxed text-muted">
          {mode === "signin"
            ? "Log in or sign up to bring your ideas to life."
            : "Join Timeless and keep your projects, generations, and credits in one place."}
        </p>
        <div className="grid gap-2.5">
          <button
            type="button"
            disabled={busy || socialBusy}
            aria-busy={socialBusy}
            onClick={social}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-0 bg-elevated-hover px-4 text-sm font-medium text-foreground transition-colors hover:brightness-110 disabled:cursor-wait disabled:opacity-70"
          >
            {socialBusy ? (
              <>
                <LoaderCircle className="animate-spin" size={16} aria-hidden="true" /> Connecting to Google…
              </>
            ) : (
              "Continue with Google"
            )}
          </button>
        </div>
        {socialError && (
          <p className={`${errorClass} mt-3`} role="alert">
            {socialError}
          </p>
        )}
        <div className="my-5 flex items-center gap-3 text-xs text-subtle">
          <span className="h-px flex-1 bg-elevated-hover" aria-hidden="true" />
          <span>or</span>
          <span className="h-px flex-1 bg-elevated-hover" aria-hidden="true" />
        </div>
        <form className="grid gap-3.5 text-left" onSubmit={submit} aria-busy={busy}>
          {mode === "signup" && (
            <label className="grid gap-2 text-sm font-medium text-muted">
              Name
              <input
                className={fieldClass}
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                autoComplete="name"
              />
            </label>
          )}
          <label className="grid gap-2 text-sm font-medium text-muted">
            Email
            <input
              className={fieldClass}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-muted">
            Password
            <input
              className={fieldClass}
              type="password"
              minLength={mode === "signup" ? 8 : undefined}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
          </label>
          {emailError && (
            <p className={errorClass} role="alert">
              {emailError}
            </p>
          )}
          <button
            className="mt-1 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-0 bg-accent px-4 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent-soft disabled:cursor-wait disabled:bg-elevated-hover disabled:text-subtle"
            disabled={busy || socialBusy}
            type="submit"
          >
            {busy ? (
              <>
                <LoaderCircle className="animate-spin" size={16} aria-hidden="true" />{" "}
                {mode === "signin" ? "Signing in…" : "Creating account…"}
              </>
            ) : mode === "signin" ? (
              "Sign in"
            ) : (
              "Create account"
            )}
          </button>
        </form>
        <button
          className="mt-5 bg-transparent text-sm text-muted transition-colors hover:text-foreground disabled:opacity-60"
          disabled={busy || socialBusy}
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setEmailError(null);
            setSocialError(null);
          }}
        >
          {mode === "signin" ? "New to Timeless? Create an account" : "Already have an account? Sign in"}
        </button>
      </section>
    </div>
  );
}
