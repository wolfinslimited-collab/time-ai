"use client";

import { validParameterOptions } from "../../../lib/studio/video-settings";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { referenceError, shotSequenceError } from "../../../lib/studio/references";
import { referenceMessage, type UploadedReference } from "../../../components/studio/reference-panel";
import { composerQuote } from "../../../lib/studio/composer-quote";
import { composeStudioPrompt, effectiveComposerConfig } from "../../../lib/studio/effective-composer-config";
import { isInsufficientCreditsMessage, messageForError } from "../../../lib/studio/studio-errors";
import {
  EMPTY_STUDIO_MODELS,
  UNAVAILABLE_STUDIO_MODELS,
  type GenerativeMediaType,
  type StudioOutputAsset,
} from "../../../lib/studio/studio-types";
import { CreateWorkspace } from "../../../components/studio/create-workspace";
import { createCopy } from "../../../components/studio/copy/create";
import { StudioChrome } from "../../../components/studio/studio-chrome";
import { TopUpDialog } from "../../../components/studio/studio-dialogs";
import { readStudioCreateSeed, studioExploreHref } from "../../../lib/studio/studio-routes";
import { useStudioCatalog } from "../hooks/use-studio-catalog";
import { useStudioShell, useStudioShellCheckout } from "../hooks/use-studio-shell";

/** Create surface — generate / composer / history. Explore lives at /studio. */
export function StudioCreate() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toolParam = searchParams.get("tool");
  const shell = useStudioShell();
  const {
    models,
    tools,
    creditPacks,
    catalogReady,
    modelKey,
    setModelKey,
    parameters,
    setParameters,
  } = useStudioCatalog(shell.invoke, shell.onNotice);
  const { setPendingPack, checkoutConfirmation, setCheckoutConfirmation, checkingOut } =
    useStudioShellCheckout(shell, creditPacks, catalogReady);

  const { user, invoke, workspace, openAuth, setNotice, onNotice } = shell;

  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [promptEnhance, setPromptEnhance] = useState(true);
  const [creativeStyle, setCreativeStyle] = useState("Cinematic");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [references, setReferences] = useState<UploadedReference[]>([]);
  const [shots, setShots] = useState<{ prompt: string; duration: number }[]>([]);
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [retainingAssetId, setRetainingAssetId] = useState<string | null>(null);
  const [configuredToolKey, setConfiguredToolKey] = useState<string | null>(null);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const seededToolRef = useRef<string | null>(null);
  const pendingGenerateRef = useRef(false);

  const activeTool = tools.find((tool) => tool.key === toolParam && tool.available) || null;
  const mediaType: GenerativeMediaType = activeTool?.mediaType || "image";
  const filteredModels = models.filter((model) => model.media_type === mediaType);
  const selectedModel =
    filteredModels.find((model) => model.key === modelKey) ||
    filteredModels[0] ||
    (catalogReady ? UNAVAILABLE_STUDIO_MODELS[mediaType] : EMPTY_STUDIO_MODELS[mediaType]);
  const composerConfig = effectiveComposerConfig(selectedModel, activeTool);
  const projectGenerations = workspace.generations.filter(
    (generation) =>
      (!workspace.projectId || generation.project_id === workspace.projectId) &&
      generation.media_type === mediaType,
  );
  const quote = selectedModel.key
    ? composerQuote({
        creditCost: selectedModel.credit_cost,
        creditRules: selectedModel.credit_rules,
        parameters,
        shots,
        references,
      })
    : { credits: 0, durationSeconds: undefined as number | undefined, pricingInput: parameters };
  const quotedCredits = quote.credits;
  const displayParameters = { ...parameters };
  if (composerConfig.frameAspectRatio && references.some((r) => r.slot === "first")) {
    displayParameters.aspect_ratio = composerConfig.frameAspectRatio;
  }
  if (shots.length && quote.durationSeconds !== undefined) {
    displayParameters.duration = String(quote.durationSeconds);
  } else if (
    composerConfig.autoDurationWithVideo &&
    references.some((r) => r.mimeType.startsWith("video/"))
  ) {
    delete displayParameters.duration;
  }
  const visibleModelChoices = filteredModels.filter((model) =>
    `${model.name} ${model.description}`.toLowerCase().includes(modelSearch.trim().toLowerCase()),
  );

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Element | null;
      if (!modelPickerOpen || !target || typeof target.closest !== "function") return;
      const insidePicker =
        target.closest("[data-studio-model-picker]") || target.closest("[data-studio-model-trigger]");
      if (!insidePicker) setModelPickerOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setModelPickerOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [modelPickerOpen]);

  useEffect(() => {
    if (!toolParam) {
      router.replace(studioExploreHref());
      return;
    }
    // Wait for a real catalog payload. Empty tools after a failed fetch must not
    // bounce create → explore (that left users stuck on /studio?mode=image).
    if (!catalogReady || tools.length === 0) return;
    const tool = tools.find((item) => item.key === toolParam);
    if (!tool) {
      router.replace(studioExploreHref());
      return;
    }
    if (!tool.available) {
      router.replace(studioExploreHref(tool.mediaType));
    }
  }, [catalogReady, router, toolParam, tools]);

  useEffect(() => {
    if (!activeTool) return;
    if (seededToolRef.current === activeTool.key) return;

    setAdvancedOpen(false);
    setModelPickerOpen(false);
    setReferences([]);
    setShots([]);
    setPromptEnhance(activeTool.usage.promptEnhanceDefault !== false);
    const nextStyle = activeTool.mediaType === "audio" ? "Natural" : "Cinematic";
    const model =
      models.find((item) => item.key === activeTool.modelKey) ||
      models.find((item) => item.media_type === activeTool.mediaType);
    if (model) {
      setModelKey(model.key);
      setParameters({
        ...(model.provider_config.defaultInput || {}),
        ...(activeTool.usage.defaultParameters || {}),
      });
    }

    const seed = readStudioCreateSeed(activeTool.key);
    seededToolRef.current = activeTool.key;
    queueMicrotask(() => {
      setPrompt(seed?.prompt || "");
      setCreativeStyle(seed?.style || nextStyle);
      setConfiguredToolKey(activeTool.key);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => promptTextareaRef.current?.focus());
      });
      window.scrollTo({ top: 0, behavior: "auto" });
    });
  }, [activeTool, models, setModelKey, setParameters]);

  function selectModel(key: string) {
    const model = models.find((item) => item.key === key);
    if (!model) return;
    setModelKey(key);
    setParameters(model.provider_config.defaultInput || {});
    setReferences([]);
    setShots([]);
    setModelPickerOpen(false);
    setModelSearch("");
  }

  function backToExplore() {
    router.push(studioExploreHref(mediaType));
  }

  async function uploadReference(file: File): Promise<string> {
    if (!user) {
      openAuth("signin");
      throw Error("Sign in to upload reference files.");
    }
    if (!workspace.projectId) throw Error("Create a project first.");
    const authorization = await invoke<{
      asset: { id: string };
      upload: { url: string; headers?: Record<string, string> };
    }>("studio-upload-url", {
      projectId: workspace.projectId,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    });
    const response = await fetch(authorization.upload.url, {
      method: "PUT",
      headers: authorization.upload.headers || { "Content-Type": file.type },
      body: file,
    });
    if (!response.ok) throw Error("Upload failed. Please try again.");
    return authorization.asset.id;
  }

  async function generate() {
    if (!user) {
      pendingGenerateRef.current = true;
      return openAuth("signin");
    }
    if (!selectedModel.key) {
      return setNotice(catalogReady ? "No models are available right now." : "Loading models…");
    }
    if (workspace.balance < quotedCredits) {
      setTopUpOpen(true);
      return;
    }
    if (!prompt.trim() && !shots.length && !composerConfig.omitPrompt) {
      return setNotice(
        mediaType === "audio" ? "Add the script you want spoken." : "Describe what you want to create first.",
      );
    }
    if (!workspace.projectId) return setNotice("Create a project first.");
    if (composerConfig.requireReference && !references.length) {
      return setNotice("Add a reference file for this tool first.");
    }
    const refError = referenceError(composerConfig, references, true, parameters);
    if (composerConfig.referenceSlots && refError) return setNotice(referenceMessage(refError));
    if (
      shots.length &&
      shotSequenceError(Boolean(composerConfig.supportsShots), shots, references.length)
    ) {
      return setNotice(
        "Use 2–5 shots, 1–12 seconds each, totaling 3–15 seconds. Multi-shot supports one first-frame image.",
      );
    }
    setGenerating(true);
    setNotice(null);
    try {
      const userPrompt =
        prompt.trim() ||
        (shots.length ? shots.map((s) => s.prompt).join(" ") : "Lip sync video to voice recording");
      const composedPrompt = composeStudioPrompt({
        mediaType,
        userPrompt,
        creativeStyle,
        config: composerConfig,
        promptEnhance,
      });
      await invoke("studio-create-generation", {
        projectId: workspace.projectId,
        modelKey: selectedModel.key,
        toolKey: activeTool?.key,
        promptEnhance,
        prompt: composedPrompt,
        negativePrompt:
          selectedModel.provider_config.allowNegativePrompt === false
            ? undefined
            : negativePrompt.trim() || undefined,
        parameters,
        shots: shots.length ? shots : undefined,
        inputAssetIds: references.map((r) => r.id),
        references: selectedModel.provider_config.referenceSlots
          ? references.map(({ id, slot, start, end }) => ({ id, slot, start, end }))
          : undefined,
        idempotencyKey: crypto.randomUUID(),
      });
      setPrompt("");
      setReferences([]);
      setShots([]);
      await workspace.loadGenerations();
    } catch (error) {
      const message = messageForError(error, referenceMessage);
      if (isInsufficientCreditsMessage(message)) setTopUpOpen(true);
      else setNotice(message);
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => {
    if (!pendingGenerateRef.current) return;
    if (!user || !shell.authReady) return;
    if (workspace.workspaceLoading || !workspace.projectId) return;
    pendingGenerateRef.current = false;
    void generate();
    // Resume once after sign-in when workspace is ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot resume; generate uses latest render state
  }, [user, shell.authReady, workspace.workspaceLoading, workspace.projectId]);

  async function refreshGeneration(generationId: string) {
    try {
      await invoke("studio-refresh-generation", { generationId });
      await workspace.loadGenerations();
    } catch (error) {
      setNotice(messageForError(error, referenceMessage));
    }
  }

  async function retainOutput(asset: StudioOutputAsset) {
    if (asset.retained_at || retainingAssetId) return;
    setRetainingAssetId(asset.id);
    try {
      const result = await invoke<{ retainedAt: string }>("studio-retain-asset", { assetId: asset.id });
      workspace.setOutputAssets((current) => ({
        ...current,
        [asset.generation_id]: { ...asset, retained_at: result.retainedAt, expires_at: null },
      }));
      setNotice("Saved to your project. This file will not expire.");
    } catch (error) {
      setNotice(messageForError(error, referenceMessage));
    } finally {
      setRetainingAssetId(null);
    }
  }

  function reusePrompt(value: string) {
    setPrompt(value);
    window.requestAnimationFrame(() => promptTextareaRef.current?.focus());
  }

  function newThread() {
    setPrompt("");
    setNegativePrompt("");
    setReferences([]);
    setShots([]);
    setAdvancedOpen(false);
    setModelPickerOpen(false);
    window.requestAnimationFrame(() => promptTextareaRef.current?.focus());
  }

  const parameterEntries = Object.entries(selectedModel.parameter_schema?.properties || {})
    .map(
      ([key, rule]) =>
        [
          key,
          {
            ...rule,
            enum: rule.enum
              ? validParameterOptions(
                  key,
                  rule.enum,
                  parameters,
                  selectedModel.parameter_schema.forbiddenCombinations,
                )
              : undefined,
          },
        ] as const,
    )
    .filter(
      ([key]) =>
        !(
          key === "aspect_ratio" &&
          composerConfig.frameAspectRatio &&
          references.some((r) => r.slot === "first")
        ) &&
        !(
          key === "duration" &&
          (shots.length > 0 ||
            (composerConfig.autoDurationWithVideo &&
              references.some((r) => r.mimeType.startsWith("video/"))))
        ) &&
        !["multi_shots", "timestamps", "style", "language_code", "previous_text", "next_text", "align_audio"].includes(
          key,
        ),
    );
  const styleOptions =
    mediaType === "audio"
      ? ["Natural", "Warm", "Editorial", "Dramatic"]
      : ["Cinematic", "Editorial", "Minimal", "Photoreal", "Anime", "None"];

  const referencePanelConfig = composerConfig.referenceSlots
    ? composerConfig
    : {
        ...composerConfig,
        referenceSlots: composerConfig.inputField
          ? [
              {
                key: "legacy",
                label: "Image",
                field: composerConfig.inputField,
                mimeTypes: ["image/jpeg", "image/png", "image/webp"],
                max: composerConfig.maxInputs || 1,
                min: composerConfig.minInputs || 0,
                maxBytes: 10 * 1024 * 1024,
              },
            ]
          : [],
      };

  async function useAsReference(generationId: string) {
    const generation = projectGenerations.find((item) => item.id === generationId);
    const asset = workspace.outputAssets[generationId];
    const url = workspace.outputUrls[generationId];
    const slots = referencePanelConfig.referenceSlots || [];
    if (!generation || !asset || !url || !slots.length) {
      return setNotice(createCopy.cannotUseAsReference);
    }

    const mediaPrefix =
      generation.media_type === "video"
        ? "video/"
        : generation.media_type === "audio"
          ? "audio/"
          : "image/";
    const slot = slots.find((item) => item.mimeTypes.some((mime) => mime.startsWith(mediaPrefix)));
    if (!slot) return setNotice(createCopy.cannotUseAsReference);

    const mimeType =
      slot.mimeTypes.find((mime) => mime.startsWith(mediaPrefix)) || slot.mimeTypes[0];
    let width = 1024;
    let height = 1024;
    let duration: number | undefined;

    if (mimeType.startsWith("image/")) {
      try {
        const size = await new Promise<{ w: number; h: number }>((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve({ w: image.naturalWidth, h: image.naturalHeight });
          image.onerror = () => reject(new Error("load_failed"));
          image.src = url;
        });
        width = size.w || width;
        height = size.h || height;
      } catch {
        /* keep defaults so validation can still pass for known assets */
      }
    } else if (mimeType.startsWith("video/") || mimeType.startsWith("audio/")) {
      try {
        duration = await new Promise<number>((resolve, reject) => {
          const media = document.createElement(mimeType.startsWith("video/") ? "video" : "audio");
          media.preload = "metadata";
          media.onloadedmetadata = () => resolve(media.duration || 5);
          media.onerror = () => reject(new Error("load_failed"));
          media.src = url;
        });
        if (mimeType.startsWith("video/")) {
          width = 1280;
          height = 720;
        }
      } catch {
        duration = 5;
      }
    }

    const next: UploadedReference = {
      id: asset.id,
      slot: slot.key,
      mimeType,
      sizeBytes: 1024,
      width: mimeType.startsWith("audio/") ? undefined : width,
      height: mimeType.startsWith("audio/") ? undefined : height,
      duration,
      name: createCopy.previousResult,
      preview: url,
    };
    const error = referenceError(
      composerConfig,
      [...references.filter((r) => r.id !== asset.id), next],
      false,
    );
    if (error) return setNotice(referenceMessage(error));

    setReferences([...references.filter((r) => r.id !== asset.id), next]);
    setNotice(createCopy.referenceAttached);
    window.requestAnimationFrame(() => promptTextareaRef.current?.focus());
  }

  return (
    <StudioChrome
      variant="create"
      createTitle={activeTool?.name}
      onBackToExplore={backToExplore}
      user={user}
      authReady={shell.authReady}
      authOpen={shell.authOpen}
      authMode={shell.authMode}
      onAuthOpen={openAuth}
      onAuthClose={() => shell.setAuthOpen(false)}
      onAuthCancel={() => {
        pendingGenerateRef.current = false;
        shell.authCancel(() => setPendingPack(null));
      }}
      onAuthNotice={onNotice}
      balance={workspace.balance}
      projects={workspace.projects}
      projectId={workspace.projectId}
      onSelectProject={(project) => {
        workspace.setProjectId(project.id);
        workspace.loadThreads(project.id);
        workspace.loadMessages(null);
      }}
      onNewProject={() => {}}
      createProject={shell.createProject}
      onSignOut={shell.signOut}
      onOpenPricing={() => setTopUpOpen(true)}
      notice={shell.notice}
      onDismissNotice={() => setNotice(null)}
      checkoutConfirmation={checkoutConfirmation}
      onDismissCheckout={() => setCheckoutConfirmation(null)}
    >
      {activeTool && configuredToolKey === activeTool.key ? (
        <CreateWorkspace
          activeTool={activeTool}
          mediaType={mediaType}
          selectedModel={selectedModel}
          prompt={prompt}
          negativePrompt={negativePrompt}
          promptEnhance={promptEnhance}
          creativeStyle={creativeStyle}
          advancedOpen={advancedOpen}
          modelPickerOpen={modelPickerOpen}
          modelSearch={modelSearch}
          references={references}
          shots={shots}
          parameters={parameters}
          generating={generating}
          uploading={uploading}
          checkingOut={checkingOut}
          quotedCredits={quotedCredits}
          displayParameters={displayParameters}
          parameterEntries={parameterEntries}
          styleOptions={styleOptions}
          composerConfig={composerConfig}
          referencePanelConfig={referencePanelConfig}
          visibleModelChoices={visibleModelChoices}
          generations={projectGenerations}
          outputUrls={workspace.outputUrls}
          outputAssets={workspace.outputAssets}
          models={models}
          workspaceLoading={workspace.workspaceLoading}
          retainingAssetId={retainingAssetId}
          promptTextareaRef={promptTextareaRef}
          onBack={backToExplore}
          onPrompt={setPrompt}
          onNegativePrompt={setNegativePrompt}
          onPromptEnhance={setPromptEnhance}
          onCreativeStyle={setCreativeStyle}
          onAdvancedOpen={setAdvancedOpen}
          onModelPickerOpen={setModelPickerOpen}
          onModelSearch={setModelSearch}
          onSelectModel={selectModel}
          onReferences={setReferences}
          onShots={setShots}
          onParameters={setParameters}
          onGenerate={() => void generate()}
          onUploadReference={uploadReference}
          onBusy={setUploading}
          onError={setNotice}
          onRefreshGeneration={(id) => void refreshGeneration(id)}
          onRetainOutput={(asset) => void retainOutput(asset)}
          onUseAsReference={(id) => void useAsReference(id)}
          onReusePrompt={reusePrompt}
          onNewThread={newThread}
        />
      ) : (
        <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted">Loading create…</div>
      )}
      {topUpOpen && (
        <TopUpDialog
          packs={creditPacks}
          balance={workspace.balance}
          neededCredits={quotedCredits}
          checkingOut={checkingOut}
          onClose={() => setTopUpOpen(false)}
          onSelectPack={(packKey) => {
            setTopUpOpen(false);
            setPendingPack(packKey);
          }}
        />
      )}
    </StudioChrome>
  );
}
