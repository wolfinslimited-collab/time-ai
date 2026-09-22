"use client";

import { validParameterOptions, updateModelParameter } from "../../lib/studio/video-settings";
import {
  ArrowLeft,
  AudioLines,
  Bookmark,
  Check,
  ChevronDown,
  Clapperboard,
  Clock3,
  Coins,
  Download,
  FolderKanban,
  ImageIcon,
  LoaderCircle,
  LogOut,
  MessageSquareText,
  Palette,
  Plus,
  RefreshCw,
  Settings2,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { referenceError, shotSequenceError } from "../../lib/studio/references";
import { ReferencePanel, referenceMessage, type UploadedReference } from "../../components/studio/reference-panel";
import { modelCatalog, type CatalogModel } from "../../lib/studio/model-catalog";
import { studioSupabase } from "../../lib/studio/supabase";
import { StudioSupport } from "../../components/studio/studio-support";
import { AuthDialog, displayName } from "../../components/studio/auth-dialog";
import type { ShowcaseExample } from "./data/showcase-examples";
import { composerQuote, shotTotalDuration } from "../../lib/studio/composer-quote";
import { composeStudioPrompt, effectiveComposerConfig } from "../../lib/studio/effective-composer-config";
import { isInsufficientCreditsMessage, messageForError } from "../../lib/studio/studio-errors";
import {
  EMPTY_STUDIO_MODELS,
  UNAVAILABLE_STUDIO_MODELS,
  displayParamValue,
  hydrateTool,
  isActiveGeneration,
  modeLabel,
  modelVariantLabel,
  readableParam,
  retentionLabel,
  type GenerativeMediaType,
  type MediaType,
  type StudioOutputAsset,
  type StudioProject,
  type StudioTool,
  TOOL_ICONS,
} from "../../lib/studio/studio-types";
import { Header } from "../../components/header";
import { ChatWorkspace } from "../../components/studio/chat-workspace";
import { CreditSuccessDialog, NewProjectDialog } from "../../components/studio/studio-dialogs";
import { StudioMegaMenu } from "../../components/studio/studio-mega-menu";
import { StudioModelPicker } from "../../components/studio/studio-model-picker";
import { ToolLibrary } from "../../components/studio/tool-library";
import { useStudioAuth } from "./hooks/use-studio-auth";
import { useStudioCatalog } from "./hooks/use-studio-catalog";
import { useStudioCheckout } from "./hooks/use-studio-checkout";
import { useStudioInvoke } from "./hooks/use-studio-invoke";
import { useStudioWorkspaceData } from "./hooks/use-studio-workspace-data";

export { TOOL_ICONS, hydrateTool };

export function StudioWorkspace() {
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
  const {
    models,
    tools,
    creditPacks,
    catalogReady,
    modelKey,
    setModelKey,
    parameters,
    setParameters,
  } = useStudioCatalog(invoke, onNotice);
  const workspace = useStudioWorkspaceData({ user, invoke, onNotice });
  useEffect(() => {
    clearWorkspaceRef.current = workspace.clearWorkspace;
  }, [workspace.clearWorkspace]);

  const {
    setPendingPack,
    checkoutConfirmation,
    setCheckoutConfirmation,
    checkingOut,
  } = useStudioCheckout({
    user,
    authReady,
    catalogReady,
    creditPacks,
    invoke,
    setBalance: workspace.setBalance,
    setNotice,
    setAuthOpen: (open) => {
      if (open) openAuth("signin");
      else setAuthOpen(false);
    },
  });

  const [mediaType, setMediaType] = useState<MediaType>("image");
  const [menuType, setMenuType] = useState<MediaType | null>(null);
  const [activeToolKey, setActiveToolKey] = useState<string | null>(null);
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
  const [chatting, setChatting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [retainingAssetId, setRetainingAssetId] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [chatPrompt, setChatPrompt] = useState("");
  const [chatSearch, setChatSearch] = useState("");
  const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const projectMenuRef = useRef<HTMLDivElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  const openPricing = () => window.location.assign("/pricing");

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (projectMenuOpen && projectMenuRef.current && !projectMenuRef.current.contains(target)) {
        setProjectMenuOpen(false);
      }
      if (profileOpen && profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        setProfileOpen(false);
      }
      if (modelPickerOpen) {
        const el = target as Element | null;
        const insidePicker =
          el &&
          typeof el.closest === "function" &&
          (el.closest(".studio-model-picker") || el.closest(".studio-model-trigger"));
        if (!insidePicker) setModelPickerOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setProjectMenuOpen(false);
      setProfileOpen(false);
      setModelPickerOpen(false);
      setMenuType(null);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [modelPickerOpen, profileOpen, projectMenuOpen]);

  const activeTool = tools.find((tool) => tool.key === activeToolKey) || null;
  const generationType: GenerativeMediaType = mediaType === "chat" ? "image" : mediaType;
  const filteredModels = useMemo(
    () => models.filter((model) => model.media_type === generationType),
    [models, generationType],
  );
  const selectedModel =
    filteredModels.find((model) => model.key === modelKey) ||
    filteredModels[0] ||
    (catalogReady ? UNAVAILABLE_STUDIO_MODELS[generationType] : EMPTY_STUDIO_MODELS[generationType]);
  const composerConfig = effectiveComposerConfig(selectedModel, activeTool);
  const selectedProject = workspace.projects.find((project) => project.id === workspace.projectId) || null;
  const projectGenerations = workspace.generations.filter(
    (generation) =>
      (!workspace.projectId || generation.project_id === workspace.projectId) &&
      generation.media_type === generationType,
  );
  const categoryTools = tools.filter((tool) => tool.mediaType === generationType);
  const visibleThreads = workspace.threads.filter((thread) =>
    thread.title.toLowerCase().includes(chatSearch.toLowerCase()),
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

  function resetStudioScroll() {
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
  }

  function changeMediaType(nextType: MediaType) {
    setMediaType(nextType);
    setActiveToolKey(null);
    setAdvancedOpen(false);
    setModelPickerOpen(false);
    setReferences([]);
    setShots([]);
    setCreativeStyle(nextType === "audio" ? "Natural" : "Cinematic");
    if (nextType !== "chat") {
      const nextModel = models.find((model) => model.media_type === nextType);
      if (nextModel) {
        setModelKey(nextModel.key);
        setParameters(nextModel.provider_config.defaultInput || {});
      }
    }
    resetStudioScroll();
  }

  function openTool(tool: StudioTool) {
    setMenuType(null);
    if (!tool.available) {
      return setNotice(
        tool.badge === "Provider paused"
          ? `${tool.name} is temporarily paused while Kie restores audio capacity.`
          : `${tool.name} is next in the Timeless rollout.`,
      );
    }
    setActiveToolKey(tool.key);
    setMediaType(tool.mediaType);
    setAdvancedOpen(false);
    setModelPickerOpen(false);
    setReferences([]);
    setShots([]);
    setPromptEnhance(tool.usage.promptEnhanceDefault !== false);
    const model =
      models.find((item) => item.key === tool.modelKey) ||
      models.find((item) => item.media_type === tool.mediaType);
    if (model) {
      setModelKey(model.key);
      setParameters({ ...(model.provider_config.defaultInput || {}), ...(tool.usage.defaultParameters || {}) });
    }
    resetStudioScroll();
  }

  async function recreateExample(example: ShowcaseExample) {
    const tool =
      tools.find((item) => item.key === example.toolKey) || tools.find((item) => item.key === "create-image");
    if (!tool) return setNotice(catalogReady ? `${example.title} tool is not available yet.` : "Loading tools…");
    openTool(tool);
    setPrompt(example.prompt);
    setCreativeStyle(example.style);
    try {
      await navigator.clipboard.writeText(example.prompt);
      setNotice("Prompt copied and ready to recreate.");
    } catch {
      setNotice("Prompt loaded and ready to recreate.");
    }
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => promptTextareaRef.current?.focus());
    });
  }

  function toggleModeMenu(nextType: MediaType) {
    if (menuType === nextType) {
      setMenuType(null);
      return;
    }
    if (mediaType !== nextType) changeMediaType(nextType);
    setMenuType(nextType);
  }

  function chooseCatalogModel(nextType: MediaType, catalogModel: CatalogModel) {
    if (nextType === "chat" && catalogModel.modelKey === "gpt-5-2") {
      setMediaType("chat");
      setActiveToolKey(null);
      setMenuType(null);
      resetStudioScroll();
      return;
    }
    const model = models.find((item) => item.key === catalogModel.modelKey);
    if (!model) {
      setMenuType(null);
      setNotice(`${catalogModel.name} is in the next Timeless model rollout.`);
      return;
    }
    setMediaType(nextType);
    setActiveToolKey(
      tools.find((tool) => tool.available && tool.mediaType === nextType && !tool.reference)?.key || null,
    );
    setModelKey(model.key);
    setParameters(model.provider_config.defaultInput || {});
    setReferences([]);
    setShots([]);
    setMenuType(null);
    resetStudioScroll();
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
    if (!user) return openAuth("signin");
    if (!selectedModel.key) {
      return setNotice(catalogReady ? "No models are available right now." : "Loading models…");
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
    if (workspace.balance < quotedCredits) return openPricing();
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
      if (isInsufficientCreditsMessage(message)) openPricing();
      else setNotice(message);
    } finally {
      setGenerating(false);
    }
  }

  async function sendChat() {
    if (!user) return openAuth("signin");
    if (!chatPrompt.trim()) return;
    if (!workspace.projectId) return setNotice("Create a project first.");
    if (workspace.balance < 1) return openPricing();
    const outgoing = chatPrompt.trim();
    setChatPrompt("");
    setChatting(true);
    setNotice(null);
    const optimistic = {
      id: `local-${Date.now()}`,
      role: "user" as const,
      content: outgoing,
      credits_charged: 0,
      provider_tokens: null,
      created_at: new Date().toISOString(),
    };
    workspace.setMessages((current) => [...current, optimistic]);
    try {
      const result = await invoke<{
        threadId: string;
        message?: {
          id: string;
          role: "user" | "assistant";
          content: string;
          credits_charged: number;
          provider_tokens: number | null;
          created_at: string;
        };
        creditsCharged?: number;
      }>("studio-chat", {
        projectId: workspace.projectId,
        threadId: workspace.threadId,
        message: outgoing,
      });
      await workspace.loadThreads(workspace.projectId);
      if (result.message && workspace.threadId === result.threadId) {
        workspace.setMessages((current) => [
          ...current.filter((message) => message.id !== optimistic.id),
          optimistic,
          result.message!,
        ]);
      } else {
        await workspace.loadMessages(result.threadId);
      }
      const { data: wallet } = await studioSupabase
        .from("studio_credit_wallets")
        .select("balance")
        .eq("user_id", user.id)
        .maybeSingle();
      if (wallet) workspace.setBalance(Number(wallet.balance));
    } catch (error) {
      workspace.setMessages((current) => current.filter((message) => message.id !== optimistic.id));
      const message = messageForError(error, referenceMessage);
      if (isInsufficientCreditsMessage(message)) openPricing();
      else setNotice(message);
    } finally {
      setChatting(false);
    }
  }

  async function refreshGeneration(generationId: string) {
    try {
      await invoke("studio-refresh-generation", { generationId });
      await workspace.loadGenerations();
    } catch (error) {
      setNotice(messageForError(error, referenceMessage));
    }
  }

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
      setNewProjectOpen(false);
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

  async function handleSignOut() {
    await signOut();
    setProfileOpen(false);
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

  const modeNavButton = (active: boolean) =>
    `inline-flex items-center gap-1.5 text-sm font-medium transition-colors ${
      active ? "text-foreground" : "text-subtle hover:text-muted"
    }`;

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

  return (
    <main className="studio-app relative min-h-screen bg-canvas text-foreground">
      <Header
        variant="studio"
        afterBrand={
          <nav className="flex items-center justify-start gap-5" aria-label="Creation modes">
            <button
              aria-expanded={menuType === "image"}
              className={modeNavButton(mediaType === "image")}
              onClick={() => toggleModeMenu("image")}
              type="button"
            >
              <ImageIcon size={16} className={mediaType === "image" ? "text-accent" : undefined} /> Image{" "}
              <ChevronDown className={`transition-transform ${menuType === "image" ? "rotate-180" : ""}`} size={12} />
            </button>
            <button
              aria-expanded={menuType === "video"}
              className={modeNavButton(mediaType === "video")}
              onClick={() => toggleModeMenu("video")}
              type="button"
            >
              <Clapperboard size={16} className={mediaType === "video" ? "text-accent" : undefined} /> Video{" "}
              <ChevronDown className={`transition-transform ${menuType === "video" ? "rotate-180" : ""}`} size={12} />
            </button>
            <button
              aria-expanded={menuType === "audio"}
              className={modeNavButton(mediaType === "audio")}
              onClick={() => toggleModeMenu("audio")}
              type="button"
            >
              <AudioLines size={16} className={mediaType === "audio" ? "text-accent" : undefined} /> Sound{" "}
              <ChevronDown className={`transition-transform ${menuType === "audio" ? "rotate-180" : ""}`} size={12} />
            </button>
            <button
              aria-expanded={menuType === "chat"}
              className={modeNavButton(mediaType === "chat")}
              onClick={() => toggleModeMenu("chat")}
              type="button"
            >
              <MessageSquareText size={16} className={mediaType === "chat" ? "text-accent" : undefined} /> Chat{" "}
              <ChevronDown className={`transition-transform ${menuType === "chat" ? "rotate-180" : ""}`} size={12} />
            </button>
          </nav>
        }
        end={
          <>
            {user && (
              <>
                <div className="relative hidden sm:block" ref={projectMenuRef}>
                  <button
                    className="inline-flex max-w-44 min-h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-transparent px-2.5 text-xs text-muted"
                    type="button"
                    onClick={() => setProjectMenuOpen((open) => !open)}
                  >
                    <FolderKanban size={15} />
                    <span className="truncate">{selectedProject?.name || "Projects"}</span>
                    <ChevronDown size={13} />
                  </button>
                  {projectMenuOpen && (
                    <div className="absolute top-full right-0 z-40 mt-2.5 grid w-60 gap-0.5 rounded-xl border border-white/10 bg-elevated/95 p-2 shadow-2xl backdrop-blur-xl">
                      <p className="mx-2 mt-1 mb-2 font-mono text-xs tracking-widest text-subtle uppercase">Projects</p>
                      {workspace.projects.map((project) => (
                        <button
                          className={`grid min-w-0 grid-cols-[18px_minmax(0,1fr)_16px] items-center gap-1.5 rounded-lg px-2.5 py-2.5 text-left text-xs ${
                            project.id === workspace.projectId ? "bg-white/5 text-foreground" : "bg-transparent text-muted"
                          }`}
                          key={project.id}
                          type="button"
                          onClick={() => {
                            workspace.setProjectId(project.id);
                            setProjectMenuOpen(false);
                            workspace.loadThreads(project.id);
                            workspace.loadMessages(null);
                          }}
                        >
                          <FolderKanban size={14} />
                          <span className="truncate">{project.name}</span>
                          {project.id === workspace.projectId && <Check className="text-accent" size={13} />}
                        </button>
                      ))}
                      <button
                        className="mt-1 grid grid-cols-[18px_1fr] items-center gap-1.5 border-t border-white/10 px-2.5 pt-2.5 pb-1 text-left text-xs text-accent-soft"
                        type="button"
                        onClick={() => {
                          setProjectMenuOpen(false);
                          setNewProjectOpen(true);
                        }}
                      >
                        <Plus size={14} /> New project
                      </button>
                    </div>
                  )}
                </div>
                <button
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-sm text-foreground"
                  onClick={() => openPricing()}
                  type="button"
                >
                  <Coins size={15} /> {workspace.balance.toLocaleString()}
                </button>
              </>
            )}
            {!authReady ? (
              <span className="grid size-9 place-items-center text-muted" aria-hidden="true">
                <LoaderCircle className="animate-spin" size={16} />
              </span>
            ) : user ? (
              <div className="relative" ref={profileMenuRef}>
                <button
                  className="inline-flex size-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-xs font-bold tracking-wide text-neutral-50 transition-colors duration-150 hover:bg-white/15"
                  onClick={() => setProfileOpen((open) => !open)}
                  type="button"
                  aria-expanded={profileOpen}
                  aria-label="Account menu"
                >
                  {displayName(user).slice(0, 2).toUpperCase()}
                </button>
                {profileOpen && (
                  <div className="absolute top-full right-0 mt-2.5 grid w-56 gap-1 rounded-xl border border-white/10 bg-elevated p-3.5 shadow-2xl">
                    <strong className="truncate text-xs text-foreground">{displayName(user)}</strong>
                    <span className="truncate text-xs text-muted">{user.email}</span>
                    <button
                      className="mt-2 inline-flex items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-muted hover:bg-white/5 hover:text-foreground"
                      type="button"
                      onClick={handleSignOut}
                    >
                      <LogOut size={14} /> Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <button
                  className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-neutral-50 transition-colors duration-150 hover:bg-white/10"
                  onClick={() => openAuth("signin")}
                  type="button"
                >
                  Sign in
                </button>
                <button
                  className="inline-flex items-center justify-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-colors duration-150 hover:bg-accent-soft"
                  onClick={() => openAuth("signup")}
                  type="button"
                >
                  Sign up
                </button>
              </>
            )}
          </>
        }
      />

      {menuType && (
        <>
          <button
            className="studio-mega-scrim"
            type="button"
            aria-label="Close creation menu"
            onClick={() => setMenuType(null)}
          />
          <StudioMegaMenu
            activeType={menuType}
            models={modelCatalog[menuType]}
            tools={tools}
            onClose={() => setMenuType(null)}
            onModel={(model) => chooseCatalogModel(menuType, model)}
            onTool={openTool}
          />
        </>
      )}

      {mediaType === "chat" ? (
        <ChatWorkspace
          busy={chatting}
          chatPrompt={chatPrompt}
          chatSearch={chatSearch}
          messages={workspace.messages}
          onNew={() => workspace.loadMessages(null)}
          onPrompt={setChatPrompt}
          onSearch={setChatSearch}
          onSelectThread={workspace.loadMessages}
          onSend={sendChat}
          selectedThreadId={workspace.threadId}
          threads={visibleThreads}
          user={user}
        />
      ) : !activeTool ? (
        <ToolLibrary
          mediaType={generationType}
          tools={categoryTools}
          onMode={changeMediaType}
          onOpen={openTool}
          onRecreate={recreateExample}
        />
      ) : (
        <section className="studio-stage">
          <div className="studio-workspace-toolbar sticky top-16 z-20 max-md:top-28">
            <button type="button" onClick={() => setActiveToolKey(null)}>
              <ArrowLeft size={15} /> All {modeLabel(mediaType)} tools
            </button>
            <span>
              <activeTool.icon size={14} /> {activeTool.name}
            </span>
            <button
              type="button"
              onClick={() => document.getElementById("studio-generations")?.scrollIntoView({ behavior: "smooth" })}
            >
              <Clock3 size={15} /> History
            </button>
          </div>
          {workspace.workspaceLoading && !projectGenerations.length ? (
            <div className="studio-loading-state">
              <LoaderCircle size={24} /> Loading your studio…
            </div>
          ) : projectGenerations.length ? (
            <div className="studio-generations" id="studio-generations">
              {projectGenerations.map((generation) => {
                const model = models.find((item) => item.key === generation.model_key);
                const outputUrl = workspace.outputUrls[generation.id];
                const outputAsset = workspace.outputAssets[generation.id];
                const retention = retentionLabel(outputAsset);
                const expired = retention === "Expired";
                const isActive = isActiveGeneration(generation.status);
                return (
                  <article
                    className={`studio-generation studio-generation-${generation.media_type}`}
                    key={generation.id}
                  >
                    <div className="studio-generation-media">
                      {outputUrl && generation.media_type === "image" ? (
                        <img src={outputUrl} alt={generation.prompt} />
                      ) : outputUrl && generation.media_type === "video" ? (
                        <video src={outputUrl} controls preload="metadata" />
                      ) : outputUrl && generation.media_type === "audio" ? (
                        <div className="studio-audio-result">
                          <AudioLines size={34} />
                          <audio src={outputUrl} controls preload="metadata" />
                        </div>
                      ) : (
                        <div
                          className={`studio-generation-placeholder is-${expired ? "expired" : generation.status}`}
                        >
                          {isActive ? (
                            <LoaderCircle size={24} />
                          ) : generation.status === "failed" || expired ? (
                            <X size={24} />
                          ) : (
                            <Sparkles size={24} />
                          )}
                          <span>
                            {isActive
                              ? `${generation.progress || 1}% creating`
                              : expired
                                ? "File expired"
                                : generation.status}
                          </span>
                        </div>
                      )}
                      <span className={`studio-status studio-status-${expired ? "expired" : generation.status}`}>
                        {expired ? "expired" : generation.status}
                      </span>
                    </div>
                    <div className="studio-generation-info">
                      <p>{generation.prompt}</p>
                      <div>
                        <span>{model?.name || generation.model_key}</span>
                        <span>{generation.credits_charged} credits</span>
                        <span>{new Date(generation.created_at).toLocaleDateString()}</span>
                        {retention && (
                          <span
                            className={`studio-retention-state ${
                              outputAsset?.retained_at ? "is-kept" : expired ? "is-expired" : ""
                            }`}
                          >
                            <Clock3 size={12} /> {retention}
                          </span>
                        )}
                        {isActive && (
                          <button onClick={() => refreshGeneration(generation.id)} type="button">
                            <RefreshCw size={12} /> Refresh
                          </button>
                        )}
                        {outputUrl && (
                          <a href={outputUrl} download target="_blank" rel="noreferrer">
                            <Download size={12} /> Export
                          </a>
                        )}
                        {outputUrl && outputAsset && !outputAsset.retained_at && (
                          <button
                            disabled={retainingAssetId === outputAsset.id}
                            onClick={() => retainOutput(outputAsset)}
                            type="button"
                          >
                            {retainingAssetId === outputAsset.id ? <LoaderCircle size={12} /> : <Bookmark size={12} />} Keep
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="studio-empty-state">
              <div className="studio-focus-frame" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </div>
              <p>{modeLabel(mediaType).toUpperCase()}</p>
              <h2>{activeTool.name}</h2>
              <span>{activeTool.usage.howTo || activeTool.description}</span>
              {activeTool.usage.steps?.length ? (
                <ol className="mt-4 list-decimal space-y-1 pl-5 text-left text-sm text-muted">
                  {activeTool.usage.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              ) : null}
              <button className="studio-model-pill" type="button">
                {selectedModel.name} <Sparkles size={12} />
              </button>
            </div>
          )}

          <section className="studio-composer" aria-label="AI creation controls">
            {advancedOpen && (
              <div className="studio-advanced-panel">
                {selectedModel.provider_config.allowNegativePrompt !== false && (
                  <label>
                    Negative prompt
                    <input
                      value={negativePrompt}
                      onChange={(event) => setNegativePrompt(event.target.value)}
                      placeholder="What should the model avoid?"
                    />
                  </label>
                )}
                <p>Outputs are private to your Timeless account and project.</p>
              </div>
            )}
            {composerConfig.supportsShots && (
              <section className="studio-shot-list" aria-label="Shot sequence">
                <label>
                  <input
                    type="checkbox"
                    checked={shots.length > 0}
                    onChange={(e) =>
                      setShots(e.target.checked ? [{ prompt: "", duration: 3 }, { prompt: "", duration: 3 }] : [])
                    }
                  />{" "}
                  Multi-shot sequence
                </label>
                {shots.length > 0 && (
                  <>
                    <p>2–5 shots · 3–15 seconds total · One optional first-frame image</p>
                    {shots.map((shot, i) => (
                      <div key={i}>
                        <label>
                          Shot {i + 1}
                          <textarea
                            aria-label={`Shot ${i + 1} prompt`}
                            maxLength={500}
                            value={shot.prompt}
                            onChange={(e) =>
                              setShots(shots.map((s, j) => (j === i ? { ...s, prompt: e.target.value } : s)))
                            }
                          />
                        </label>
                        <label>
                          Seconds
                          <input
                            aria-label={`Shot ${i + 1} seconds`}
                            type="number"
                            min={1}
                            max={12}
                            value={shot.duration}
                            onChange={(e) =>
                              setShots(
                                shots.map((s, j) => (j === i ? { ...s, duration: Number(e.target.value) } : s)),
                              )
                            }
                          />
                        </label>
                        <button
                          type="button"
                          disabled={shots.length <= 2}
                          aria-label={`Remove shot ${i + 1}`}
                          onClick={() => setShots(shots.filter((_, j) => j !== i))}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      disabled={shots.length >= 5}
                      onClick={() => setShots([...shots, { prompt: "", duration: 3 }])}
                    >
                      Add shot
                    </button>
                    <strong> {shotTotalDuration(shots)} seconds total</strong>
                  </>
                )}
              </section>
            )}
            <ReferencePanel
              key={selectedModel.key}
              config={referencePanelConfig}
              value={references}
              onChange={setReferences}
              onUpload={uploadReference}
              onBusy={setUploading}
              onError={setNotice}
              disabled={generating}
            />
            {!composerConfig.omitPrompt && (
              <textarea
                ref={promptTextareaRef}
                aria-label="Creation prompt"
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void generate();
                }}
                placeholder={
                  mediaType === "audio"
                    ? "Paste the script you want spoken…"
                    : `Describe the ${mediaType} you want to create…`
                }
                value={prompt}
                rows={3}
              />
            )}
            <div className="studio-control-row">
              <button className="studio-mode-control" type="button" onClick={() => setActiveToolKey(null)}>
                {mediaType === "image" ? (
                  <ImageIcon size={15} />
                ) : mediaType === "video" ? (
                  <Clapperboard size={15} />
                ) : (
                  <AudioLines size={15} />
                )}
                <span>Tool</span>
                <strong>{activeTool.name}</strong>
              </button>
              {activeTool.usage.allowModelPicker !== false && (
                <button
                  className="studio-model-control studio-model-trigger"
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={modelPickerOpen}
                  onClick={() => setModelPickerOpen((open) => !open)}
                >
                  <WandSparkles size={15} />
                  <span>
                    <small>Model</small>
                    <strong>{modelVariantLabel(selectedModel, displayParameters)}</strong>
                  </span>
                  <ChevronDown className={modelPickerOpen ? "is-open" : ""} size={14} />
                </button>
              )}
              {!composerConfig.omitPrompt && (
                <label className="studio-select-control studio-style-control">
                  <Palette size={15} />
                  <span>Style</span>
                  <select
                    value={creativeStyle}
                    onChange={(event) => setCreativeStyle(event.target.value)}
                    aria-label="Creative style"
                  >
                    {styleOptions.map((style) => (
                      <option key={style} value={style}>
                        {style}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={13} />
                </label>
              )}
              {parameterEntries.map(([key, schema]) =>
                schema.enum?.length ? (
                  <label className="studio-select-control" key={key} title={readableParam(key)}>
                    <span>{readableParam(key)}</span>
                    <select
                      value={String(parameters[key] ?? schema.enum[0])}
                      onChange={(event) => {
                        const sample = schema.enum?.[0];
                        const value =
                          typeof sample === "number"
                            ? Number(event.target.value)
                            : typeof sample === "boolean"
                              ? event.target.value === "true"
                              : event.target.value;
                        setParameters((current) =>
                          updateModelParameter(key, value, current, selectedModel.parameter_schema),
                        );
                      }}
                      aria-label={readableParam(key)}
                    >
                      {schema.enum.map((value) => (
                        <option key={String(value)} value={String(value)}>
                          {displayParamValue(key, value)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={13} />
                  </label>
                ) : schema.type === "boolean" ? (
                  <button
                    className={`studio-boolean-control ${parameters[key] ? "is-on" : ""}`}
                    key={key}
                    type="button"
                    aria-pressed={Boolean(parameters[key])}
                    onClick={() => setParameters((current) => ({ ...current, [key]: !current[key] }))}
                  >
                    {readableParam(key)} <span>{parameters[key] ? "On" : "Off"}</span>
                  </button>
                ) : null,
              )}
              <button
                className="studio-settings-button"
                type="button"
                aria-label="More settings"
                onClick={() => setAdvancedOpen((open) => !open)}
              >
                <Settings2 size={16} />
              </button>
              <button
                className="studio-generate"
                disabled={generating || uploading || checkingOut}
                onClick={() => void generate()}
                type="button"
              >
                {generating ? <LoaderCircle size={15} /> : "Generate"}
                <span>{quotedCredits} cr</span>
              </button>
            </div>
            {modelPickerOpen && (
              <StudioModelPicker
                models={visibleModelChoices}
                onClose={() => setModelPickerOpen(false)}
                onSearch={setModelSearch}
                onSelect={selectModel}
                search={modelSearch}
                selectedKey={selectedModel.key}
              />
            )}
            <div className="studio-model-note">
              {!composerConfig.omitPrompt && (
                <button
                  className={promptEnhance ? "is-on" : ""}
                  type="button"
                  onClick={() => setPromptEnhance((value) => !value)}
                >
                  <Sparkles size={11} /> Prompt enhance <i />
                </button>
              )}
              <span className="studio-live-quote">
                {modelVariantLabel(selectedModel, displayParameters)} · {quotedCredits} credits
              </span>
              <span className="studio-retention-policy">
                <Clock3 size={11} /> Files expire after 7 days unless kept
              </span>
              <kbd>⌘ Enter</kbd>
            </div>
          </section>
        </section>
      )}

      {notice && (
        <div
          className="fixed top-20 right-5 z-50 flex max-w-sm items-center gap-4 rounded-xl border border-white/10 bg-elevated px-3.5 py-3 text-sm text-foreground shadow-2xl"
          role="status"
        >
          <span>{notice}</span>
          <button
            className="grid size-6 place-items-center rounded-md bg-white/10"
            type="button"
            aria-label="Dismiss notification"
            onClick={() => setNotice(null)}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {checkoutConfirmation && (
        <CreditSuccessDialog confirmation={checkoutConfirmation} onClose={() => setCheckoutConfirmation(null)} />
      )}
      <StudioSupport key={user?.id ?? "guest"} userId={user?.id ?? null} onSignIn={() => openAuth("signin")} />
      {authOpen && (
        <AuthDialog
          key={authMode}
          initialMode={authMode}
          onClose={() => setAuthOpen(false)}
          onCancel={() => {
            setAuthOpen(false);
            setPendingPack(null);
            try {
              sessionStorage.removeItem("timeless.pendingPack");
              sessionStorage.removeItem("timeless.support.handoff");
            } catch {
              // ignore
            }
          }}
          onNotice={setNotice}
        />
      )}
      {newProjectOpen && <NewProjectDialog onClose={() => setNewProjectOpen(false)} onCreate={createProject} />}
    </main>
  );
}
