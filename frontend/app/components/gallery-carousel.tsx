"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type GalleryItem = {
  id: string;
  src: string;
  alt: string;
  title: string;
  meta: string;
};

function mediaUrl(cloudfrontPath: string) {
  const encoded = encodeURIComponent(`https://d8j0ntlcm91z4.cloudfront.net/${cloudfrontPath}`);
  return `https://images.higgs.ai/?default=1&output=webp&url=${encoded}&w=640&q=75`;
}

/** Community generated media from the reference gallery element — square crop. */
const galleryItems: GalleryItem[] = [
  {
    id: "fog-avenue",
    src: mediaUrl("user_35h9Zqn0Bk5qurQOPUM7laOSfXO/hf_20260312_154113_5d74b1d6-5c2d-46b2-873a-d595a0188383.png"),
    alt: "Models walking a fog-drenched city avenue at night",
    title: "Fog avenue",
    meta: "Cinematic night walk",
  },
  {
    id: "tree-shade",
    src: mediaUrl("user_35h9Zqn0Bk5qurQOPUM7laOSfXO/hf_20260311_130530_2a625748-3ec7-411d-98b8-ee4fc1cf4c8c.png"),
    alt: "A young woman reading beneath a leafy canopy",
    title: "Quiet canopy",
    meta: "Afternoon still",
  },
  {
    id: "industrial-arena",
    src: mediaUrl("user_35h9Zqn0Bk5qurQOPUM7laOSfXO/hf_20260314_104627_9b8d5df1-45f2-4f8a-9a00-dd69a60c0a17.png"),
    alt: "Warriors suspended above a ruined industrial arena",
    title: "Suspended arena",
    meta: "Action frame",
  },
  {
    id: "window-cat",
    src: mediaUrl("user_35h9Zqn0Bk5qurQOPUM7laOSfXO/hf_20260311_132332_4050f80b-d8a7-43ab-87e6-e421ae1cf1fb.png"),
    alt: "Quiet moment by a wooden window with a white cat",
    title: "Window light",
    meta: "Intimate portrait",
  },
  {
    id: "rain-tunnel",
    src: mediaUrl("user_35h9Zqn0Bk5qurQOPUM7laOSfXO/hf_20260313_150735_0b3401a1-0031-45fa-9402-808bc8315fbf.png"),
    alt: "A young man at the mouth of a rain-slicked tunnel",
    title: "Tunnel mouth",
    meta: "Rain morning",
  },
  {
    id: "volcanic-ridge",
    src: mediaUrl("user_35h9Zqn0Bk5qurQOPUM7laOSfXO/hf_20260313_171039_1e41c7ae-2fcf-4051-81b8-e955dd615bd2.png"),
    alt: "A rider astride a dragon on a volcanic ridge",
    title: "Volcanic ridge",
    meta: "Fantasy still",
  },
  {
    id: "night-overpass",
    src: mediaUrl("user_35h9Zqn0Bk5qurQOPUM7laOSfXO/hf_20260314_194923_c279d800-65c9-4711-bc6a-2715bda503e2.png"),
    alt: "Two people sitting on a rain-slick overpass at night",
    title: "Night overpass",
    meta: "City quiet",
  },
  {
    id: "balcony-city",
    src: mediaUrl("user_35h9Zqn0Bk5qurQOPUM7laOSfXO/hf_20260305_162045_a76abb05-b221-4147-bb8d-2d32ea1da060.png"),
    alt: "A couple on a balcony overlooking city lights",
    title: "Balcony lights",
    meta: "Night set",
  },
  {
    id: "rehearsal-spin",
    src: mediaUrl("user_35h9Zqn0Bk5qurQOPUM7laOSfXO/hf_20260314_110254_4adda8fc-103e-4cdc-8e28-4c0dcd9084b6.png"),
    alt: "A dancer spinning in a dim rehearsal room",
    title: "Rehearsal spin",
    meta: "Motion study",
  },
  {
    id: "moonlit-door",
    src: mediaUrl("user_35h9Zqn0Bk5qurQOPUM7laOSfXO/hf_20260313_151147_f4dd9d81-fe2d-4a5b-9e12-9ff44c1758fb.png"),
    alt: "A solitary figure framed in a moonlit doorway",
    title: "Moonlit door",
    meta: "Single beat",
  },
  {
    id: "ballet-slipper",
    src: mediaUrl("user_35h9Zqn0Bk5qurQOPUM7laOSfXO/hf_20260314_105240_3310f979-94bc-4f47-8888-8ccf5a1b3731.png"),
    alt: "Close frame of a ballet balance on satin slippers",
    title: "Satin balance",
    meta: "Close frame",
  },
  {
    id: "wheat-field",
    src: mediaUrl("user_35h9Zqn0Bk5qurQOPUM7laOSfXO/hf_20260313_113622_5c4f39d1-9bf9-4e26-b022-29f644c52b18.png"),
    alt: "A figure at the edge of a wind-bleached wheat field",
    title: "Wheat edge",
    meta: "Wide still",
  },
  {
    id: "grand-piano",
    src: mediaUrl("user_35h9Zqn0Bk5qurQOPUM7laOSfXO/hf_20260314_185418_423093b6-7eef-4284-af68-e774b4b818f2.png"),
    alt: "A young woman at a white grand piano under a chandelier",
    title: "Crystal piano",
    meta: "Interior scene",
  },
  {
    id: "dragon-motes",
    src: mediaUrl("user_35h9Zqn0Bk5qurQOPUM7laOSfXO/hf_20260313_171242_984d7aac-e3da-42de-b8b1-ccd4f0e70979.png"),
    alt: "A rider poised atop a dragon among neon motes",
    title: "Neon motes",
    meta: "Fantasy hold",
  },
  {
    id: "tokyo-leviathan",
    src: mediaUrl("user_35h9Zqn0Bk5qurQOPUM7laOSfXO/hf_20260313_113643_2b7c8f81-f4d6-4988-86cf-f33d5dfe8200.png"),
    alt: "A surreal leviathan drifting over a Tokyo side-street",
    title: "Street leviathan",
    meta: "Surreal Tokyo",
  },
  {
    id: "spotlight-dagger",
    src: mediaUrl("user_35h9Zqn0Bk5qurQOPUM7laOSfXO/hf_20260312_171646_b4c262b5-9cb1-46bd-a526-307656fa0866.png"),
    alt: "A theatrical figure under a single harsh spotlight",
    title: "Hard spotlight",
    meta: "Stage tableau",
  },
];

const CYCLE_COUNT = 2;

const slides = Array.from({ length: CYCLE_COUNT }, (_, cycle) =>
  galleryItems.map((item) => ({
    ...item,
    key: `${cycle}-${item.id}`,
  })),
).flat();

export function GalleryCarousel() {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);
  const [gutter, setGutter] = useState(0);

  function updateArrowState() {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft < max - 4);
  }

  function syncGutter() {
    const title = titleRef.current;
    if (!title) return;
    setGutter(Math.max(0, Math.round(title.getBoundingClientRect().left)));
  }

  function getCards() {
    const el = scrollerRef.current;
    if (!el) return [] as HTMLElement[];
    return Array.from(el.children) as HTMLElement[];
  }

  function contentOrigin(el: HTMLElement) {
    const paddingLeft = Number.parseFloat(getComputedStyle(el).paddingLeft) || 0;
    return el.getBoundingClientRect().left + paddingLeft;
  }

  function nearestCardIndex(el: HTMLElement, cards: HTMLElement[]) {
    const origin = contentOrigin(el);
    let nearest = 0;
    let nearestDist = Number.POSITIVE_INFINITY;
    for (let i = 0; i < cards.length; i++) {
      const dist = Math.abs(cards[i].getBoundingClientRect().left - origin);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = i;
      }
    }
    return nearest;
  }

  function scrollByCard(direction: -1 | 1) {
    const el = scrollerRef.current;
    if (!el) return;
    const cards = getCards();
    if (!cards.length) return;

    const current = nearestCardIndex(el, cards);
    const next = Math.max(0, Math.min(cards.length - 1, current + direction));
    if (next === current) return;

    const origin = contentOrigin(el);
    const delta = cards[next].getBoundingClientRect().left - origin;
    el.scrollBy({ left: delta, behavior: "smooth" });
  }

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const frame = requestAnimationFrame(() => {
      syncGutter();
      el.scrollLeft = 0;
      updateArrowState();
    });

    const onScroll = () => updateArrowState();
    const onResize = () => {
      syncGutter();
      updateArrowState();
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <section className="w-full py-16 md:py-20" aria-label="Studio community gallery">
      <div className="relative mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
        <div className="min-w-0">
          <h2
            ref={titleRef}
            className="w-fit font-display text-balance text-6xl font-normal tracking-tight text-foreground"
          >
            Smart storytelling
            <span className="mt-1.5 block text-muted">For every creative</span>
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            aria-label="Previous"
            disabled={!canPrev}
            onClick={() => scrollByCard(-1)}
            className="grid size-11 place-items-center rounded-full border border-accent/40 bg-accent text-white transition duration-200 hover:border-accent hover:bg-accent-strong disabled:pointer-events-none disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/80 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          >
            <ArrowLeft size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Next"
            disabled={!canNext}
            onClick={() => scrollByCard(1)}
            className={`grid size-11 place-items-center rounded-full border border-accent/40 bg-accent text-white transition duration-200 hover:border-accent hover:bg-accent-strong disabled:pointer-events-none disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/80 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas ${
              canNext ? "motion-safe:animate-gallery-nudge" : ""
            }`}
          >
            <ArrowRight size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        style={{
          paddingLeft: gutter,
          paddingRight: gutter,
          scrollPaddingInline: gutter,
        }}
        className="mt-10 flex w-full snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-4 [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((item, index) => {
          const nearStart = index < 4;
          return (
            <Link
              key={item.key}
              href="/studio"
              className="group relative flex aspect-square w-56 shrink-0 snap-start flex-col justify-end overflow-hidden rounded-xl bg-surface p-5 no-underline transition duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/80 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas sm:w-64 sm:p-6 md:w-72"
              aria-label={`${item.title} — ${item.meta}`}
            >
              <img
                className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-105"
                src={item.src}
                alt={item.alt}
                width={640}
                height={640}
                loading={nearStart ? "eager" : "lazy"}
                decoding="async"
                fetchPriority={nearStart ? "high" : "low"}
              />
              <div
                className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-black/5 via-black/40 to-black/95"
                aria-hidden="true"
              />
              <div className="relative z-10 mt-auto">
                <h3 className="mb-2 text-xl font-normal leading-tight tracking-tight text-foreground sm:text-2xl">
                  {item.title}
                </h3>
                <p className="m-0 text-xs text-foreground/70">{item.meta}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
