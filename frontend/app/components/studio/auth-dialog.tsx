"use client";

import type { User } from "@supabase/supabase-js";
import { LoaderCircle, Sparkles, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { emailAuthErrorMessage, googleSignInUrl, socialAuthErrorMessage } from "./auth";
import { studioSupabase } from "./supabase";

export function displayName(user: User | null) {
  return user ? String(user.user_metadata?.full_name || user.email || "Creator") : "";
}

export function AuthDialog({
  onClose,
  onCancel,
  onNotice,
}: {
  onClose: () => void;
  onCancel?: () => void;
  onNotice: (notice: string) => void;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
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
      className="studio-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && (onCancel || onClose)()}
    >
      <section className="studio-modal studio-auth-modal" role="dialog" aria-modal="true" aria-labelledby="studio-auth-title">
        <button className="studio-modal-close" onClick={onCancel || onClose} type="button" aria-label="Close">
          <X size={18} />
        </button>
        <span className="studio-modal-icon">
          <Sparkles size={20} />
        </span>
        <p className="studio-modal-kicker">ONE TIMELESS ACCOUNT</p>
        <h2 id="studio-auth-title">{mode === "signin" ? "Welcome back, creator." : "Create your studio."}</h2>
        <p className="studio-modal-copy">Your projects, generations, conversations, and credits stay together across Timeless.</p>
        <div className="studio-social-row">
          <button type="button" disabled={busy || socialBusy} aria-busy={socialBusy} onClick={social}>
            {socialBusy ? (
              <>
                <LoaderCircle size={16} aria-hidden="true" /> Connecting to Google…
              </>
            ) : (
              "Continue with Google"
            )}
          </button>
        </div>
        {socialError && (
          <p className="studio-auth-error" role="alert">
            {socialError}
          </p>
        )}
        <div className="studio-divider">
          <span>or use email</span>
        </div>
        <form onSubmit={submit} aria-busy={busy}>
          {mode === "signup" && (
            <label>
              Name
              <input value={name} onChange={(event) => setName(event.target.value)} required autoComplete="name" />
            </label>
          )}
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
          </label>
          <label>
            Password
            <input
              type="password"
              minLength={mode === "signup" ? 8 : undefined}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
          </label>
          {emailError && (
            <p className="studio-auth-error" role="alert">
              {emailError}
            </p>
          )}
          <button className="studio-modal-primary" disabled={busy || socialBusy} type="submit">
            {busy ? (
              <>
                <LoaderCircle size={16} aria-hidden="true" /> {mode === "signin" ? "Signing in…" : "Creating account…"}
              </>
            ) : mode === "signin" ? (
              "Sign in"
            ) : (
              "Create account"
            )}
          </button>
        </form>
        <button
          className="studio-auth-switch"
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
