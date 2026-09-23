"use client";

import { useEffect, useRef, useState } from "react";
import { supportCopy } from "./copy/support";

export function SupportAnswer({
  content,
  animate,
  onProgress,
}: {
  content: string;
  animate: boolean;
  onProgress: () => void;
}) {
  const [visible, setVisible] = useState(animate ? 0 : content.length);
  const progress = useRef(onProgress);

  useEffect(() => {
    progress.current = onProgress;
  }, [onProgress]);

  useEffect(() => {
    if (!animate) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let count = 0;
    const timer = window.setInterval(() => {
      count = reduced ? content.length : Math.min(content.length, count + 6);
      setVisible(count);
      progress.current();
      if (count === content.length) window.clearInterval(timer);
    }, 24);
    return () => window.clearInterval(timer);
  }, [content, animate]);

  const text = animate ? content.slice(0, visible) : content;

  return (
    <p className="mt-1.5 m-0 text-sm leading-relaxed whitespace-pre-wrap break-words">
      <span aria-hidden={animate}>{text}</span>
      {animate && visible < content.length && (
        <span
          className="ml-0.5 inline-block h-[1em] w-1 -translate-y-0.5 rounded-sm bg-accent align-[-0.1em]"
          aria-hidden="true"
        />
      )}
      <span className="sr-only" aria-live="polite">
        {animate && visible === content.length ? content : ""}
      </span>
    </p>
  );
}

export function SupportSkeleton() {
  return (
    <div
      className="mb-3.5 w-[92%] max-w-[95%] rounded-bl-2xl rounded-br-2xl rounded-tr-2xl rounded-tl-sm bg-white/5 px-4 py-3"
      role="status"
      aria-label={supportCopy.skeletonLabel}
    >
      <span className="flex items-center gap-1 text-xs tracking-wider text-muted">
        {supportCopy.roles.assistant}
      </span>
      <div className="mt-3.5 grid gap-2.5" aria-hidden="true">
        <i className="block h-2.5 rounded-md bg-elevated animate-pulse" />
        <i className="block h-2.5 w-[90%] rounded-md bg-elevated animate-pulse" />
        <i className="block h-2.5 w-[62%] rounded-md bg-elevated animate-pulse" />
      </div>
      <span className="sr-only">{supportCopy.preparingAnswer}</span>
    </div>
  );
}
