"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { messageForError } from "../../../lib/studio/studio-errors";
import { studioSupabase } from "../../../lib/studio/supabase";
import {
  isActiveGeneration,
  type ChatMessage,
  type ChatThread,
  type StudioGeneration,
  type StudioOutputAsset,
  type StudioProject,
} from "../../../lib/studio/studio-types";
import type { useStudioInvoke } from "./use-studio-invoke";

type Invoke = ReturnType<typeof useStudioInvoke>;

export function useStudioWorkspaceData(input: {
  user: User | null;
  invoke: Invoke;
  onNotice: (message: string) => void;
}) {
  const { user, invoke, onNotice } = input;
  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [projectId, setProjectId] = useState("");
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;
  const [generations, setGenerations] = useState<StudioGeneration[]>([]);
  const generationsRef = useRef(generations);
  generationsRef.current = generations;
  const [outputUrls, setOutputUrls] = useState<Record<string, string>>({});
  const [outputAssets, setOutputAssets] = useState<Record<string, StudioOutputAsset>>({});
  const [balance, setBalance] = useState(0);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);

  const loadOutputs = useCallback(
    async (rows: StudioGeneration[]) => {
      const succeeded = rows.filter((row) => row.status === "succeeded").map((row) => row.id);
      if (!succeeded.length) {
        setOutputAssets({});
        setOutputUrls({});
        return;
      }
      const { data: assets, error } = await studioSupabase
        .from("studio_assets")
        .select("id,generation_id,status,expires_at,retained_at")
        .eq("role", "output")
        .in("generation_id", succeeded);
      if (error) throw error;
      const outputRows = (assets || []) as StudioOutputAsset[];
      setOutputAssets(Object.fromEntries(outputRows.map((asset) => [asset.generation_id, asset])));
      const available = outputRows.filter(
        (asset) =>
          asset.status === "ready" &&
          (asset.retained_at || !asset.expires_at || new Date(asset.expires_at).getTime() > Date.now()),
      );
      const signed = await Promise.all(
        available.map(async (asset) => {
          try {
            const result = await invoke<{ url: string }>("studio-asset-url", {
              assetId: asset.id,
              expiresIn: 3600,
            });
            return [asset.generation_id as string, result.url] as const;
          } catch {
            return null;
          }
        }),
      );
      setOutputUrls(Object.fromEntries(signed.filter(Boolean) as Array<readonly [string, string]>));
    },
    [invoke],
  );

  const loadGenerations = useCallback(async () => {
    if (!user) return;
    const { data, error } = await studioSupabase
      .from("studio_generations")
      .select("id,project_id,model_key,media_type,status,prompt,progress,credits_charged,error_message,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(80);
    if (error) throw error;
    const rows = (data || []) as StudioGeneration[];
    setGenerations(rows);
    await loadOutputs(rows);
  }, [loadOutputs, user]);

  const loadThreads = useCallback(
    async (nextProjectId?: string) => {
      if (!user) return;
      const targetProject = nextProjectId || projectIdRef.current;
      let query = studioSupabase
        .from("studio_chat_threads")
        .select("id,title,project_id,model_key,updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(50);
      if (targetProject) query = query.eq("project_id", targetProject);
      const { data, error } = await query;
      if (error) throw error;
      setThreads((data || []) as ChatThread[]);
    },
    [user],
  );

  const loadMessages = useCallback(async (nextThreadId: string | null) => {
    setThreadId(nextThreadId);
    if (!nextThreadId) {
      setMessages([]);
      return;
    }
    const { data, error } = await studioSupabase
      .from("studio_chat_messages")
      .select("id,role,content,credits_charged,provider_tokens,created_at")
      .eq("thread_id", nextThreadId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    setMessages((data || []) as ChatMessage[]);
  }, []);

  const loadWorkspace = useCallback(async () => {
    if (!user) return;
    setWorkspaceLoading(true);
    try {
      const [projectsResult, walletResult] = await Promise.all([
        studioSupabase.from("studio_projects").select("id,name").eq("user_id", user.id).order("created_at"),
        studioSupabase.from("studio_credit_wallets").select("balance").eq("user_id", user.id).maybeSingle(),
      ]);
      if (projectsResult.error) throw projectsResult.error;
      if (walletResult.error) throw walletResult.error;
      setBalance(Number(walletResult.data?.balance || 0));
      let liveProjects = (projectsResult.data || []) as StudioProject[];
      if (!liveProjects.length) {
        const { data, error } = await studioSupabase
          .from("studio_projects")
          .insert({ user_id: user.id, name: "My first project" })
          .select("id,name")
          .single();
        if (error) throw error;
        liveProjects = [data as StudioProject];
      }
      setProjects(liveProjects);
      let nextProjectId = liveProjects[0].id;
      setProjectId((current) => {
        nextProjectId = liveProjects.some((project) => project.id === current) ? current : liveProjects[0].id;
        return nextProjectId;
      });
      await Promise.all([loadGenerations(), loadThreads(nextProjectId)]);
    } catch (error) {
      onNotice(messageForError(error));
    } finally {
      setWorkspaceLoading(false);
    }
  }, [loadGenerations, loadThreads, onNotice, user]);

  useEffect(() => {
    if (!user) return;
    const timer = window.setTimeout(() => loadWorkspace(), 0);
    return () => window.clearTimeout(timer);
  }, [loadWorkspace, user]);

  useEffect(() => {
    if (!user) return;
    const channel = studioSupabase
      .channel(`studio-web-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "studio_generations", filter: `user_id=eq.${user.id}` },
        () => {
          void loadGenerations();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "studio_credit_wallets", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const next = payload.new as { balance?: number };
          if (typeof next.balance === "number") setBalance(next.balance);
        },
      )
      .subscribe();
    const timer = window.setInterval(() => {
      if (generationsRef.current.some((generation) => isActiveGeneration(generation.status))) {
        void loadGenerations();
      }
    }, 8000);
    return () => {
      window.clearInterval(timer);
      studioSupabase.removeChannel(channel);
    };
  }, [loadGenerations, user]);

  const clearWorkspace = useCallback(() => {
    setProjects([]);
    setProjectId("");
    setGenerations([]);
    setOutputUrls({});
    setOutputAssets({});
    setThreads([]);
    setMessages([]);
    setBalance(0);
  }, []);

  return {
    projects,
    setProjects,
    projectId,
    setProjectId,
    generations,
    outputUrls,
    outputAssets,
    setOutputAssets,
    balance,
    setBalance,
    threads,
    threadId,
    messages,
    setMessages,
    workspaceLoading,
    loadWorkspace,
    loadGenerations,
    loadThreads,
    loadMessages,
    clearWorkspace,
  };
}
