"use client";

import { useCallback } from "react";
import { studioSupabase } from "../../../lib/studio/supabase";

export function useStudioInvoke() {
  return useCallback(async <T,>(name: string, body: Record<string, unknown> = {}) => {
    const { data, error } = await studioSupabase.functions.invoke(name, { body });
    if (error) {
      let details = error.message;
      const context = (error as { context?: unknown }).context;
      if (context && typeof context === "object") {
        const clone = (context as { clone?: unknown }).clone;
        if (typeof clone === "function") {
          try {
            const copy = clone.call(context) as { json?: unknown };
            if (typeof copy?.json === "function") {
              const payload = (await copy.json().catch(() => null)) as { error?: string } | null;
              if (payload?.error) details = payload.error;
            }
          } catch {
            // A network-level function error may expose a non-Response context.
          }
        }
      }
      throw new Error(details);
    }
    return data as T;
  }, []);
}
