import Image from "next/image";

const APP_STORE_HREF = "https://apps.apple.com/app/id6740804440";
const PLAY_STORE_HREF = "https://play.google.com/store/apps/details?id=com.wolfine.app";

type StoreBadgesProps = {
  priority?: boolean;
  className?: string;
  id?: string;
};

export function StoreBadges({ priority = false, className = "", id }: StoreBadgesProps) {
  return (
    <div id={id} className={`flex flex-wrap items-center gap-3 ${className}`.trim()}>
      <a href={APP_STORE_HREF} className="inline-flex h-11 items-center">
        <Image
          className="block h-11 w-auto"
          src="/badges/app-store-white.svg"
          alt="Download on the App Store"
          width={132}
          height={44}
          unoptimized
          priority={priority}
        />
      </a>
      <a
        href={PLAY_STORE_HREF}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-11 items-center"
      >
        <Image
          className="block h-11 w-auto"
          src="/badges/google-play.png"
          alt="Get it on Google Play"
          width={168}
          height={44}
          unoptimized
          priority={priority}
        />
      </a>
    </div>
  );
}
