"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { StudioChrome } from "../../components/studio/studio-chrome";
import { TopUpDialog } from "../../components/studio/studio-dialogs";
import { ToolLibrary } from "../../components/studio/tool-library";
import type { StudioTool } from "../../lib/studio/studio-types";
import {
  navModeToMediaType,
  parseStudioNavMode,
  studioCreateHref,
  studioExploreHref,
  writeStudioCreateSeed,
  type StudioNavMode,
} from "../../lib/studio/studio-routes";
import type { ShowcaseExample } from "./data/showcase-examples";
import { useStudioCatalog } from "./hooks/use-studio-catalog";
import { useStudioShell, useStudioShellCheckout } from "./hooks/use-studio-shell";

/** Explore / tool library — discovery only. Create lives at /studio/create. */
export function StudioExplore() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shell = useStudioShell();
  const { models, tools, creditPacks, catalogReady, setModelKey, setParameters } = useStudioCatalog(
    shell.invoke,
    shell.onNotice,
  );
  const { setPendingPack, checkoutConfirmation, setCheckoutConfirmation, checkingOut } =
    useStudioShellCheckout(shell, creditPacks, catalogReady);
  const [topUpOpen, setTopUpOpen] = useState(false);

  const navMode = parseStudioNavMode(searchParams.get("mode"));
  const generationType = navModeToMediaType(navMode);
  const categoryTools = tools.filter((tool) => tool.mediaType === generationType);

  function changeNavMode(nextMode: StudioNavMode) {
    router.push(studioExploreHref(nextMode));
    const media = navModeToMediaType(nextMode);
    const nextModel = models.find((model) => model.media_type === media);
    if (nextModel) {
      setModelKey(nextModel.key);
      setParameters(nextModel.provider_config.defaultInput || {});
    }
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
  }

  function openTool(tool: StudioTool) {
    if (!tool.available) {
      return shell.setNotice(
        tool.badge === "Provider paused"
          ? `${tool.name} is temporarily paused while Kie restores audio capacity.`
          : `${tool.name} is next in the Timeless rollout.`,
      );
    }
    router.push(studioCreateHref(tool.key));
  }

  async function recreateExample(example: ShowcaseExample) {
    const tool =
      tools.find((item) => item.key === example.toolKey) || tools.find((item) => item.key === "create-image");
    if (tool && !tool.available) {
      return shell.setNotice(
        tool.badge === "Provider paused"
          ? `${tool.name} is temporarily paused while Kie restores audio capacity.`
          : `${tool.name} is next in the Timeless rollout.`,
      );
    }
    const toolKey = tool?.key || example.toolKey || "create-image";
    writeStudioCreateSeed({ toolKey, prompt: example.prompt, style: example.style });
    try {
      await navigator.clipboard.writeText(example.prompt);
      shell.setNotice("Prompt copied and ready to recreate.");
    } catch {
      shell.setNotice("Prompt loaded and ready to recreate.");
    }
    router.push(studioCreateHref(toolKey));
  }

  function openCreateFromScratch() {
    const tool = tools.find((item) => item.available && item.mediaType === generationType) ||
      tools.find((item) => item.key === "create-image");
    if (tool && !tool.available) {
      return shell.setNotice(`${tool.name} is next in the Timeless rollout.`);
    }
    router.push(studioCreateHref(tool?.key || "create-image"));
  }

  return (
    <StudioChrome
      variant="explore"
      navMode={navMode}
      onMode={changeNavMode}
      user={shell.user}
      authReady={shell.authReady}
      authOpen={shell.authOpen}
      authMode={shell.authMode}
      onAuthOpen={shell.openAuth}
      onAuthClose={() => shell.setAuthOpen(false)}
      onAuthCancel={() => shell.authCancel(() => setPendingPack(null))}
      onAuthNotice={shell.onNotice}
      balance={shell.workspace.balance}
      projects={shell.workspace.projects}
      projectId={shell.workspace.projectId}
      onSelectProject={(project) => {
        shell.workspace.setProjectId(project.id);
        shell.workspace.loadThreads(project.id);
        shell.workspace.loadMessages(null);
      }}
      onNewProject={() => {}}
      createProject={shell.createProject}
      onSignOut={shell.signOut}
      onOpenPricing={() => setTopUpOpen(true)}
      notice={shell.notice}
      onDismissNotice={() => shell.setNotice(null)}
      checkoutConfirmation={checkoutConfirmation}
      onDismissCheckout={() => setCheckoutConfirmation(null)}
    >
      <ToolLibrary
        navMode={navMode}
        mediaType={generationType}
        tools={categoryTools}
        onMode={changeNavMode}
        onOpen={openTool}
        onOpenScratch={openCreateFromScratch}
        onRecreate={recreateExample}
      />
      {topUpOpen && (
        <TopUpDialog
          packs={creditPacks}
          balance={shell.workspace.balance}
          checkingOut={checkingOut}
          onClose={() => setTopUpOpen(false)}
          onSelectPack={(packKey) => {
            setTopUpOpen(false);
            setPendingPack(packKey);
          }}
        />
      )}
    </StudioChrome>
  );
}
