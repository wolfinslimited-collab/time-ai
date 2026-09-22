"use client";

import { Check, Search, WandSparkles, X } from "lucide-react";
import { calculateStudioCredits } from "../../lib/studio/pricing";
import type { StudioModel } from "../../lib/studio/studio-types";

function defaultModelCredits(model: StudioModel) {
  return calculateStudioCredits(model.credit_cost, model.provider_config.defaultInput || {}, model.credit_rules);
}

export function StudioModelPicker({
  models,
  onClose,
  onSearch,
  onSelect,
  search,
  selectedKey,
}: {
  models: StudioModel[];
  onClose: () => void;
  onSearch: (value: string) => void;
  onSelect: (key: string) => void;
  search: string;
  selectedKey: string;
}) {
  return (
    <section className="studio-model-picker" aria-label="Choose an AI model">
      <header>
        <div>
          <span>AI MODELS</span>
          <strong>Choose the right engine</strong>
        </div>
        <button type="button" onClick={onClose} aria-label="Close model picker">
          <X size={15} />
        </button>
      </header>
      <label>
        <Search size={14} />
        <input autoFocus value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search live models" />
      </label>
      <div role="listbox" aria-label="Live AI models">
        {models.map((model) => (
          <button
            className={model.key === selectedKey ? "is-selected" : ""}
            type="button"
            role="option"
            aria-selected={model.key === selectedKey}
            key={model.key}
            onClick={() => onSelect(model.key)}
          >
            <span>
              <WandSparkles size={16} />
            </span>
            <span>
              <strong>
                {model.name}
                {model.badge && <em>{model.badge}</em>}
              </strong>
              <small>{model.description}</small>
            </span>
            <b>From {defaultModelCredits(model)} cr</b>
            {model.key === selectedKey && <Check size={14} />}
          </button>
        ))}
        {!models.length && <p>No live model matches “{search}”.</p>}
      </div>
      <footer>
        <span>
          <i /> Live through Kie API
        </span>
        <b>Price updates with every setting.</b>
      </footer>
    </section>
  );
}
