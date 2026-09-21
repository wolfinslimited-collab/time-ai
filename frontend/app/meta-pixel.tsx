"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { META_PIXEL_ID } from "./meta-pixel-config";

export { META_PIXEL_ID } from "./meta-pixel-config";

type MetaEventParameters = Record<
  string,
  string | number | boolean | Array<string> | undefined
>;

type MetaPixelFunction = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  loaded: boolean;
  push: MetaPixelFunction;
  queue: unknown[][];
  version: string;
};

declare global {
  interface Window {
    _fbq?: MetaPixelFunction;
    fbq?: MetaPixelFunction;
    timelessMetaPixelInitialized?: boolean;
  }
}

function initializeMetaPixel() {
  if (typeof window === "undefined") return null;

  if (!window.fbq) {
    const fbq = function (...args: unknown[]) {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue.push(args);
    } as MetaPixelFunction;

    fbq.loaded = true;
    fbq.push = fbq;
    fbq.queue = [];
    fbq.version = "2.0";
    window.fbq = fbq;
    window._fbq = fbq;

    if (!document.getElementById("meta-pixel-script")) {
      const script = document.createElement("script");
      script.async = true;
      script.id = "meta-pixel-script";
      script.src = "https://connect.facebook.net/en_US/fbevents.js";
      document.head.appendChild(script);
    }
  }

  if (!window.timelessMetaPixelInitialized) {
    window.fbq("init", META_PIXEL_ID);
    window.timelessMetaPixelInitialized = true;
  }

  return window.fbq;
}

export function trackMetaEvent(
  eventName: "InitiateCheckout" | "Purchase" | "ViewContent",
  parameters: MetaEventParameters = {},
  eventId?: string,
) {
  const fbq = initializeMetaPixel();
  if (!fbq) return;
  if (eventId) {
    fbq("track", eventName, parameters, { eventID: eventId });
    return;
  }
  fbq("track", eventName, parameters);
}

export function getMetaBrowserIdentifiers() {
  if (typeof document === "undefined") return {};
  const cookies = Object.fromEntries(
    document.cookie
      .split(";")
      .map((entry) => entry.trim().split("="))
      .filter(([key, value]) => Boolean(key && value))
      .map(([key, ...value]) => [key, decodeURIComponent(value.join("="))]),
  );
  return {
    fbp: cookies._fbp,
    fbc: cookies._fbc,
  };
}

export function MetaPixel() {
  const pathname = usePathname();
  const lastTrackedUrl = useRef<string | null>(null);

  useEffect(() => {
    const currentUrl = `${pathname}${window.location.search}`;
    if (lastTrackedUrl.current === currentUrl) return;

    // The bootstrap already covers the initial document navigation.
    if (lastTrackedUrl.current !== null) initializeMetaPixel()?.("track", "PageView");
    lastTrackedUrl.current = currentUrl;
  }, [pathname]);

  return (
    <noscript>
      <img
        alt=""
        height="1"
        src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
        style={{ display: "none" }}
        width="1"
      />
    </noscript>
  );
}
