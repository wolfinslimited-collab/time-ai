"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { clearAuthErrorUrl, socialAuthErrorMessage } from "../../../lib/studio/auth";
import { studioSupabase } from "../../../lib/studio/supabase";

export function useStudioAuth(input: {
  onSignedOut: () => void;
  onNotice: (message: string) => void;
}) {
  const { onSignedOut, onNotice } = input;
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    let active = true;
    async function restoreSession() {
      try {
        const { error: callbackError } = await studioSupabase.auth.initialize();
        if (callbackError && active) {
          onNotice(socialAuthErrorMessage(callbackError));
          setAuthOpen(true);
          window.history.replaceState(window.history.state, "", clearAuthErrorUrl(window.location.href));
        }
        const { data, error } = await studioSupabase.auth.getSession();
        if (error) throw error;
        if (active) setSession(data.session);
      } catch (error) {
        if (active) onNotice(socialAuthErrorMessage(error));
      } finally {
        if (active) setAuthReady(true);
      }
    }
    void restoreSession();
    const { data } = studioSupabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
      if (nextSession) setAuthOpen(false);
      else onSignedOut();
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [onNotice, onSignedOut]);

  async function signOut() {
    await studioSupabase.auth.signOut();
  }

  return {
    session,
    user: session?.user ?? null,
    authReady,
    authOpen,
    setAuthOpen,
    signOut,
  };
}
