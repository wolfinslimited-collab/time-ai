import Image from "next/image";
import { StoreBadges } from "./store-badges";

export function FinalCta() {
  return (
    <section className="w-full border-t border-foreground/10 py-20 md:py-28 lg:py-32">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-4 text-center sm:px-6">
        {/* <Image
          className="mb-8 size-20 rounded-3xl sm:size-24"
          src="/timeless-icon.png"
          alt=""
          width={96}
          height={96}
          unoptimized
        /> */}
        <h2 className="m-0 max-w-3xl font-display text-balance text-6xl font-normal leading-none tracking-tight text-foreground sm:text-6xl lg:text-7xl">
          Start watching our stories.
        </h2>
        <p className="m-0 mt-5 max-w-md text-pretty text-base leading-relaxed text-muted sm:text-lg">
          Free to download. Optional account. New episodes added regularly.
        </p>
        <StoreBadges className="mt-9 justify-center" />
      </div>
    </section>
  );
}
