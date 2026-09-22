"use client";

import type { Session } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle, LogOut, Menu, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { AuthDialog, displayName } from "./studio/auth-dialog";
import { Brand } from "./brand";
import { studioSupabase } from "../lib/studio/supabase";

const links = [
  { href: "/#series", label: "Series" },
  { href: "/episodes", label: "Episodes" },
  { href: "/download", label: "Download" },
  { href: "/studio", label: "Studio" },
  { href: "/contests", label: "Contests" },
  { href: "/pricing", label: "Pricing" },
  { href: "/resources", label: "Resources" },
] as const;

function isStudioHref(href: string) {
  return href === "/studio" || href.startsWith("/studio?");
}

export function Header({
  variant = "marketing",
  center,
  afterBrand,
  end,
}: {
  variant?: "marketing" | "studio";
  center?: ReactNode;
  afterBrand?: ReactNode;
  end?: ReactNode;
} = {}) {
  const router = useRouter();
  const isStudio = variant === "studio";
  const ownsAuth = !end;
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingStudioHref, setPendingStudioHref] = useState<string | null>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const user = session?.user ?? null;
  const frosted = scrolled || open;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!ownsAuth) return;
    let active = true;
    void studioSupabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setAuthReady(true);
    });
    const { data } = studioSupabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
      if (nextSession) setAuthOpen(false);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [ownsAuth]);

  useEffect(() => {
    if (!user || !pendingStudioHref) return;
    const href = pendingStudioHref;
    setPendingStudioHref(null);
    router.push(href);
  }, [pendingStudioHref, router, user]);

  useEffect(() => {
    if (!profileOpen) return;
    const onPointer = (event: PointerEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [profileOpen]);

  function close() {
    setOpen(false);
  }

  function openAuth(studioHref?: string) {
    if (studioHref) setPendingStudioHref(studioHref);
    setProfileOpen(false);
    setAuthOpen(true);
    close();
  }

  function handleStudioClick(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (user) return;
    event.preventDefault();
    openAuth(href);
  }

  async function signOut() {
    await studioSupabase.auth.signOut();
    setProfileOpen(false);
  }

  const initials = displayName(user).slice(0, 2).toUpperCase() || "ME";

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-[background-color,backdrop-filter,border-color] duration-200 ${
        frosted
          ? "bg-neutral-950/70 backdrop-blur-xl backdrop-saturate-150 supports-[backdrop-filter]:bg-neutral-950/55"
          : "bg-transparent"
      }`}
    >
      <div
        className={`grid w-full min-h-16 items-center gap-x-4 px-4 sm:gap-x-6 sm:px-6 lg:gap-x-8 lg:px-12 ${
          isStudio || afterBrand
            ? "grid-cols-[minmax(0,1fr)_auto]"
            : "grid-cols-[1fr_auto] lg:grid-cols-[1fr_auto_1fr]"
        }`}
      >
        <div className="flex min-w-0 items-center gap-5 justify-self-start sm:gap-8">
          <Brand
            subtitle={isStudio ? "STUDIO" : "SHORT DRAMAS"}
            onClick={close}
          />
          {afterBrand ? <div className="hidden min-w-0 md:block">{afterBrand}</div> : null}
        </div>

        {!afterBrand &&
          (center ? (
            <div className="hidden justify-self-center lg:block">{center}</div>
          ) : (
            <nav className="hidden grid-flow-col items-center justify-center gap-4 lg:grid xl:gap-5" aria-label="Primary">
              {links.map((link) =>
                link.href.startsWith("#") || link.href.startsWith("/#") ? (
                  <a
                    key={link.href}
                    className="text-sm font-medium capitalize text-neutral-50 transition-colors duration-150 hover:text-neutral-50/50"
                    href={link.href}
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    key={link.href}
                    className="text-sm font-medium capitalize text-neutral-50 transition-colors duration-150 hover:text-neutral-50/50"
                    href={link.href}
                    onClick={isStudioHref(link.href) ? (event: MouseEvent<HTMLAnchorElement>) => handleStudioClick(event, link.href) : undefined}
                  >
                    {link.label}
                  </Link>
                ),
              )}
            </nav>
          ))}

        <div className="grid grid-flow-col items-center justify-self-end gap-3">
          {end ? (
            end
          ) : !authReady ? (
            <span className="hidden size-10 items-center justify-center text-neutral-50/70 lg:inline-flex" aria-hidden="true">
              <LoaderCircle className="animate-spin" size={16} />
            </span>
          ) : user ? (
            <div className="relative hidden lg:block" ref={profileRef}>
              <button
                className="inline-flex size-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-xs font-bold tracking-wide text-neutral-50 transition-colors duration-150 hover:bg-white/15"
                type="button"
                aria-expanded={profileOpen}
                aria-label="Account menu"
                onClick={() => setProfileOpen((value) => !value)}
              >
                {initials}
              </button>
              {profileOpen && (
                <div
                  className="absolute right-0 top-full z-50 mt-2.5 grid w-56 gap-1 rounded-xl border border-white/10 bg-neutral-950/95 p-3.5 shadow-2xl backdrop-blur-xl"
                  role="menu"
                >
                  <strong className="truncate text-xs font-semibold text-neutral-50">{displayName(user)}</strong>
                  <span className="mb-1 truncate text-xs text-neutral-400">{user.email}</span>
                  <Link
                    className="inline-flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-neutral-100 transition-colors duration-150 hover:bg-white/10"
                    href="/studio"
                    role="menuitem"
                    onClick={() => setProfileOpen(false)}
                  >
                    Open Studio
                  </Link>
                  <button
                    className="inline-flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-neutral-100 transition-colors duration-150 hover:bg-white/10"
                    type="button"
                    role="menuitem"
                    onClick={signOut}
                  >
                    <LogOut size={14} /> Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              className="hidden items-center justify-center rounded-full bg-neutral-50 px-5 py-2.5 font-sans text-sm font-medium text-neutral-950 transition-colors duration-150 hover:bg-white lg:inline-flex"
              href="/studio"
            >
              Start for free
            </Link>
          )}
          {!isStudio && (
            <button
              className="inline-flex size-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 p-0 text-neutral-50 transition-colors duration-150 hover:bg-white/10 lg:hidden sm:size-11"
              type="button"
              aria-expanded={open}
              aria-controls={menuId}
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((value) => !value)}
            >
              {open ? <X size={20} strokeWidth={1.75} /> : <Menu size={20} strokeWidth={1.75} />}
            </button>
          )}
        </div>
      </div>

      {afterBrand ? (
        <div className="border-t border-white/10 px-4 py-2 md:hidden sm:px-6">{afterBrand}</div>
      ) : (
        center && <div className="border-t border-white/10 px-4 py-2 lg:hidden sm:px-6">{center}</div>
      )}

      {!isStudio && open && (
        <div className="bg-neutral-950/95 lg:hidden" id={menuId}>
          <nav className="grid grid-cols-2 gap-2.5 px-4 py-4 sm:px-6" aria-label="Mobile">
            {links.map((link) =>
              link.href.startsWith("#") || link.href.startsWith("/#") ? (
                <a
                  key={link.href}
                  className="grid min-h-13 place-items-center rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 text-sm font-semibold capitalize text-white/80 transition-colors duration-150 hover:border-white/25 hover:bg-white/10 hover:text-white"
                  href={link.href}
                  onClick={close}
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.href}
                  className="grid min-h-13 place-items-center rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 text-sm font-semibold capitalize text-white/80 transition-colors duration-150 hover:border-white/25 hover:bg-white/10 hover:text-white"
                  href={link.href}
                  onClick={(event: MouseEvent<HTMLAnchorElement>) => {
                    if (isStudioHref(link.href)) handleStudioClick(event, link.href);
                    else close();
                  }}
                >
                  {link.label}
                </Link>
              ),
            )}
            {!authReady ? (
              <span className="col-span-2 inline-flex size-10 items-center justify-center justify-self-center text-neutral-50/70" aria-hidden="true">
                <LoaderCircle className="animate-spin" size={16} />
              </span>
            ) : user ? (
              <>
                <Link
                  className="col-span-2 inline-flex min-h-13 w-full items-center justify-center rounded-full bg-neutral-50 px-3.5 py-3 font-sans text-sm font-medium text-neutral-950 transition-colors duration-150 hover:bg-white"
                  href="/studio"
                  onClick={close}
                >
                  Open Studio
                </Link>
                <button
                  className="col-span-2 inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-3 font-sans text-sm font-medium text-neutral-50 transition-colors duration-150 hover:bg-white/10"
                  type="button"
                  onClick={() => void signOut().then(close)}
                >
                  <LogOut size={15} /> Sign out
                </button>
              </>
            ) : (
              <Link
                className="col-span-2 inline-flex min-h-13 w-full items-center justify-center rounded-full bg-neutral-50 px-3.5 py-3 font-sans text-sm font-medium text-neutral-950 transition-colors duration-150 hover:bg-white"
                href="/studio"
                onClick={close}
              >
                Start for free
              </Link>
            )}
          </nav>
        </div>
      )}

      {ownsAuth && authOpen && (
        <AuthDialog
          onClose={() => setAuthOpen(false)}
          onCancel={() => {
            setAuthOpen(false);
            setPendingStudioHref(null);
          }}
          onNotice={setNotice}
        />
      )}

      {ownsAuth && notice && (
        <div className="fixed top-20 right-5 z-50 flex max-w-sm items-center gap-4 rounded-xl border border-white/10 bg-elevated px-3.5 py-3 text-sm text-foreground shadow-2xl" role="status">
          <span>{notice}</span>
          <button className="grid size-6 place-items-center rounded-md bg-white/10" type="button" aria-label="Dismiss notification" onClick={() => setNotice(null)}>
            <X size={15} />
          </button>
        </div>
      )}
    </header>
  );
}
