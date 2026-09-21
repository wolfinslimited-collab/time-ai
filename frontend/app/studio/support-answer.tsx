"use client";

import { useEffect, useRef, useState } from "react";

export function SupportAnswer({content, animate, onProgress}: {content: string; animate: boolean; onProgress: () => void}) {
  const [visible, setVisible] = useState(animate ? 0 : content.length);
  const progress = useRef(onProgress);
  useEffect(() => { progress.current = onProgress; }, [onProgress]);
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
  return <p className="studio-support-answer"><span aria-hidden={animate}>{text}</span>{animate && visible < content.length && <span className="studio-support-caret" aria-hidden="true" />}<span className="studio-support-sr" aria-live="polite">{animate && visible === content.length ? content : ""}</span></p>;
}

export function SupportSkeleton() {
  return <div className="studio-support-message assistant studio-support-skeleton" role="status" aria-label="Timeless AI is preparing a reply"><span>TIMELESS AI</span><div aria-hidden="true"><i /><i /><i /></div><span className="studio-support-sr">Preparing your answer…</span></div>;
}
