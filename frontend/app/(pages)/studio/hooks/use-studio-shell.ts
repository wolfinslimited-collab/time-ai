"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { referenceMessage } from "../../../components/studio/reference-panel";
import { messageForError } from "../../../lib/studio/studio-errors";
import { studioSupabase } from "../../../lib/studio/supabase";
import type { StudioProject } from "../../../lib/studio/studio-types";
import { useStudioAuth } from "./use-studio-auth";
import { useStudioCheckout } from "./use-studio-checkout";
import { useStudioInvoke } from "./use-studio-invoke";
import { useStudioWorkspaceData } from "./use-studio-workspace-data";

/** Shared auth, account chrome, and checkout — used by explore and create. */
export function useStudioShell() {
  const invoke = useStudioInvoke();
  const [notice, setNotice] = useState<string | null>(null);
  const onNotice = useCallback((message: string) => setNotice(message), []);
  const clearWorkspaceRef = useRef<() => void>(() => {});
  const onSignedOut = useCallback(() => clearWorkspaceRef.current(), []);

  const { user, authReady, authOpen, setAuthOpen, signOut } = useStudioAuth({
    onSignedOut,
    onNotice,
  });
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const openAuth = (mode: "signin" | "signup" = "signin") => {
    setAuthMode(mode);
    setAuthOpen(true);
  };

  const workspace = useStudioWorkspaceData({ user, invoke, onNotice });
  useEffect(() => {
    clearWorkspaceRef.current = workspace.clearWorkspace;
  }, [workspace.clearWorkspace]);

  const openPricing = () => window.location.assign("/pricing");

  async function createProject(name: string) {
    if (!user) return openAuth("signin");
    const cleaned = name.trim();
    if (!cleaned) return;
    try {
      const { data, error } = await studioSupabase
        .from("studio_projects")
        .insert({ user_id: user.id, name: cleaned })
        .select("id,name")
        .single();
      if (error) throw error;
      const project = data as StudioProject;
      workspace.setProjects((current) => [...current, project]);
      workspace.setProjectId(project.id);
    } catch (error) {
      setNotice(messageForError(error, referenceMessage));
    }
  }

  function authCancel(clearPendingPack: () => void) {
    setAuthOpen(false);
    clearPendingPack();
    try {
      sessionStorage.removeItem("timeless.pendingPack");
      sessionStorage.removeItem("timeless.support.handoff");
    } catch {
      // ignore
    }
  }

  return {
    invoke,
    notice,
    setNotice,
    onNotice,
    user,
    authReady,
    authOpen,
    setAuthOpen,
    authMode,
    openAuth,
    signOut,
    workspace,
    openPricing,
    createProject,
    authCancel,
  };
}

export function useStudioShellCheckout(
  shell: ReturnType<typeof useStudioShell>,
  creditPacks: Parameters<typeof useStudioCheckout>[0]["creditPacks"],
  catalogReady: boolean,
) {
  return useStudioCheckout({
    user: shell.user,
    authReady: shell.authReady,
    catalogReady,
    creditPacks,
    invoke: shell.invoke,
    setBalance: shell.workspace.setBalance,
    setNotice: shell.setNotice,
    setAuthOpen: (open) => {
      if (open) shell.openAuth("signin");
      else shell.setAuthOpen(false);
    },
  });
}
