"use client";

import { useCallback, useEffect, useState } from "react";
import type { CreditPack } from "../../../lib/studio/credit-packs";
import { messageForError } from "../../../lib/studio/studio-errors";
import { hydrateTool, type CatalogToolRow, type StudioModel, type StudioTool } from "../../../lib/studio/studio-types";
import type { useStudioInvoke } from "./use-studio-invoke";

type Invoke = ReturnType<typeof useStudioInvoke>;

export function useStudioCatalog(invoke: Invoke, onNotice: (message: string) => void) {
  const [models, setModels] = useState<StudioModel[]>([]);
  const [tools, setTools] = useState<StudioTool[]>([]);
  const [creditPacks, setCreditPacks] = useState<CreditPack[]>([]);
  const [catalogReady, setCatalogReady] = useState(false);
  const [modelKey, setModelKey] = useState("");
  const [parameters, setParameters] = useState<Record<string, string | number | boolean>>({});

  const loadCatalog = useCallback(async () => {
    try {
      const result = await invoke<{ models?: StudioModel[]; packs?: CreditPack[]; tools?: CatalogToolRow[] }>("studio-catalog");
      const liveModels = result.models || [];
      const livePacks = result.packs || [];
      const liveTools = (result.tools || []).map(hydrateTool);
      if (liveModels.length) {
        setModels(liveModels);
        setModelKey((current) => {
          if (current && liveModels.some((model) => model.key === current)) return current;
          return liveModels.find((model) => model.media_type === "image")?.key || liveModels[0].key;
        });
        setParameters((current) => {
          if (Object.keys(current).length) return current;
          const next = liveModels.find((model) => model.media_type === "image") || liveModels[0];
          return next.provider_config.defaultInput || {};
        });
      }
      if (livePacks.length) setCreditPacks(livePacks);
      if (liveTools.length) setTools(liveTools);
    } catch (error) {
      onNotice(messageForError(error));
    } finally {
      setCatalogReady(true);
    }
  }, [invoke, onNotice]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCatalog();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadCatalog]);

  return {
    models,
    tools,
    creditPacks,
    catalogReady,
    modelKey,
    setModelKey,
    parameters,
    setParameters,
    loadCatalog,
  };
}
