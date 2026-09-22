import Image from "next/image";
import Link from "next/link";
import { StoreBadges } from "./store-badges";

export function Hero() {
  return (
    <section className="relative isolate w-full overflow-hidden" id="top">
      <Image
        className="object-cover object-[50%_28%] opacity-40 blur-2xl motion-safe:animate-hero-kenburns"
        src="/frozen-mind-02.jpg"
        alt=""
        fill
        sizes="100vw"
        priority
        unoptimized
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-canvas/55"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-canvas via-transparent to-canvas"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -left-1/4 top-1/4 size-[42rem] rounded-full bg-accent/15 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-1/4 bottom-0 size-[36rem] rounded-full bg-accent-deep/20 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto grid min-h-0 w-full max-w-6xl items-center gap-16 px-4 py-16 sm:px-6 md:min-h-screen md:grid-cols-2 md:gap-20 md:py-24 lg:gap-28 lg:py-28">
        <div className="grid content-center gap-0 motion-safe:animate-hero-rise">
          <p className="m-0 font-mono text-xs font-semibold uppercase tracking-widest text-accent">
            Short dramas for mobile
          </p>
          <h1 className="mt-5 mb-6 w-fit font-display text-balance text-6xl font-normal leading-tight tracking-tight text-foreground sm:mt-5 sm:mb-7 sm:text-8xl sm:leading-none">
            Timeless
            <span className="mt-1.5 block w-fit font-sans text-xl font-thin leading-tight tracking-tight text-foreground/40 sm:text-5xl">
              Big emotions <br />
              More episodes
            </span>
          </h1>
          <p className="m-0 max-w-xl text-pretty text-base font-normal leading-relaxed tracking-wide text-muted sm:text-lg">
            Vertical stories made for the moments between everything else.
            Watch free previews, save favorites, and keep every twist with you.
          </p>
          <StoreBadges className="mt-9" id="download" priority />
          <p className="mt-4 font-mono text-xs tracking-widest text-subtle">
            Free to download · Optional account · New episodes added regularly
          </p>
        </div>

        <aside
          className="group relative z-20 hidden aspect-[3/5] w-full max-w-sm flex-col justify-between justify-self-center overflow-hidden rounded-3xl border border-foreground/20 bg-surface p-6 shadow-2xl motion-safe:animate-hero-rise md:flex md:justify-self-end"
          aria-label="Timeless short drama app preview"
          style={{ animationDelay: "120ms" }}
        >
          <img
            className="absolute inset-0 size-full object-cover object-[50%_30%] transition-transform duration-300 group-hover:scale-105"
            src="/frozen-mind-02.jpg"
            alt=""
          />
          <div
            className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-black/5 via-black/40 to-black/95"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-2.5 z-[3] rounded-3xl border border-foreground/10"
            aria-hidden="true"
          />
          <div className="relative z-10 flex items-center gap-2.5 font-mono text-xs font-semibold uppercase tracking-widest text-foreground/70">
            <img className="size-9 rounded-lg" src="/timeless-icon.png" alt="Timeless app icon" />
            <span>Timeless Original</span>
          </div>
          <div className="relative z-10 mt-auto">
            <small className="m-0 font-mono text-xs font-semibold uppercase tracking-widest text-accent">
              Now streaming
            </small>
            <strong className="mt-2.5 block font-display text-4xl font-normal leading-none tracking-tight text-foreground">
              The Frozen Mind
            </strong>
            <p className="mt-2.5 mb-0 text-xs leading-snug tracking-wide text-muted">
              Every memory hides a reason.
            </p>
          </div>
          <Link
            href="/episodes"
            className="relative z-10 mt-6 rounded-xl bg-paper px-4 py-3.5 text-center text-xs font-semibold tracking-wide text-paper-foreground transition hover:bg-foreground"
          >
            ▶ Watch episode 1
          </Link>
          <div className="relative z-10 mt-4 h-0.5 overflow-hidden bg-foreground/15">
            <i className="block h-full w-2/5 bg-accent" />
          </div>
        </aside>
      </div>
    </section>
  );
}
