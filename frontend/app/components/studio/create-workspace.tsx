"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  ArrowLeft,
  AudioLines,
  Bookmark,
  ChevronDown,
  Clapperboard,
  Clock3,
  Download,
  ImageIcon,
  LoaderCircle,
  Palette,
  Plus,
  RefreshCw,
  Settings2,
  Sparkles,
  SquarePlus,
  WandSparkles,
  X,
} from "lucide-react";
import { shotTotalDuration } from "../../lib/studio/composer-quote";
import type { EffectiveComposerConfig } from "../../lib/studio/effective-composer-config";
import type { ReferenceConfig } from "../../lib/studio/references";
import {
  displayParamValue,
  isActiveGeneration,
  modeLabel,
  modelVariantLabel,
  readableParam,
  retentionLabel,
  type GenerativeMediaType,
  type StudioGeneration,
  type StudioModel,
  type StudioOutputAsset,
  type StudioTool,
} from "../../lib/studio/studio-types";
import { updateModelParameter } from "../../lib/studio/video-settings";
import { createCopy } from "./copy/create";
import { ReferencePanel, type UploadedReference } from "./reference-panel";
import { StudioModelPicker } from "./studio-model-picker";

type Shot = { prompt: string; duration: number };

type ParamEntry = readonly [
  string,
  { type?: string; enum?: Array<string | number | boolean> },
];

const chipClass =
  "inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 text-left text-xs text-muted transition-colors hover:border-white/15 hover:bg-white/10 hover:text-foreground";

const selectChipClass = `${chipClass} relative pr-7`;

const actionTileClass =
  "relative flex h-20 shrink-0 flex-col justify-between overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-elevated-hover to-elevated p-2 text-left shadow-[0_1px_2px_rgba(0,0,0,0.32),0_3px_4px_rgba(0,0,0,0.32),0_7px_5px_rgba(0,0,0,0.12)] transition-[filter] hover:brightness-110";

function mediaAspectClass(mediaType: GenerativeMediaType) {
  if (mediaType === "audio") return "aspect-[2/1]";
  if (mediaType === "video") return "aspect-video";
  return "aspect-square";
}

export function CreateWorkspace({
  activeTool,
  mediaType,
  selectedModel,
  prompt,
  negativePrompt,
  promptEnhance,
  creativeStyle,
  advancedOpen,
  modelPickerOpen,
  modelSearch,
  references,
  shots,
  parameters,
  generating,
  uploading,
  checkingOut,
  quotedCredits,
  displayParameters,
  parameterEntries,
  styleOptions,
  composerConfig,
  referencePanelConfig,
  visibleModelChoices,
  generations,
  outputUrls,
  outputAssets,
  models,
  workspaceLoading,
  retainingAssetId,
  promptTextareaRef,
  onBack,
  onPrompt,
  onNegativePrompt,
  onPromptEnhance,
  onCreativeStyle,
  onAdvancedOpen,
  onModelPickerOpen,
  onModelSearch,
  onSelectModel,
  onReferences,
  onShots,
  onParameters,
  onGenerate,
  onUploadReference,
  onBusy,
  onError,
  onRefreshGeneration,
  onRetainOutput,
  onUseAsReference,
  onReusePrompt,
  onNewThread,
}: {
  activeTool: StudioTool;
  mediaType: GenerativeMediaType;
  selectedModel: StudioModel;
  prompt: string;
  negativePrompt: string;
  promptEnhance: boolean;
  creativeStyle: string;
  advancedOpen: boolean;
  modelPickerOpen: boolean;
  modelSearch: string;
  references: UploadedReference[];
  shots: Shot[];
  parameters: Record<string, string | number | boolean>;
  generating: boolean;
  uploading: boolean;
  checkingOut: boolean;
  quotedCredits: number;
  displayParameters: Record<string, string | number | boolean>;
  parameterEntries: ParamEntry[];
  styleOptions: string[];
  composerConfig: EffectiveComposerConfig;
  referencePanelConfig: ReferenceConfig;
  visibleModelChoices: StudioModel[];
  generations: StudioGeneration[];
  outputUrls: Record<string, string>;
  outputAssets: Record<string, StudioOutputAsset>;
  models: StudioModel[];
  workspaceLoading: boolean;
  retainingAssetId: string | null;
  promptTextareaRef: RefObject<HTMLTextAreaElement | null>;
  onBack: () => void;
  onPrompt: (value: string) => void;
  onNegativePrompt: (value: string) => void;
  onPromptEnhance: (value: boolean) => void;
  onCreativeStyle: (value: string) => void;
  onAdvancedOpen: (value: boolean) => void;
  onModelPickerOpen: (value: boolean) => void;
  onModelSearch: (value: string) => void;
  onSelectModel: (key: string) => void;
  onReferences: (value: UploadedReference[]) => void;
  onShots: (value: Shot[]) => void;
  onParameters: (
    value:
      | Record<string, string | number | boolean>
      | ((current: Record<string, string | number | boolean>) => Record<string, string | number | boolean>),
  ) => void;
  onGenerate: () => void;
  onUploadReference: (file: File) => Promise<string>;
  onBusy: (value: boolean) => void;
  onError: (message: string) => void;
  onRefreshGeneration: (id: string) => void;
  onRetainOutput: (asset: StudioOutputAsset) => void;
  onUseAsReference: (generationId: string) => void;
  onReusePrompt: (prompt: string) => void;
  onNewThread: () => void;
}) {
  const ToolIcon = activeTool.icon;
  const MediaIcon =
    mediaType === "image" ? ImageIcon : mediaType === "video" ? Clapperboard : AudioLines;
  const [referencesOpen, setReferencesOpen] = useState(false);
  const [lookOpen, setLookOpen] = useState(false);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const prevTurnCount = useRef(0);

  const hasReferenceSlots = Boolean(referencePanelConfig.referenceSlots?.length);
  const thread = [...generations].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const aspectLabel = String(
    displayParameters.aspect_ratio ?? displayParameters.ratio ?? "",
  );
  const lookSummary = createCopy.lookSummary(creativeStyle, aspectLabel);
  const referencePreview = references[0]?.preview;

  useEffect(() => {
    setReferencesOpen(references.length > 0);
  }, [references.length]);

  useEffect(() => {
    if (!advancedOpen) setLookOpen(false);
  }, [advancedOpen]);

  useEffect(() => {
    if (thread.length > prevTurnCount.current) {
      threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
    prevTurnCount.current = thread.length;
  }, [thread.length]);

  function openReferences() {
    if (!hasReferenceSlots) {
      onError(createCopy.cannotUseAsReference);
      return;
    }
    setLookOpen(false);
    setReferencesOpen((open) => !open);
  }

  function openLook() {
    setReferencesOpen(false);
    const next = !lookOpen;
    setLookOpen(next);
    onAdvancedOpen(next);
  }

  const parameterChips = parameterEntries.map(([key, schema]) =>
    schema.enum?.length ? (
      <label className={selectChipClass} key={key} title={readableParam(key)}>
        <span className="text-[10px] text-subtle">{readableParam(key)}</span>
        <select
          className="absolute inset-0 cursor-pointer appearance-none opacity-0"
          value={String(parameters[key] ?? schema.enum[0])}
          onChange={(event) => {
            const sample = schema.enum?.[0];
            const value =
              typeof sample === "number"
                ? Number(event.target.value)
                : typeof sample === "boolean"
                  ? event.target.value === "true"
                  : event.target.value;
            onParameters((current) =>
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
        <strong className="pointer-events-none text-xs font-semibold text-foreground">
          {displayParamValue(key, parameters[key] ?? schema.enum[0])}
        </strong>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2" size={12} />
      </label>
    ) : schema.type === "boolean" ? (
      <button
        className={`${chipClass} ${parameters[key] ? "border-accent/25 bg-accent/10 text-accent" : ""}`}
        key={key}
        type="button"
        aria-pressed={Boolean(parameters[key])}
        onClick={() => onParameters((current) => ({ ...current, [key]: !current[key] }))}
      >
        {readableParam(key)} <span>{parameters[key] ? createCopy.on : createCopy.off}</span>
      </button>
    ) : null,
  );

  return (
    <section className="relative flex h-[calc(100dvh-4rem)] flex-col overflow-hidden bg-canvas max-md:h-[calc(100dvh-7rem)]">
      <div
        className="pointer-events-none absolute -top-24 left-[10%] size-[28rem] rounded-full bg-accent/15 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute top-1/3 right-[8%] size-[24rem] rounded-full bg-accent/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative z-20 grid min-h-12 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-white/10 bg-canvas/90 px-4 backdrop-blur-md sm:px-6">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 justify-self-start text-sm text-muted transition-colors hover:text-foreground"
          onClick={onBack}
        >
          <ArrowLeft size={15} /> {createCopy.allTools(modeLabel(mediaType))}
        </button>
        <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
          <ToolIcon className="text-accent" size={14} /> {activeTool.name}
        </span>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 justify-self-end text-sm text-muted transition-colors hover:text-foreground"
          aria-label={createCopy.newThreadAria}
          onClick={() => {
            setReferencesOpen(false);
            setLookOpen(false);
            onNewThread();
          }}
        >
          <SquarePlus size={15} /> {createCopy.newThread}
        </button>
      </div>

      <div
        ref={threadRef}
        className="relative z-10 min-h-0 flex-1 overflow-y-auto"
        id="studio-generations"
        aria-label={createCopy.threadAria}
      >
        {workspaceLoading && !thread.length ? (
          <div className="flex min-h-[40vh] items-center justify-center gap-3 text-sm text-muted">
            <LoaderCircle className="animate-spin" size={24} /> {createCopy.loading}
          </div>
        ) : thread.length ? (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6">
            {thread.map((generation) => {
              const model = models.find((item) => item.key === generation.model_key);
              const outputUrl = outputUrls[generation.id];
              const outputAsset = outputAssets[generation.id];
              const retention = retentionLabel(outputAsset);
              const expired = retention === "Expired";
              const isActive = isActiveGeneration(generation.status);
              const canReuseRef =
                Boolean(outputUrl && outputAsset && !expired && hasReferenceSlots) &&
                generation.status === "succeeded";

              return (
                <article className="grid gap-3" key={generation.id} data-turn={generation.id}>
                  <button
                    type="button"
                    className="ml-auto max-w-[min(100%,28rem)] rounded-2xl rounded-br-md border border-accent/20 bg-accent/10 px-4 py-3 text-left transition-colors hover:border-accent/35 hover:bg-accent/15"
                    aria-label={createCopy.reusePromptAria}
                    onClick={() => onReusePrompt(generation.prompt)}
                  >
                    <p className="m-0 text-sm leading-relaxed text-foreground">{generation.prompt}</p>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-subtle">
                      <span>{model?.name || generation.model_key}</span>
                      <span>{new Date(generation.created_at).toLocaleString()}</span>
                    </div>
                  </button>

                  <div className="mr-auto w-full max-w-[min(100%,28rem)] overflow-hidden rounded-2xl rounded-bl-md border border-white/10 bg-surface">
                    <div className={`relative ${mediaAspectClass(generation.media_type)} bg-elevated`}>
                      {outputUrl && generation.media_type === "image" ? (
                        <img className="size-full object-cover" src={outputUrl} alt={generation.prompt} />
                      ) : outputUrl && generation.media_type === "video" ? (
                        <video className="size-full object-cover" src={outputUrl} controls preload="metadata" />
                      ) : outputUrl && generation.media_type === "audio" ? (
                        <div className="flex size-full flex-col items-center justify-center gap-5 bg-gradient-to-b from-accent/15 to-canvas text-accent">
                          <AudioLines size={34} />
                          <audio className="h-9 w-[84%] max-w-sm" src={outputUrl} controls preload="metadata" />
                        </div>
                      ) : (
                        <div
                          className={`flex size-full flex-col items-center justify-center gap-3 text-muted ${
                            isActive ? "text-accent" : ""
                          }`}
                        >
                          {isActive ? (
                            <LoaderCircle className="animate-spin" size={24} />
                          ) : generation.status === "failed" || expired ? (
                            <X size={24} />
                          ) : (
                            <Sparkles size={24} />
                          )}
                          <span className="text-xs tracking-wide uppercase">
                            {isActive
                              ? createCopy.creating(generation.progress)
                              : expired
                                ? createCopy.fileExpired
                                : generation.status}
                          </span>
                        </div>
                      )}
                      <span
                        className={`absolute top-3 right-3 rounded-md bg-canvas/80 px-2 py-0.5 font-mono text-xs tracking-wider uppercase backdrop-blur-sm ${
                          expired || generation.status === "failed"
                            ? "text-accent-soft"
                            : generation.status === "succeeded"
                              ? "text-success"
                              : "text-muted"
                        }`}
                      >
                        {expired
                          ? createCopy.expired
                          : generation.status === "succeeded"
                            ? createCopy.succeeded
                            : generation.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 text-xs text-subtle">
                      <span>{createCopy.creditsCharged(generation.credits_charged)}</span>
                      {retention && (
                        <span
                          className={`inline-flex items-center gap-1 ${
                            outputAsset?.retained_at
                              ? "text-success"
                              : expired
                                ? "text-accent-soft"
                                : "text-subtle"
                          }`}
                        >
                          <Clock3 size={12} /> {retention}
                        </span>
                      )}
                      {isActive && (
                        <button
                          className="inline-flex items-center gap-1 text-muted transition-colors hover:text-foreground"
                          onClick={() => onRefreshGeneration(generation.id)}
                          type="button"
                        >
                          <RefreshCw size={12} /> {createCopy.refresh}
                        </button>
                      )}
                      {outputUrl && (
                        <a
                          className="inline-flex items-center gap-1 text-muted transition-colors hover:text-foreground"
                          href={outputUrl}
                          download
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Download size={12} /> {createCopy.export}
                        </a>
                      )}
                      {outputUrl && outputAsset && !outputAsset.retained_at && (
                        <button
                          className="inline-flex items-center gap-1 text-muted transition-colors hover:text-foreground disabled:opacity-40"
                          disabled={retainingAssetId === outputAsset.id}
                          onClick={() => onRetainOutput(outputAsset)}
                          type="button"
                        >
                          {retainingAssetId === outputAsset.id ? (
                            <LoaderCircle className="animate-spin" size={12} />
                          ) : (
                            <Bookmark size={12} />
                          )}{" "}
                          {createCopy.keep}
                        </button>
                      )}
                      {canReuseRef && (
                        <button
                          className="inline-flex items-center gap-1 text-accent transition-colors hover:text-accent-soft"
                          onClick={() => onUseAsReference(generation.id)}
                          type="button"
                        >
                          <Plus size={12} /> {createCopy.useAsReference}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
            <div ref={threadEndRef} />
          </div>
        ) : (
          <div className="flex min-h-full flex-col items-center justify-center px-6 py-12 text-center">
            <div
              className="relative mb-6 aspect-[4/3] w-full max-w-sm border border-white/10"
              aria-hidden="true"
            >
              <i className="absolute top-0 left-0 size-5 border-t border-l border-accent/50" />
              <i className="absolute top-0 right-0 size-5 border-t border-r border-accent/50" />
              <i className="absolute bottom-0 left-0 size-5 border-b border-l border-accent/50" />
              <i className="absolute right-0 bottom-0 size-5 border-r border-b border-accent/50" />
            </div>
            <p className="mb-3 font-mono text-xs font-semibold tracking-widest text-accent uppercase">
              {modeLabel(mediaType)}
            </p>
            <h2 className="font-display m-0 max-w-3xl text-4xl leading-none font-normal tracking-tight text-foreground sm:text-5xl md:text-6xl">
              {activeTool.name}
            </h2>
            <span className="mt-4 max-w-md text-pretty text-sm leading-relaxed text-muted">
              {activeTool.usage.howTo || activeTool.description}
            </span>
            {activeTool.usage.steps?.length ? (
              <ol className="mt-4 list-decimal space-y-1 pl-5 text-left text-sm text-muted">
                {activeTool.usage.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            ) : null}
            <button
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-4 py-2 text-sm text-accent"
              type="button"
              onClick={() => onModelPickerOpen(true)}
            >
              {selectedModel.name} <Sparkles size={12} />
            </button>
          </div>
        )}
      </div>

      <section
        className="relative z-20 mx-auto w-full max-w-5xl shrink-0 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:px-4"
        aria-label={createCopy.composerAria}
      >
        <div className="rounded-3xl border border-white/10 bg-elevated/95 p-2 shadow-2xl backdrop-blur-xl sm:p-3">
          {(lookOpen || advancedOpen) && (
            <div className="mb-2 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              {!composerConfig.omitPrompt && (
                <label className={`${selectChipClass} w-full max-w-xs`}>
                  <Palette size={14} />
                  <span className="text-[10px] text-subtle">{createCopy.style}</span>
                  <select
                    className="absolute inset-0 cursor-pointer appearance-none opacity-0"
                    value={creativeStyle}
                    onChange={(event) => onCreativeStyle(event.target.value)}
                    aria-label={createCopy.styleAria}
                  >
                    {styleOptions.map((style) => (
                      <option key={style} value={style}>
                        {style}
                      </option>
                    ))}
                  </select>
                  <strong className="pointer-events-none text-xs font-semibold text-foreground">
                    {creativeStyle}
                  </strong>
                  <ChevronDown
                    className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2"
                    size={12}
                  />
                </label>
              )}
              {selectedModel.provider_config.allowNegativePrompt !== false && (
                <label className="grid min-w-0 flex-1 gap-1.5 font-mono text-xs tracking-wider text-subtle uppercase">
                  {createCopy.negativePrompt}
                  <input
                    className="h-9 rounded-lg border border-white/10 bg-canvas px-3 font-sans text-sm tracking-normal text-foreground outline-none placeholder:text-subtle focus:border-accent/40"
                    value={negativePrompt}
                    onChange={(event) => onNegativePrompt(event.target.value)}
                    placeholder={createCopy.negativePlaceholder}
                  />
                </label>
              )}
              <p className="m-0 text-xs text-subtle sm:col-span-2">{createCopy.privacyNote}</p>
            </div>
          )}

          {composerConfig.supportsShots && lookOpen && (
            <section
              className="mb-2 max-h-[28vh] overflow-auto rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm"
              aria-label={createCopy.shotSequenceAria}
            >
              <label className="flex items-center gap-2 text-foreground">
                <input
                  type="checkbox"
                  checked={shots.length > 0}
                  onChange={(e) =>
                    onShots(e.target.checked ? [{ prompt: "", duration: 3 }, { prompt: "", duration: 3 }] : [])
                  }
                />{" "}
                {createCopy.multiShot}
              </label>
              {shots.length > 0 && (
                <>
                  <p className="mt-2 text-xs text-subtle">{createCopy.multiShotHint}</p>
                  {shots.map((shot, i) => (
                    <div className="mt-2 flex items-end gap-2" key={i}>
                      <label className="grid min-w-0 flex-1 gap-1 text-xs text-muted">
                        {createCopy.shotLabel(i + 1)}
                        <textarea
                          className="min-h-16 w-full rounded-lg border border-white/10 bg-canvas p-2 text-sm text-foreground outline-none focus:border-accent/40"
                          aria-label={createCopy.shotPromptAria(i + 1)}
                          maxLength={500}
                          value={shot.prompt}
                          onChange={(e) =>
                            onShots(shots.map((s, j) => (j === i ? { ...s, prompt: e.target.value } : s)))
                          }
                        />
                      </label>
                      <label className="grid gap-1 text-xs text-muted">
                        {createCopy.seconds}
                        <input
                          className="w-16 rounded-lg border border-white/10 bg-canvas p-1.5 text-sm text-foreground outline-none focus:border-accent/40"
                          aria-label={createCopy.shotSecondsAria(i + 1)}
                          type="number"
                          min={1}
                          max={12}
                          value={shot.duration}
                          onChange={(e) =>
                            onShots(
                              shots.map((s, j) =>
                                j === i ? { ...s, duration: Number(e.target.value) } : s,
                              ),
                            )
                          }
                        />
                      </label>
                      <button
                        type="button"
                        className="rounded-lg border border-white/10 bg-white/5 p-2 text-accent disabled:opacity-40"
                        disabled={shots.length <= 2}
                        aria-label={createCopy.removeShotAria(i + 1)}
                        onClick={() => onShots(shots.filter((_, j) => j !== i))}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      type="button"
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-accent disabled:opacity-40"
                      disabled={shots.length >= 5}
                      onClick={() => onShots([...shots, { prompt: "", duration: 3 }])}
                    >
                      {createCopy.addShot}
                    </button>
                    <strong className="text-xs font-medium text-muted">
                      {createCopy.totalSeconds(shotTotalDuration(shots))}
                    </strong>
                  </div>
                </>
              )}
            </section>
          )}

          {(referencesOpen || references.length > 0) && hasReferenceSlots && (
            <div className="mb-2">
              <ReferencePanel
                key={selectedModel.key}
                config={referencePanelConfig}
                value={references}
                onChange={onReferences}
                onUpload={onUploadReference}
                onBusy={onBusy}
                onError={onError}
                disabled={generating}
              />
            </div>
          )}

          <div className="flex flex-col gap-2 md:flex-row md:items-end md:gap-2">
            <div className="min-w-0 flex-1 rounded-2xl bg-white/[0.04] p-3">
              {!composerConfig.omitPrompt && (
                <textarea
                  ref={promptTextareaRef}
                  className="w-full resize-none bg-transparent px-1 py-1 text-sm leading-relaxed text-foreground outline-none placeholder:text-subtle"
                  aria-label={createCopy.promptAria}
                  onChange={(event) => onPrompt(event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") onGenerate();
                  }}
                  placeholder={createCopy.promptPlaceholder(mediaType)}
                  value={prompt}
                  rows={2}
                />
              )}

              <div className="mt-2 flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {hasReferenceSlots && (
                  <button
                    className={`${chipClass} md:hidden ${referencesOpen ? "border-accent/25 bg-accent/10 text-accent" : ""}`}
                    type="button"
                    aria-label={createCopy.referenceTileAria}
                    onClick={openReferences}
                  >
                    <Plus size={14} />
                    {references.length ? String(references.length) : createCopy.addReference}
                  </button>
                )}

                <button className={`${chipClass} hidden md:inline-flex`} type="button" onClick={onBack}>
                  <MediaIcon size={14} />
                  <strong className="text-xs font-semibold text-foreground">{activeTool.name}</strong>
                </button>

                {activeTool.usage.allowModelPicker !== false && (
                  <button
                    className={chipClass}
                    data-studio-model-trigger
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={modelPickerOpen}
                    onClick={() => onModelPickerOpen(!modelPickerOpen)}
                  >
                    <WandSparkles className="text-accent" size={14} />
                    <strong className="text-xs font-semibold text-foreground">
                      {modelVariantLabel(selectedModel, displayParameters)}
                    </strong>
                    <ChevronDown className={modelPickerOpen ? "rotate-180" : ""} size={12} />
                  </button>
                )}

                {!composerConfig.omitPrompt && (
                  <label className={`${selectChipClass} md:hidden`}>
                    <Palette size={14} />
                    <select
                      className="absolute inset-0 cursor-pointer appearance-none opacity-0"
                      value={creativeStyle}
                      onChange={(event) => onCreativeStyle(event.target.value)}
                      aria-label={createCopy.styleAria}
                    >
                      {styleOptions.map((style) => (
                        <option key={style} value={style}>
                          {style}
                        </option>
                      ))}
                    </select>
                    <strong className="pointer-events-none text-xs font-semibold text-foreground">
                      {creativeStyle}
                    </strong>
                    <ChevronDown
                      className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2"
                      size={12}
                    />
                  </label>
                )}

                {parameterChips}

                <button
                  className={`inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-muted transition-colors hover:bg-white/10 hover:text-foreground md:hidden ${
                    lookOpen || advancedOpen ? "border-accent/25 text-accent" : ""
                  }`}
                  type="button"
                  aria-label={createCopy.moreSettings}
                  onClick={openLook}
                >
                  <Settings2 size={15} />
                </button>

                <button
                  className="ml-auto inline-flex min-h-8 shrink-0 items-center gap-2 rounded-xl bg-accent px-4 text-xs font-semibold tracking-wide text-accent-foreground uppercase transition-[filter] hover:brightness-110 disabled:opacity-44 md:hidden"
                  disabled={generating || uploading || checkingOut}
                  onClick={onGenerate}
                  type="button"
                >
                  {generating || uploading || checkingOut ? (
                    <LoaderCircle className="animate-spin" size={14} />
                  ) : (
                    createCopy.generate
                  )}
                  <span className="border-l border-accent-foreground/25 pl-2 font-medium normal-case">
                    {createCopy.creditsShort(quotedCredits)}
                  </span>
                </button>
              </div>
            </div>

            <div className="hidden shrink-0 items-stretch gap-1.5 md:flex">
              {hasReferenceSlots && (
                <button
                  type="button"
                  className={`${actionTileClass} w-20 ${referencesOpen ? "ring-1 ring-accent/40" : ""}`}
                  aria-label={createCopy.referenceTileAria}
                  onClick={openReferences}
                >
                  <span className="inline-flex size-5 items-center justify-center rounded-full border border-white/20 bg-white/5 text-foreground">
                    {referencePreview ? (
                      <img
                        src={referencePreview}
                        alt=""
                        className="size-5 rounded-full object-cover"
                      />
                    ) : (
                      <Plus size={12} />
                    )}
                  </span>
                  <span className="font-mono text-[11px] font-bold tracking-wide text-foreground uppercase">
                    {createCopy.referenceTile}
                  </span>
                </button>
              )}

              <button
                type="button"
                className={`${actionTileClass} w-28 ${lookOpen ? "ring-1 ring-accent/40" : ""}`}
                aria-label={createCopy.lookTileAria}
                onClick={openLook}
              >
                <span className="self-end text-muted">
                  <Palette size={18} />
                </span>
                <span className="grid gap-0.5">
                  <span className="text-[11px] font-semibold text-foreground">{createCopy.lookTile}</span>
                  <span className="truncate text-[8px] leading-tight text-subtle">
                    {lookSummary || createCopy.lookDefault}
                  </span>
                </span>
              </button>

              <button
                type="button"
                className="relative flex h-20 w-28 min-w-28 flex-col items-center justify-center overflow-hidden rounded-xl bg-accent px-4 pt-3 pb-3 text-accent-foreground shadow-[0_1px_2px_rgba(0,0,0,0.49),0_3px_4px_rgba(0,0,0,0.43),0_7px_5px_rgba(0,0,0,0.25)] transition-[filter] hover:brightness-110 disabled:opacity-44"
                disabled={generating || uploading || checkingOut}
                onClick={onGenerate}
              >
                <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
                  <span className="absolute top-8 left-6 size-24 rotate-[100deg] rounded-full bg-accent-soft/50 blur-2xl" />
                </span>
                <span className="relative z-10 flex flex-col items-center gap-0.5">
                  <span className="text-xs font-bold tracking-wide uppercase">
                    {generating || uploading || checkingOut ? (
                      <LoaderCircle className="animate-spin" size={16} />
                    ) : (
                      createCopy.generate
                    )}
                  </span>
                  <span className="inline-flex items-center gap-0.5 text-xs font-medium text-accent-foreground/90">
                    <Sparkles size={11} />
                    {createCopy.creditsShort(quotedCredits)}
                  </span>
                </span>
              </button>
            </div>
          </div>

          {modelPickerOpen && (
            <StudioModelPicker
              models={visibleModelChoices}
              onClose={() => onModelPickerOpen(false)}
              onSearch={onModelSearch}
              onSelect={onSelectModel}
              search={modelSearch}
              selectedKey={selectedModel.key}
            />
          )}

          <div className="mt-2 hidden items-center gap-2 px-1 text-xs text-subtle sm:flex">
            {!composerConfig.omitPrompt && (
              <button
                className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors ${
                  promptEnhance ? "bg-accent/15 text-accent" : "bg-white/5 text-subtle"
                }`}
                type="button"
                onClick={() => onPromptEnhance(!promptEnhance)}
              >
                <Sparkles size={11} /> {createCopy.promptEnhance}
                <span
                  className={`relative inline-block h-2 w-3.5 rounded-full p-px ${
                    promptEnhance ? "bg-accent/40" : "bg-elevated-hover"
                  }`}
                >
                  <span
                    className={`block size-1.5 rounded-full bg-muted transition-transform ${
                      promptEnhance ? "translate-x-1.5 bg-accent" : ""
                    }`}
                  />
                </span>
              </button>
            )}
            <span className="text-subtle">
              {createCopy.liveQuote(modelVariantLabel(selectedModel, displayParameters), quotedCredits)}
            </span>
            <span className="inline-flex items-center gap-1 text-subtle">
              <Clock3 size={11} /> {createCopy.retentionPolicy}
            </span>
            <kbd className="ml-auto rounded border border-white/10 px-1.5 py-0.5 font-mono text-xs text-subtle">
              {createCopy.shortcut}
            </kbd>
          </div>
        </div>
      </section>
    </section>
  );
}
