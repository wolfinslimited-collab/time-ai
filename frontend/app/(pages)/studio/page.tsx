import type { Metadata } from "next";
import { StudioWorkspace } from "./studio-workspace";

export const metadata: Metadata = {
  title: "Timeless Studio — Create with AI",
  description:
    "Create images, video, voice, and ideas with leading AI models in one seamless desktop studio.",
};

export default function StudioPage() {
  return <StudioWorkspace />;
}
