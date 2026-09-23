"use client";

import { Check, Search, WandSparkles, X } from "lucide-react";
import { calculateStudioCredits } from "../../lib/studio/pricing";
import type { StudioModel } from "../../lib/studio/studio-types";
import { modelPickerCopy } from "./copy/model-picker";

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
    <section
      data-studio-model-picker
      className="absolute right-3 bottom-20 z-30 w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-elevated/95 text-foreground shadow-2xl backdrop-blur-xl max-md:fixed max-md:inset-x-2 max-md:bottom-2 max-md:max-h-[calc(100vh-5rem)]"
      aria-label={modelPickerCopy.pickerAria}
    >
      <header className="flex min-h-14 items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="grid gap-0.5">
          <span className="font-mono text-xs font-extrabold tracking-wider text-accent">
            {modelPickerCopy.kicker}
          </span>
          <strong className="text-sm font-bold">{modelPickerCopy.title}</strong>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={modelPickerCopy.closeAria}
          className="grid size-8 place-items-center rounded-lg bg-white/5 text-muted transition-colors hover:bg-elevated-hover hover:text-foreground"
        >
          <X size={15} />
        </button>
      </header>

      <label className="mx-3.5 mt-3 mb-2 flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-subtle">
        <Search size={14} />
        <input
          className="min-w-0 flex-1 border-0 bg-transparent text-sm text-foreground outline-none placeholder:text-subtle"
          autoFocus
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder={modelPickerCopy.searchPlaceholder}
        />
      </label>

      <div
        role="listbox"
        aria-label={modelPickerCopy.listAria}
        className="grid max-h-80 grid-cols-1 gap-1.5 overflow-y-auto px-3.5 pt-1 pb-3 md:grid-cols-2 max-md:max-h-[calc(100vh-15rem)]"
      >
        {models.map((model) => {
          const selected = model.key === selectedKey;
          return (
            <button
              className={
                selected
                  ? "relative grid min-h-20 min-w-0 grid-cols-[2.125rem_minmax(0,1fr)] items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 p-2.5 text-left text-foreground"
                  : "relative grid min-h-20 min-w-0 grid-cols-[2.125rem_minmax(0,1fr)] items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-2.5 text-left text-muted transition-colors hover:border-accent/30 hover:bg-accent/10 hover:text-foreground"
              }
              type="button"
              role="option"
              aria-selected={selected}
              key={model.key}
              onClick={() => onSelect(model.key)}
            >
              <span className="grid size-8 place-items-center rounded-lg border border-accent/20 bg-accent/10 text-accent-soft">
                <WandSparkles size={16} />
              </span>
              <span className="grid min-w-0 gap-1">
                <strong className="flex items-center gap-1.5 text-sm">
                  {model.name}
                  {model.badge && (
                    <em className="rounded-full bg-accent px-1.5 py-0.5 text-xs font-normal not-italic text-accent-foreground uppercase">
                      {model.badge}
                    </em>
                  )}
                </strong>
                <small className="line-clamp-2 text-xs leading-snug text-subtle">
                  {model.description}
                </small>
              </span>
              <b className="absolute right-2 bottom-1.5 font-mono text-xs font-semibold text-muted">
                {modelPickerCopy.fromCredits(defaultModelCredits(model))}
              </b>
              {selected && <Check className="absolute top-2 right-2 text-accent" size={14} />}
            </button>
          );
        })}
        {!models.length && (
          <p className="col-span-full px-5 py-5 text-center text-sm text-subtle">
            {modelPickerCopy.noMatches(search)}
          </p>
        )}
      </div>

      <footer className="flex min-h-9 items-center justify-between border-t border-white/10 px-4 py-2 text-xs text-subtle">
        <span className="inline-flex items-center gap-1.5">
          <i className="size-1.5 rounded-full bg-accent shadow-accent/40 shadow-sm" />
          {modelPickerCopy.liveThrough}
        </span>
        <b className="font-semibold text-muted">{modelPickerCopy.priceNote}</b>
      </footer>
    </section>
  );
}
