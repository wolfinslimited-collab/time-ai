import Image from "next/image";
import { Heart, Smartphone, Wifi, Clapperboard } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Tip = {
  title: string;
  copy: string;
  icon: LucideIcon;
  className: string;
  iconClassName: string;
  cover?: string;
};

const tips: Tip[] = [
  {
    title: "Stories made for mobile",
    copy: "Vertical short dramas built for one hand and the moments between everything else.",
    icon: Smartphone,
    cover: "/features/mobile-stories.png",
    className:
      "relative min-h-72 overflow-hidden text-paper lg:col-span-2 lg:row-span-2 lg:min-h-80",
    iconClassName: "bg-white/15 text-accent-soft backdrop-blur-sm",
  },
  {
    title: "Smooth on any connection",
    copy: "Adaptive streaming picks the right quality, with manual controls when you want them.",
    icon: Wifi,
    className: "bg-white text-paper-foreground",
    iconClassName: "bg-accent/15 text-paper-accent",
  },
  {
    title: "Your story follows you",
    copy: "Save favorites and pick up where you left off across devices with an optional account.",
    icon: Heart,
    className: "bg-white text-paper-foreground",
    iconClassName: "bg-accent/15 text-paper-accent",
  },
  {
    title: "Free to start watching",
    copy: "Open any series with free episode previews, then keep going when the story hooks you.",
    icon: Clapperboard,
    className: "bg-accent/15 text-paper-foreground lg:col-span-2",
    iconClassName: "bg-paper-accent/10 text-paper-accent",
  },
];

export function FeaturesSection() {
  return (
    <section className="w-full bg-paper py-20 text-paper-foreground md:py-28 lg:py-32" id="features">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="max-w-3xl">
          <h2 className="m-0 font-display text-balance text-6xl font-normal leading-none tracking-tight text-paper-foreground sm:text-6xl lg:text-7xl">
            Stories that move with you
          </h2>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-3 sm:mt-16 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2 lg:gap-4">
          {tips.map((tip) => {
            const Icon = tip.icon;
            return (
              <article
                key={tip.title}
                className={`group flex flex-col justify-between gap-8 rounded-3xl p-6 transition duration-200 hover:-translate-y-0.5 sm:p-7 ${tip.className}`}
              >
                {tip.cover ? (
                  <>
                    <Image
                      src={tip.cover}
                      alt=""
                      fill
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      unoptimized
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div
                      className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/55 to-canvas/20"
                      aria-hidden="true"
                    />
                  </>
                ) : null}
                <span
                  className={`relative z-10 inline-flex size-11 items-center justify-center rounded-2xl ${tip.iconClassName}`}
                  aria-hidden="true"
                >
                  <Icon className="size-5" strokeWidth={1.75} />
                </span>
                <div className="relative z-10">
                  <h3 className="m-0 text-2xl font-normal tracking-tight sm:text-3xl">
                    {tip.title}
                  </h3>
                  <p className="m-0 mt-3 max-w-prose text-sm leading-relaxed opacity-60 sm:text-base">
                    {tip.copy}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
