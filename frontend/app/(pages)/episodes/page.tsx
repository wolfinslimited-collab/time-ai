import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Header } from "../../components/header";
import { seriesEpisodes } from "../../components/series-episodes";
import { SiteFooter } from "../../components/site-footer";

export const metadata = {
  title: "Episodes — The Frozen Mind — Timeless",
  description: "Browse every episode of The Frozen Mind, the first Timeless Original short drama.",
};

export default function EpisodesPage() {
  return (
    <main className="min-h-screen overflow-x-clip bg-neutral-950 text-neutral-50">
      <Header />
      <section className="w-full py-20 md:py-28 lg:py-32">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <Link
            className="inline-flex min-h-11 items-center gap-2 font-mono text-xs font-semibold uppercase tracking-widest text-white/45 transition-colors duration-150 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
            href="/#series"
          >
            <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
            Back to series
          </Link>

          <div className="mt-8 max-w-4xl">
            <p className="m-0 font-mono text-xs font-semibold uppercase tracking-widest text-rose-400">
              The Frozen Mind
            </p>
            <h1 className="mt-5 mb-7 text-balance text-5xl font-normal leading-none tracking-tight text-neutral-50 sm:text-6xl lg:text-7xl xl:text-8xl">
              Episodes
            </h1>
            <p className="m-0 max-w-xl text-pretty text-lg font-normal leading-relaxed tracking-wide text-white/55">
              Pick a chapter and continue watching in the Timeless app.
            </p>
          </div>

          <ol className="mt-14 m-0 grid list-none gap-3 p-0">
            {seriesEpisodes.map((episode) => (
              <li key={episode.id} id={`episode-${episode.id}`}>
                <Link
                  className="grid min-h-24 grid-cols-[5rem_minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border border-white/10 bg-neutral-900/80 px-3.5 py-3.5 no-underline transition duration-200 hover:-translate-y-0.5 hover:border-white/25 hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 sm:grid-cols-[6rem_minmax(0,1fr)_auto] sm:gap-5 sm:px-4"
                  href="/download"
                >
                  <img className="size-20 rounded-xl object-cover sm:size-24" src={episode.src} alt="" />
                  <div className="grid min-w-0 gap-1">
                    <span className="font-mono text-xs font-semibold uppercase tracking-widest text-rose-400">
                      {episode.label}
                    </span>
                    <strong className="truncate text-xl font-normal tracking-tight text-neutral-50 sm:text-2xl">
                      {episode.title}
                    </strong>
                    <span className="truncate text-sm text-white/50">{episode.meta}</span>
                  </div>
                  <span
                    className="grid size-11 place-items-center rounded-full border border-white/10 text-rose-300"
                    aria-hidden="true"
                  >
                    <ArrowRight size={18} strokeWidth={1.75} />
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
