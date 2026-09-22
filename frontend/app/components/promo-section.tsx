import Image from "next/image";
import Link from "next/link";
import { Check } from "lucide-react";

const benefits = [
  "Watch free episode previews",
  "Save favorites across devices",
  "New episodes added regularly",
];

export function PromoSection() {
  return (
    <section className="w-full py-12 md:py-16 bg-canvas" aria-label="Timeless offer">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <Link
          href="/download"
          className="group relative isolate flex min-h-64 w-full overflow-hidden rounded-3xl border border-white/20 bg-surface text-left shadow-2xl transition duration-200 hover:border-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/80 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas sm:min-h-72 lg:min-h-80"
        >
          <Image
            src="https://static.higgsfield.ai/public/promotions/seedance-2-5-sale-hero-poster.jpg"
            alt=""
            aria-hidden="true"
            fill
            sizes="(max-width: 1024px) 100vw, 72rem"
            unoptimized
            className="pointer-events-none object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <video
            loop
            muted
            autoPlay
            playsInline
            disablePictureInPicture
            preload="metadata"
            aria-hidden="true"
            src="https://static.higgsfield.ai/promotions/seedance_2_5_explore_image.mp4"
            className="pointer-events-none absolute inset-0 size-full object-cover"
          >
            Your browser does not support the video.
          </video>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-black/75"
          />
          <div className="relative z-10 flex w-full max-w-xl flex-col items-start justify-between gap-6 p-5 sm:p-6 lg:p-8">
            <div className="flex flex-col gap-4">
              <p className="m-0 font-mono text-xs font-semibold uppercase tracking-widest text-accent">
                Limited offer
              </p>
              <h3 className="m-0 text-balance text-3xl font-normal leading-tight tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                Sign up and get your{" "}
                <span className="text-accent-soft">extra discount</span>
              </h3>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {benefits.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-2 text-sm text-foreground/60">
                    <Check
                      className="mt-0.5 size-4 shrink-0 text-accent"
                      strokeWidth={2.25}
                      aria-hidden="true"
                    />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
            <span className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-accent-soft px-6 text-sm font-semibold tracking-wide text-accent-foreground transition duration-200 group-hover:-translate-y-0.5 group-hover:bg-accent sm:w-auto">
              <span className="lg:hidden">Get your discount</span>
              <span className="hidden lg:inline">Sign up and get your discount</span>
            </span>
          </div>
        </Link>
      </div>
    </section>
  );
}
