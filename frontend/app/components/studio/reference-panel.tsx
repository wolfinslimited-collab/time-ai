"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, LoaderCircle, Plus, X } from "lucide-react";
import { referenceError, type ReferenceAsset, type ReferenceConfig, type ReferenceSlot } from "../../lib/studio/references";
import { mediaMetadata } from "../../lib/studio/media-metadata";
import { referenceCopy, referenceMessage } from "./copy/reference";

export type UploadedReference = ReferenceAsset & { name: string; preview: string };

export { referenceMessage };

export function ReferencePanel({
  config,
  value,
  onChange,
  onUpload,
  onBusy,
  onError,
  disabled,
}: {
  config: ReferenceConfig;
  value: UploadedReference[];
  onChange: (v: UploadedReference[]) => void;
  onUpload: (file: File) => Promise<string>;
  onBusy: (v: boolean) => void;
  onError: (s: string) => void;
  disabled: boolean;
}) {
  const [mode, setMode] = useState<"references" | "frames">("references");
  const [uploading, setUploading] = useState("");
  const alive = useRef(true);
  const urls = useRef<string[]>([]);
  const picker = useRef<HTMLInputElement>(null);
  const selectedSlot = useRef<ReferenceSlot | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      urls.current.forEach(URL.revokeObjectURL);
      onBusy(false);
    };
  }, []);

  const slots = config.referenceSlots || [];
  if (!slots.length) return null;

  const modes = slots.some((s) => s.group === "frames") && slots.some((s) => s.group === "references");

  async function add(files: FileList | null) {
    const slot = selectedSlot.current;
    if (!files || !slot) return;
    setUploading(slot.key);
    onBusy(true);
    let next = [...value];
    try {
      for (const file of Array.from(files)) {
        if (!slot.mimeTypes.includes(file.type)) throw Error("unsupported_reference_type");
        if (file.size > (slot.maxBytes || 10 * 1024 * 1024)) throw Error("reference_file_too_large");
        const data = mediaMetadata(new Uint8Array(await file.arrayBuffer()), file.type);
        const ref: UploadedReference = {
          id: crypto.randomUUID(),
          slot: slot.key,
          mimeType: file.type,
          sizeBytes: file.size,
          ...data,
          name: file.name,
          preview: "",
          ...(slot.encoding === "video_list"
            ? { start: 0, end: Math.min(data.duration!, slot.maxClipDuration || 10) }
            : {}),
        };
        const error = referenceError(config, [...next, ref], false);
        if (error) throw Error(error);
        const id = await onUpload(file);
        if (!alive.current) return;
        const preview = URL.createObjectURL(file);
        urls.current.push(preview);
        next = [...next, { ...ref, id, preview }];
        onChange(next);
      }
    } catch (e) {
      if (alive.current) onError(referenceMessage(e instanceof Error ? e.message : String(e)));
    } finally {
      if (alive.current) setUploading("");
      onBusy(false);
    }
  }

  function remove(id: string) {
    onChange(value.filter((r) => r.id !== id));
  }

  function move(id: string, d: number) {
    const i = value.findIndex((r) => r.id === id);
    const slot = value[i]?.slot;
    const others = value.map((r, j) => (r.slot === slot ? j : -1)).filter((j) => j >= 0);
    const dest = others[others.indexOf(i) + d];
    if (dest === undefined) return;
    const next = [...value];
    [next[i], next[dest]] = [next[dest], next[i]];
    onChange(next);
  }

  return (
    <section
      className="my-2 max-h-[36vh] overflow-auto border-t border-elevated py-3 text-muted sm:max-h-[42vh]"
      aria-label={referenceCopy.ariaLabel}
    >
      <header className="flex flex-col items-start justify-between gap-3 text-sm sm:flex-row sm:items-center">
        <strong className="text-foreground">{referenceCopy.title}</strong>
        {modes && (
          <div className="flex flex-wrap gap-1">
            {(["references", "frames"] as const).map((m) => (
              <button
                type="button"
                disabled={disabled || !!uploading}
                aria-pressed={mode === m}
                className={[
                  "rounded-lg border px-2.5 py-1.5 text-sm disabled:opacity-40",
                  mode === m
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-elevated bg-elevated text-muted",
                ].join(" ")}
                key={m}
                onClick={() => {
                  setMode(m);
                  onChange([]);
                }}
              >
                {m === "frames" ? referenceCopy.modes.frames : referenceCopy.modes.references}
              </button>
            ))}
          </div>
        )}
      </header>

      <input
        ref={picker}
        type="file"
        className="sr-only"
        onChange={(e) => {
          void add(e.target.files);
          e.currentTarget.value = "";
        }}
      />

      {slots
        .filter((s) => !modes || s.group === mode || !s.group)
        .map((slot) => {
          const refs = value.filter((r) => r.slot === slot.key);
          const typeHint = slot.mimeTypes.includes("video/mp4")
            ? referenceCopy.videoMeta(slot)
            : slot.mimeTypes.includes("audio/wav")
              ? referenceCopy.audioMeta
              : referenceCopy.imageMeta;
          return (
            <div key={slot.key} className="mt-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <label className="text-foreground">
                  {slot.label}
                  {slot.min ? referenceCopy.requiredSuffix : ""}{" "}
                  <span className="font-normal text-subtle">
                    {refs.length}/{slot.max}
                  </span>
                </label>
                <button
                  type="button"
                  disabled={disabled || !!uploading || refs.length >= slot.max}
                  aria-label={referenceCopy.addAria(slot.label)}
                  className="flex items-center gap-1 rounded-lg border border-elevated bg-elevated px-2.5 py-1.5 text-sm text-muted disabled:opacity-40"
                  onClick={() => {
                    selectedSlot.current = slot;
                    if (picker.current) {
                      picker.current.accept = slot.mimeTypes.join(",");
                      picker.current.multiple = slot.max > 1;
                      picker.current.click();
                    }
                  }}
                >
                  {uploading === slot.key ? <LoaderCircle className="animate-spin" size={14} /> : <Plus size={14} />}{" "}
                  {referenceCopy.add}
                </button>
              </div>
              <p className="my-1.5 text-xs leading-relaxed text-subtle">
                {typeHint}
                {referenceCopy.maxMb(Math.round((slot.maxBytes || 10485760) / 1048576))}
                {slot.minSide ? referenceCopy.sideRange(slot.minSide, slot.maxSide) : ""}
                {slot.minPixels ? referenceCopy.megapixels : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                {refs.map((r, i) => (
                  <article
                    className="grid min-w-0 flex-1 basis-full grid-cols-[3.5rem_minmax(6.25rem,1fr)_auto] items-center gap-2 rounded-lg border border-elevated bg-surface p-2 sm:min-w-64 sm:basis-auto"
                    key={r.id}
                  >
                    {r.mimeType.startsWith("video/") ? (
                      <video className="size-14 rounded-md object-cover" src={r.preview} controls preload="metadata" />
                    ) : r.mimeType.startsWith("image/") ? (
                      <img
                        className="size-14 rounded-md object-cover"
                        src={r.preview}
                        alt={`${slot.label} ${i + 1}: ${r.name}`}
                      />
                    ) : (
                      <audio src={r.preview} controls />
                    )}
                    <div>
                      <strong className="block break-words text-sm text-foreground">
                        {i + 1}. {r.name}
                      </strong>
                      <small className="text-xs text-subtle">
                        {r.width ? `${r.width} × ${r.height}` : ""}
                        {r.duration ? ` · ${r.duration.toFixed(2)}s` : ""}
                      </small>
                    </div>
                    <div className="flex gap-0.5">
                      <button
                        type="button"
                        disabled={i === 0 || disabled}
                        className="rounded p-1 text-muted bg-elevated disabled:opacity-35"
                        onClick={() => move(r.id, -1)}
                        aria-label={referenceCopy.moveEarlier(r.name)}
                      >
                        <ArrowLeft size={13} />
                      </button>
                      <button
                        type="button"
                        disabled={i === refs.length - 1 || disabled}
                        className="rounded p-1 text-muted bg-elevated disabled:opacity-35"
                        onClick={() => move(r.id, 1)}
                        aria-label={referenceCopy.moveLater(r.name)}
                      >
                        <ArrowRight size={13} />
                      </button>
                      <button
                        type="button"
                        disabled={disabled}
                        className="rounded p-1 text-muted bg-elevated disabled:opacity-35"
                        onClick={() => remove(r.id)}
                        aria-label={referenceCopy.remove(r.name)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                    {slot.encoding === "video_list" && (
                      <div className="col-span-full flex flex-wrap items-end gap-2 text-xs">
                        {(["start", "end"] as const).map((k) => (
                          <label className="grid gap-1" key={k}>
                            {k === "start" ? referenceCopy.clipStart : referenceCopy.clipEnd}
                            <input
                              aria-label={`${k === "start" ? referenceCopy.clipStart : referenceCopy.clipEnd} ${r.name}`}
                              type="number"
                              min={0}
                              max={r.duration}
                              step={0.1}
                              value={r[k] ?? 0}
                              className="w-20 rounded border border-elevated bg-canvas p-1.5 text-foreground"
                              onChange={(e) =>
                                onChange(
                                  value.map((a) =>
                                    a.id === r.id ? { ...a, [k]: Number(e.target.value) } : a,
                                  ),
                                )
                              }
                            />
                          </label>
                        ))}
                        <span className="pb-1.5 text-subtle">{referenceCopy.maxClip(slot.maxClipDuration)}</span>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </div>
          );
        })}

      {value.some((r) => r.mimeType.startsWith("video/")) && config.autoDurationWithVideo && (
        <p className="my-1.5 text-xs leading-relaxed text-accent-soft">{referenceCopy.videoAutoDuration}</p>
      )}
      {config.frameAspectRatio && value.some((r) => r.slot === "first") && (
        <p className="my-1.5 text-xs leading-relaxed text-accent-soft">{referenceCopy.frameAspect}</p>
      )}
      {config.referenceQuota && (
        <p className="my-1.5 text-xs leading-relaxed text-accent-soft">
          {referenceCopy.quota(config.referenceQuota)}
        </p>
      )}
    </section>
  );
}
