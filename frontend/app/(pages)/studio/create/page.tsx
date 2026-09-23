import type { Metadata } from "next";
import { Suspense } from "react";
import { StudioCreate } from "./studio-create";

export const metadata: Metadata = {
  title: "Create — Timeless Studio",
  description: "Generate images, video, and audio with Timeless Studio tools.",
};

export default function StudioCreatePage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-canvas" />}>
      <StudioCreate />
    </Suspense>
  );
}
