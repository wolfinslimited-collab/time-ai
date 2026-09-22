import Image from "next/image";
import Link from "next/link";

const seriesCovers = [
  {
    id: "dqn",
    src: "/series/dqn.png",
    title: "DQN",
    alt: "DQN series cover — masked figure with a lit lighter on a red field",
    href: "/download",
  },
  {
    id: "kusanscar",
    src: "/series/kusanscar.png",
    title: "Kusanscar",
    alt: "Kusanscar series cover — two characters framed by green branches",
    href: "/download",
  },
  {
    id: "frozen-mind",
    src: "/series/frozen-mind.jpg",
    title: "The Frozen Mind",
    alt: "The Frozen Mind series cover — frost-covered knight in close-up",
    href: "/episodes",
  },
  {
    id: "aftermath",
    src: "/series/aftermath.jpg",
    title: "The Aftermath",
    alt: "The Aftermath series cover — armored polar bear led by warriors in a snowstorm",
    href: "/episodes",
  },
] as const;

export function SeriesSection() {
  return (
    <section className="w-full py-20 md:py-28 lg:py-32" id="series">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="max-w-6xl">
          <div className="mt-5 flex items-center justify-between gap-4">
            <h2 className="m-0 font-display text-balance text-6xl font-normal leading-tight tracking-tight text-foreground">
              Series
            </h2>
            <Link
              className="inline-flex shrink-0 items-center rounded-full bg-accent px-6 py-3 text-base font-medium text-white no-underline transition hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/80 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
              href="/episodes"
              aria-label="View more series"
            >
              View more
            </Link>
          </div>
        </div>

        <div className="mt-12 grid grid-cols-2 items-stretch gap-3 md:mt-16 lg:grid-cols-4">
          {seriesCovers.map((series) => (
            <Link
              key={series.id}
              href={series.href}
              className="group relative flex aspect-[3/5] w-full flex-col overflow-hidden rounded-3xl bg-surface shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/80 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
              aria-label={series.title}
            >
              <Image
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                src={series.src}
                alt={series.alt}
                fill
                sizes="(max-width: 1024px) 50vw, 25vw"
                unoptimized
              />
              <div className="absolute inset-0 bg-gradient-to-t from-canvas/90 via-canvas/20 to-transparent" />
              <div className="relative z-10 mt-auto p-5 sm:p-6">
                <h3 className="mb-0 text-xl font-normal tracking-tight text-foreground sm:text-2xl lg:text-3xl">
                  {series.title}
                </h3>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
