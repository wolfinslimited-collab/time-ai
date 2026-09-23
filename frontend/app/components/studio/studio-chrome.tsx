"use client";

import {
  ArrowLeft,
  AudioLines,
  Check,
  ChevronDown,
  Clapperboard,
  Coins,
  FolderKanban,
  ImageIcon,
  LoaderCircle,
  LogOut,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { AuthDialog, displayName } from "../auth-dialog";
import { Header } from "../header";
import type { CheckoutConfirmation, StudioProject } from "../../lib/studio/studio-types";
import { studioExploreHref, type StudioNavMode } from "../../lib/studio/studio-routes";
import { CreditSuccessDialog, NewProjectDialog } from "./studio-dialogs";
import { StudioSupport } from "./studio-support";

const modeNavLink = (active: boolean) =>
  `inline-flex items-center gap-1.5 text-sm font-medium capitalize transition-colors duration-150 ${
    active ? "text-neutral-50" : "text-neutral-50/50 hover:text-neutral-50"
  }`;

const NAV_ITEMS = [
  ["studio", Sparkles, "Studio"],
  ["image", ImageIcon, "Image"],
  ["video", Clapperboard, "Video"],
  ["audio", AudioLines, "Sound"],
] as const;

export function StudioChrome({
  variant = "explore",
  navMode = "studio",
  onMode,
  createTitle,
  onBackToExplore,
  user,
  authReady,
  authOpen,
  authMode,
  onAuthOpen,
  onAuthClose,
  onAuthCancel,
  onAuthNotice,
  balance,
  projects,
  projectId,
  onSelectProject,
  onNewProject,
  createProject,
  onSignOut,
  onOpenPricing,
  notice,
  onDismissNotice,
  checkoutConfirmation,
  onDismissCheckout,
  children,
}: {
  variant?: "explore" | "create";
  navMode?: StudioNavMode;
  onMode?: (mode: StudioNavMode) => void;
  createTitle?: string;
  onBackToExplore?: () => void;
  user: User | null;
  authReady: boolean;
  authOpen: boolean;
  authMode: "signin" | "signup";
  onAuthOpen: (mode: "signin" | "signup") => void;
  onAuthClose: () => void;
  onAuthCancel: () => void;
  onAuthNotice: (message: string) => void;
  balance: number;
  projects: StudioProject[];
  projectId: string | null;
  onSelectProject: (project: StudioProject) => void;
  onNewProject: () => void;
  createProject: (name: string) => Promise<void>;
  onSignOut: () => Promise<void>;
  onOpenPricing: () => void;
  notice: string | null;
  onDismissNotice: () => void;
  checkoutConfirmation: CheckoutConfirmation | null;
  onDismissCheckout: () => void;
  children: ReactNode;
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const projectMenuRef = useRef<HTMLDivElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const selectedProject = projects.find((project) => project.id === projectId) || null;
  const isExplore = variant === "explore";

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (projectMenuOpen && projectMenuRef.current && !projectMenuRef.current.contains(target)) {
        setProjectMenuOpen(false);
      }
      if (profileOpen && profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        setProfileOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setProjectMenuOpen(false);
      setProfileOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [profileOpen, projectMenuOpen]);

  const afterBrand = isExplore ? (
    <nav className="flex items-center justify-start gap-4 xl:gap-5" aria-label="Studio modes">
      {NAV_ITEMS.map(([mode, Icon, label]) => (
        <Link
          key={mode}
          aria-current={navMode === mode ? "page" : undefined}
          className={modeNavLink(navMode === mode)}
          href={studioExploreHref(mode)}
          onClick={() => onMode?.(mode)}
        >
          <Icon size={16} className={navMode === mode ? "text-accent" : undefined} /> {label}
        </Link>
      ))}
    </nav>
  ) : (
    <div className="flex min-w-0 items-center gap-3">
      <Link
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
        href={studioExploreHref(navMode)}
        onClick={onBackToExplore}
      >
        <ArrowLeft size={15} /> Studio
      </Link>
      {createTitle ? (
        <span className="hidden truncate text-sm text-foreground sm:inline">{createTitle}</span>
      ) : null}
    </div>
  );

  return (
    <main className="studio-app relative min-h-screen bg-canvas text-foreground">
      <Header
        variant="studio"
        afterBrand={afterBrand}
        end={
          <>
            {user && (
              <>
                <div className="relative hidden sm:block" ref={projectMenuRef}>
                  <button
                    className="inline-flex h-10 max-w-44 items-center gap-1.5 rounded-lg border border-white/10 bg-transparent px-5 font-sans text-sm font-medium text-muted"
                    type="button"
                    onClick={() => setProjectMenuOpen((open) => !open)}
                  >
                    <FolderKanban size={15} />
                    <span className="truncate">{selectedProject?.name || "Projects"}</span>
                    <ChevronDown size={13} />
                  </button>
                  {projectMenuOpen && (
                    <div className="absolute top-full right-0 z-40 mt-2.5 grid w-60 gap-0.5 rounded-xl border border-white/10 bg-elevated/95 p-2 shadow-2xl backdrop-blur-xl">
                      <p className="mx-2 mt-1 mb-2 font-mono text-xs tracking-widest text-subtle uppercase">Projects</p>
                      {projects.map((project) => (
                        <button
                          className={`grid min-w-0 grid-cols-[18px_minmax(0,1fr)_16px] items-center gap-1.5 rounded-lg px-2.5 py-2.5 text-left text-xs ${
                            project.id === projectId ? "bg-white/5 text-foreground" : "bg-transparent text-muted"
                          }`}
                          key={project.id}
                          type="button"
                          onClick={() => {
                            onSelectProject(project);
                            setProjectMenuOpen(false);
                          }}
                        >
                          <FolderKanban size={14} />
                          <span className="truncate">{project.name}</span>
                          {project.id === projectId && <Check className="text-accent" size={13} />}
                        </button>
                      ))}
                      <button
                        className="mt-1 grid grid-cols-[18px_1fr] items-center gap-1.5 border-t border-white/10 px-2.5 pt-2.5 pb-1 text-left text-xs text-accent-soft"
                        type="button"
                        onClick={() => {
                          setProjectMenuOpen(false);
                          setNewProjectOpen(true);
                          onNewProject();
                        }}
                      >
                        <Plus size={14} /> New project
                      </button>
                    </div>
                  )}
                </div>
                <button
                  className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-white/10 px-5 font-sans text-sm font-medium text-foreground"
                  onClick={onOpenPricing}
                  type="button"
                >
                  <Coins size={15} /> {balance.toLocaleString()}
                </button>
              </>
            )}
            {!authReady ? (
              <span className="grid size-10 place-items-center text-muted" aria-hidden="true">
                <LoaderCircle className="animate-spin" size={16} />
              </span>
            ) : user ? (
              <div className="relative" ref={profileMenuRef}>
                <button
                  className="inline-flex size-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-xs font-bold tracking-wide text-neutral-50 transition-colors duration-150 hover:bg-white/15"
                  onClick={() => setProfileOpen((open) => !open)}
                  type="button"
                  aria-expanded={profileOpen}
                  aria-label="Account menu"
                >
                  {displayName(user).slice(0, 2).toUpperCase()}
                </button>
                {profileOpen && (
                  <div className="absolute top-full right-0 mt-2.5 grid w-56 gap-1 rounded-xl border border-white/10 bg-elevated p-3.5 shadow-2xl">
                    <strong className="truncate text-xs text-foreground">{displayName(user)}</strong>
                    <span className="truncate text-xs text-muted">{user.email}</span>
                    <button
                      className="mt-2 inline-flex items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-muted hover:bg-white/5 hover:text-foreground"
                      type="button"
                      onClick={async () => {
                        await onSignOut();
                        setProfileOpen(false);
                      }}
                    >
                      <LogOut size={14} /> Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <button
                  className="inline-flex h-10 items-center justify-center rounded-full border border-white/15 bg-white/5 px-5 font-sans text-sm font-medium text-neutral-50 transition-colors duration-150 hover:bg-white/10"
                  onClick={() => onAuthOpen("signin")}
                  type="button"
                >
                  Sign in
                </button>
                <button
                  className="inline-flex h-10 items-center justify-center rounded-full bg-accent px-5 font-sans text-sm font-medium text-accent-foreground transition-colors duration-150 hover:bg-accent-soft"
                  onClick={() => onAuthOpen("signup")}
                  type="button"
                >
                  Sign up
                </button>
              </>
            )}
          </>
        }
      />

      {children}

      {notice && (
        <div
          className="fixed top-20 right-5 z-50 flex max-w-sm items-center gap-4 rounded-xl border border-white/10 bg-elevated px-3.5 py-3 text-sm text-foreground shadow-2xl"
          role="status"
        >
          <span>{notice}</span>
          <button
            className="grid size-6 place-items-center rounded-md bg-white/10"
            type="button"
            aria-label="Dismiss notification"
            onClick={onDismissNotice}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {checkoutConfirmation && (
        <CreditSuccessDialog confirmation={checkoutConfirmation} onClose={onDismissCheckout} />
      )}
      <StudioSupport key={user?.id ?? "guest"} userId={user?.id ?? null} onSignIn={() => onAuthOpen("signin")} />
      {authOpen && (
        <AuthDialog
          key={authMode}
          initialMode={authMode}
          onClose={onAuthClose}
          onCancel={onAuthCancel}
          onNotice={onAuthNotice}
        />
      )}
      {newProjectOpen && (
        <NewProjectDialog
          onClose={() => setNewProjectOpen(false)}
          onCreate={async (name) => {
            await createProject(name);
            setNewProjectOpen(false);
          }}
        />
      )}
    </main>
  );
}
