"use client";

import { useState } from "react";
import Image from "next/image";
import {
  ChevronDown,
  Clapperboard,
  ImageIcon,
  Lightbulb,
  WandSparkles,
} from "lucide-react";
import { showcaseExamples, type ShowcaseExample } from "../../(pages)/studio/data/showcase-examples";
import { modeLabel, type GenerativeMediaType, type StudioTool } from "../../lib/studio/studio-types";
import {
  exploreCopy,
  libraryNotes,
  mediaTypeHeadings,
  showcaseFilters,
  trendingKeys,
  videoRecipeToolKeys,
} from "./copy/tool-library";
import type { StudioNavMode } from "../../lib/studio/studio-routes";

export function ToolLibrary({
  navMode = "studio",
  mediaType,
  tools: categoryTools,
  onMode,
  onOpen,
  onOpenScratch,
  onRecreate,
}: {
  navMode?: StudioNavMode;
  mediaType: GenerativeMediaType;
  tools: StudioTool[];
  onMode: (mode: StudioNavMode) => void;
  onOpen: (tool: StudioTool) => void;
  onOpenScratch?: () => void;
  onRecreate: (example: ShowcaseExample) => void;
}) {
  const copy = mediaTypeHeadings[mediaType];
  const [showcaseFilter, setShowcaseFilter] = useState<string>("All");

  const showcaseRank = (key: string) => {
    const rank = (trendingKeys as readonly string[]).indexOf(key);
    return rank === -1 ? trendingKeys.length : rank;
  };

  const visibleExamples = [...showcaseExamples]
    .sort((first, second) => showcaseRank(first.key) - showcaseRank(second.key))
    .filter(
      (example) =>
        showcaseFilter === "All" ||
        example.category.toLowerCase().includes(showcaseFilter.toLowerCase()),
    );

  const featuredTools = categoryTools.filter((tool) => tool.available).slice(0, 3);

  const toolGrid = (
    <div className="relative z-10 grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
      {categoryTools.map((tool) => {
        const Icon = tool.icon;
        const live = tool.available;
        return (
          <button
            className={[
              "relative grid min-h-24 grid-cols-[3rem_minmax(0,1fr)_1.25rem] items-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition duration-150",
              live
                ? "text-foreground hover:-translate-y-0.5 hover:border-accent/25 hover:bg-accent/10"
                : "text-muted",
            ].join(" ")}
            key={tool.key}
            type="button"
            onClick={() => onOpen(tool)}
          >
            {!live && (
              <span className="absolute top-2.5 right-3 font-mono text-xs font-semibold tracking-widest text-subtle uppercase">
                {libraryNotes.soonBadge}
              </span>
            )}
            <span className="grid size-11 place-items-center rounded-2xl border border-accent/15 bg-accent/15 text-accent">
              <Icon size={20} />
            </span>
            <span className="grid min-w-0 gap-1.5">
              <strong className="flex items-center gap-2 text-sm font-semibold">
                {tool.name}
                {tool.badge && (
                  <em className="rounded-md bg-accent px-1.5 py-0.5 text-xs font-black not-italic tracking-wide text-accent-foreground uppercase">
                    {tool.badge}
                  </em>
                )}
              </strong>
              <small className="truncate text-xs text-subtle">{tool.description}</small>
            </span>
            <ChevronDown className="-rotate-90 text-subtle" size={15} />
          </button>
        );
      })}
    </div>
  );

  if (navMode === "studio") {
    return (
      <section className="relative min-h-[calc(100vh-4rem)] overflow-visible bg-canvas px-2 py-4 pb-24 sm:px-4 sm:py-8 md:px-[max(1rem,calc((100vw-1720px)/2))]">
        <div
          className="pointer-events-none absolute -top-24 left-[10%] size-[28rem] rounded-full bg-accent/15 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute top-0 right-[8%] size-[24rem] rounded-full bg-accent/10 blur-3xl"
          aria-hidden="true"
        />
        <header className="relative z-10 flex min-h-0 flex-col items-start justify-between gap-6 px-2 pb-6 pt-4 md:min-h-36 md:flex-row md:items-end md:px-2.5 md:pb-8 md:pt-1">
          <span className="sr-only">Explore</span>
          <div className="max-w-4xl">
            <span className="mb-2.5 block font-mono text-xs font-semibold tracking-widest text-accent uppercase md:mb-3">
              {exploreCopy.eyebrow}
            </span>
            <h1 className="font-display m-0 max-w-4xl text-4xl leading-none font-normal tracking-tight text-foreground md:text-5xl lg:text-6xl xl:text-7xl">
              {exploreCopy.title}
            </h1>
            <p className="mt-3 max-w-xl text-pretty text-sm leading-relaxed text-muted md:mt-4">
              {exploreCopy.description}
            </p>
          </div>
          <div className="flex w-full items-center gap-4 pb-1 md:w-auto">
            <span className="hidden grid-cols-1 text-right text-xs leading-tight whitespace-nowrap text-subtle md:grid">
              <strong className="text-xl font-semibold text-foreground">{showcaseExamples.length}</strong>
              {exploreCopy.liveRecreations}
            </span>
            <button
              type="button"
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-accent px-6 text-sm font-medium text-accent-foreground transition-colors duration-150 hover:bg-accent-strong md:w-auto"
              onClick={() => (onOpenScratch ? onOpenScratch() : featuredTools[0] && onOpen(featuredTools[0]))}
            >
              <WandSparkles size={16} /> {exploreCopy.createFromScratch}
            </button>
          </div>
        </header>

        <div
          className="sticky top-14 z-20 -mx-2 mb-3 flex gap-1 overflow-x-auto border-y border-white/5 bg-canvas/90 px-3 py-2.5 backdrop-blur-md [scrollbar-width:none] md:top-16 md:mx-0 [&::-webkit-scrollbar]:hidden"
          aria-label="Filter showcase examples"
        >
          {showcaseFilters.map((filter) => {
            const count =
              filter === "All"
                ? showcaseExamples.length
                : showcaseExamples.filter((example) =>
                    example.category.toLowerCase().includes(filter.toLowerCase()),
                  ).length;
            const active = showcaseFilter === filter;
            return (
              <button
                aria-pressed={active}
                className={[
                  "inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full border-0 px-3 text-xs font-medium transition",
                  active
                    ? "bg-foreground text-accent-foreground"
                    : "bg-transparent text-muted hover:bg-white/5 hover:text-foreground",
                ].join(" ")}
                key={filter}
                type="button"
                onClick={() => setShowcaseFilter(filter)}
              >
                {filter}
                <small className="text-xs font-semibold text-subtle">{count}</small>
              </button>
            );
          })}
        </div>

        <section aria-labelledby="studio-showcase-title">
          <h2 className="sr-only" id="studio-showcase-title">
            {exploreCopy.showcaseTitle}
          </h2>
          <div className="grid auto-rows-auto grid-cols-1 gap-2 md:grid-flow-dense md:auto-rows-[minmax(12.5rem,auto)] md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xl:auto-rows-[minmax(12rem,17rem)]">
            {visibleExamples.map((example) => {
              const isVideoRecipe = (videoRecipeToolKeys as readonly string[]).includes(example.toolKey);
              const size = example.size || "standard";
              return (
                <article
                  className={[
                    "group relative min-h-0 overflow-hidden rounded-3xl border border-white/10 bg-surface aspect-[4/3] shadow-2xl md:aspect-auto",
                    size === "wide" ? "md:col-span-2" : "",
                    size === "tall" ? "md:row-span-2" : "",
                  ].join(" ")}
                  key={example.key}
                >
                  <Image
                    unoptimized
                    className="size-full object-cover transition duration-300 group-hover:scale-105"
                    src={example.image}
                    alt={example.alt}
                    width={1536}
                    height={1024}
                    sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw"
                  />
                  <div
                    className="pointer-events-none absolute inset-x-0 top-1/4 bottom-0 bg-gradient-to-t from-canvas/90 via-canvas/20 to-transparent"
                    aria-hidden="true"
                  />
                  {example.badge && (
                    <b
                      className={[
                        "absolute top-3 left-3 z-10 rounded-md px-2 py-1.5 text-xs font-black tracking-wider uppercase leading-none",
                        example.badge.toLowerCase() === "trending"
                          ? "bg-success text-success-foreground"
                          : "bg-accent text-accent-foreground",
                      ].join(" ")}
                    >
                      {example.badge}
                    </b>
                  )}
                  <div className="absolute right-4 bottom-3.5 left-4 z-10 grid grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_auto_auto] items-end gap-x-3 gap-y-1">
                    <span className="col-start-1 font-mono text-xs font-semibold tracking-widest text-white/65 uppercase">
                      {example.category}
                    </span>
                    <h3 className="col-start-1 m-0 truncate text-lg font-semibold tracking-tight text-white">
                      {example.title}
                    </h3>
                    <small className="col-start-1 flex items-center gap-1 text-xs text-white/50">
                      {isVideoRecipe ? <Clapperboard size={12} /> : <ImageIcon size={12} />}
                      {example.model || exploreCopy.defaultModel}
                    </small>
                    <button
                      type="button"
                      className="col-start-2 row-span-3 row-start-1 inline-flex min-h-9 items-center gap-2 self-end rounded-full border border-white/65 bg-foreground/95 px-3 text-xs font-medium text-accent-foreground shadow-lg opacity-100 transition md:translate-y-1.5 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100 md:group-focus-within:translate-y-0 md:group-focus-within:opacity-100"
                      onClick={() => onRecreate(example)}
                      aria-label={`${exploreCopy.recreate} ${example.title}`}
                    >
                      <WandSparkles size={15} /> {exploreCopy.recreate}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <div className="relative z-10 mt-6">
          <div className="mb-4 flex items-end justify-between gap-4 px-1">
            <div className="grid gap-1">
              <strong className="text-sm font-semibold text-foreground">{exploreCopy.allImageTools}</strong>
              <small className="text-xs text-subtle">
                {exploreCopy.allToolsSubtitle(categoryTools.length)}
              </small>
            </div>
            <button
              type="button"
              className="hidden text-xs font-medium text-accent transition-colors hover:text-accent-soft sm:inline"
              onClick={() => onMode("image")}
            >
              {exploreCopy.switcher.image} →
            </button>
          </div>
          {toolGrid}
          <p className="mt-5 mb-0 flex items-center justify-center gap-1.5 text-xs text-subtle">
            <Lightbulb size={13} /> {libraryNotes.image}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-canvas px-4 py-12 pb-20 md:px-[max(1.75rem,calc((100vw-1180px)/2))] md:py-16">
      <div
        className="pointer-events-none absolute -top-40 left-1/2 size-[28rem] -translate-x-1/2 rounded-full bg-accent/15 blur-3xl"
        aria-hidden="true"
      />
      <div className="relative z-10 mx-auto max-w-3xl text-center">
        <span className="font-mono text-xs font-semibold tracking-widest text-accent uppercase">
          {modeLabel(mediaType)}
        </span>
        <h1 className="font-display my-3 text-4xl leading-none font-normal tracking-tight text-foreground md:text-5xl lg:text-6xl">
          {copy[0]}
        </h1>
        <p className="m-0 text-pretty text-sm leading-relaxed text-muted">{copy[1]}</p>
      </div>
      <div className="relative z-10 mt-10">{toolGrid}</div>
      <p className="relative z-10 mt-5 flex items-center justify-center gap-1.5 text-xs text-subtle">
        <Lightbulb size={13} /> {libraryNotes.media}
      </p>
    </section>
  );
}
