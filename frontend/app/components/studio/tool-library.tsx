"use client";

import { useState } from "react";
import Image from "next/image";
import {
  AudioLines,
  ChevronDown,
  Clapperboard,
  ImageIcon,
  Lightbulb,
  WandSparkles,
} from "lucide-react";
import { showcaseExamples, type ShowcaseExample } from "../../(pages)/studio/data/showcase-examples";
import { modeLabel, type GenerativeMediaType, type MediaType, type StudioTool } from "../../lib/studio/studio-types";

export function ToolLibrary({
  mediaType,
  tools: categoryTools,
  onMode,
  onOpen,
  onRecreate,
}: {
  mediaType: GenerativeMediaType;
  tools: StudioTool[];
  onMode: (mode: MediaType) => void;
  onOpen: (tool: StudioTool) => void;
  onRecreate: (example: ShowcaseExample) => void;
}) {
  const copy = {
    image: ["What should we create?", "Generate, transform, and finish campaign-ready imagery."],
    video: ["Bring an idea to life", "Create, animate, direct, and finish cinematic video."],
    audio: ["Make it heard", "Voice, music, dialogue, and clean sound in one studio."],
  }[mediaType];
  const [showcaseFilter, setShowcaseFilter] = useState("All");
  const showcaseFilters = [
    "All",
    "Viral",
    "Camera",
    "VFX",
    "Fashion",
    "Product",
    "Cinematic",
    "Editorial",
    "Surreal",
    "Character",
    "Fantasy",
  ];
  const trendingKeys = [
    "wind-sculpt",
    "reality-door",
    "chrome-impact",
    "glass-bullet-time",
    "paparazzi-burst",
    "fabric-freeze",
  ];
  const showcaseRank = (key: string) => {
    const rank = trendingKeys.indexOf(key);
    return rank === -1 ? trendingKeys.length : rank;
  };
  const visibleExamples = [...showcaseExamples]
    .sort((first, second) => showcaseRank(first.key) - showcaseRank(second.key))
    .filter((example) => showcaseFilter === "All" || example.category.toLowerCase().includes(showcaseFilter.toLowerCase()));
  const featuredTools = categoryTools.filter((tool) => tool.available).slice(0, 3);
  const toolGrid = (
    <div className="studio-tool-grid">
      {categoryTools.map((tool) => {
        const Icon = tool.icon;
        return (
          <button className={tool.available ? "is-live" : "is-soon"} key={tool.key} type="button" onClick={() => onOpen(tool)}>
            <span className="studio-tool-icon">
              <Icon size={20} />
            </span>
            <span>
              <strong>
                {tool.name}
                {tool.badge && <em>{tool.badge}</em>}
              </strong>
              <small>{tool.description}</small>
            </span>
            <ChevronDown className="studio-tool-arrow" size={15} />
          </button>
        );
      })}
    </div>
  );

  if (mediaType === "image") {
    return (
      <section className="studio-tool-library is-image studio-explore">
        <header className="studio-explore-header">
          <span className="sr-only">Explore</span>
          <div className="studio-explore-title">
            <span>TRENDING RECREATIONS</span>
            <h1>Steal the shot. Make it yours.</h1>
            <p>Start from a finished look, then change the subject, product, world, or motion.</p>
          </div>
          <div className="studio-explore-actions">
            <span>
              <strong>{showcaseExamples.length}</strong> live recreations
            </span>
            <button type="button" onClick={() => featuredTools[0] && onOpen(featuredTools[0])}>
              <WandSparkles size={16} /> Create from scratch
            </button>
          </div>
        </header>
        <div className="studio-showcase-filters" aria-label="Filter showcase examples">
          {showcaseFilters.map((filter) => {
            const count =
              filter === "All"
                ? showcaseExamples.length
                : showcaseExamples.filter((example) => example.category.toLowerCase().includes(filter.toLowerCase())).length;
            return (
              <button
                aria-pressed={showcaseFilter === filter}
                className={showcaseFilter === filter ? "is-active" : ""}
                key={filter}
                type="button"
                onClick={() => setShowcaseFilter(filter)}
              >
                {filter}
                <small>{count}</small>
              </button>
            );
          })}
        </div>
        <section className="studio-showcase" aria-labelledby="studio-showcase-title">
          <h2 className="sr-only" id="studio-showcase-title">
            Trending creations to recreate
          </h2>
          <div className="studio-showcase-grid">
            {visibleExamples.map((example) => {
              const isVideoRecipe = ["camera-motion", "motion-presets", "video-effects", "image-to-video"].includes(example.toolKey);
              return (
                <article className={`studio-showcase-card is-${example.size || "standard"}`} key={example.key}>
                  <Image
                    unoptimized
                    src={example.image}
                    alt={example.alt}
                    width={1536}
                    height={1024}
                    sizes="(max-width: 780px) 100vw, (max-width: 1120px) 50vw, 25vw"
                  />
                  {example.badge && <b className={`studio-showcase-badge is-${example.badge.toLowerCase()}`}>{example.badge}</b>}
                  <div className="studio-showcase-overlay">
                    <span>{example.category}</span>
                    <h3>{example.title}</h3>
                    <small>
                      {isVideoRecipe ? <Clapperboard size={12} /> : <ImageIcon size={12} />}
                      {example.model || "Timeless Studio"}
                    </small>
                    <button type="button" onClick={() => onRecreate(example)} aria-label={`Recreate ${example.title}`}>
                      <WandSparkles size={15} /> Recreate
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
        <details className="studio-all-tools">
          <summary>
            <span>
              <strong>All image tools</strong>
              <small>Explore {categoryTools.length} creation, editing, and finishing workflows</small>
            </span>
            <ChevronDown size={17} />
          </summary>
          {toolGrid}
          <p className="studio-library-note">
            <Lightbulb size={13} /> Live tools generate now. Upcoming tools show what is coming next.
          </p>
        </details>
      </section>
    );
  }

  return (
    <section className={`studio-tool-library is-${mediaType}`}>
      <div className="studio-library-orb" aria-hidden="true" />
      <div className="studio-library-heading">
        <span>{modeLabel(mediaType)}</span>
        <h1>{copy[0]}</h1>
        <p>{copy[1]}</p>
      </div>
      <div className="studio-library-switcher">
        <button onClick={() => onMode("image")} type="button">
          <ImageIcon size={15} /> Image
        </button>
        <button className={mediaType === "video" ? "is-active" : ""} onClick={() => onMode("video")} type="button">
          <Clapperboard size={15} /> Video
        </button>
        <button className={mediaType === "audio" ? "is-active" : ""} onClick={() => onMode("audio")} type="button">
          <AudioLines size={15} /> Sound
        </button>
      </div>
      {toolGrid}
      <p className="studio-library-note">
        <Lightbulb size={13} /> Live tools generate now. Upcoming tools are visible so the studio roadmap stays clear.
      </p>
    </section>
  );
}
