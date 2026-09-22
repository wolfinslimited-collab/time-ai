"use client";

import { Sparkles, X } from "lucide-react";
import type { CatalogModel } from "../../lib/studio/model-catalog";
import { modeLabel, type MediaType, type StudioTool } from "../../lib/studio/studio-types";

export function StudioMegaMenu({
  activeType,
  models,
  tools: menuTools,
  onClose,
  onModel,
  onTool,
}: {
  activeType: MediaType;
  models: CatalogModel[];
  tools: StudioTool[];
  onClose: () => void;
  onModel: (model: CatalogModel) => void;
  onTool: (tool: StudioTool) => void;
}) {
  const capabilities = activeType === "chat" ? [] : menuTools.filter((tool) => tool.mediaType === activeType);
  return (
    <section className={`studio-mega-menu ${activeType === "chat" ? "is-chat" : ""}`} aria-label={`${modeLabel(activeType)} menu`}>
      <div className="studio-mega-heading">
        <div>
          <span>TIMELESS / {modeLabel(activeType).toUpperCase()}</span>
          <strong>{activeType === "chat" ? "Choose your thinking partner" : "Choose a capability or model"}</strong>
        </div>
        <button type="button" onClick={onClose} aria-label="Close menu">
          <X size={16} />
        </button>
      </div>
      <div className="studio-mega-grid">
        {activeType !== "chat" && (
          <div className="studio-mega-column studio-mega-capabilities">
            <p>
              Capabilities <span>{capabilities.length}</span>
            </p>
            <div>
              {capabilities.map((tool) => {
                const Icon = tool.icon;
                return (
                  <button className={tool.available ? "is-live" : "is-soon"} key={tool.key} type="button" onClick={() => onTool(tool)}>
                    <span className="studio-mega-icon">
                      <Icon size={17} />
                    </span>
                    <span>
                      <strong>
                        {tool.name}
                        {tool.badge && <em>{tool.badge}</em>}
                      </strong>
                      <small>{tool.description}</small>
                    </span>
                    <b>{tool.available ? "Live" : "Soon"}</b>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className="studio-mega-column studio-mega-models">
          <p>
            Models <span>{models.length}</span>
          </p>
          <div>
            {models.map((model) => (
              <button className={model.modelKey ? "is-live" : "is-soon"} key={model.name} type="button" onClick={() => onModel(model)}>
                <span className="studio-mega-model-mark">
                  <Sparkles size={16} />
                </span>
                <span>
                  <strong>
                    {model.name}
                    {model.badge && <em>{model.badge}</em>}
                  </strong>
                  <small>{model.description}</small>
                </span>
                <b>{model.credits ? `From ${model.credits} cr` : "Soon"}</b>
              </button>
            ))}
          </div>
        </div>
      </div>
      <footer>
        <span>
          <i /> Available now
        </span>
        <span>
          <i /> In rollout
        </span>
        <b>Credits are shown only for live models.</b>
      </footer>
    </section>
  );
}
