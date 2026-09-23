import type { Metadata } from "next";
import { Suspense } from "react";
import { StudioExplore } from "./studio-explore";

export const metadata: Metadata = {
  title: "Timeless Studio — Create with AI",
  description:
    "Create images, video, voice, and ideas with leading AI models in one seamless desktop studio.",
};

export default function StudioPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-canvas" />}>
      <StudioExplore />
    </Suspense>
  );
}
