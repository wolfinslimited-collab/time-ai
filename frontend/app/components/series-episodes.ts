export type SeriesEpisode = {
  id: string;
  src: string;
  alt: string;
  label: string;
  title: string;
  meta: string;
  accent?: "free";
};

export const seriesEpisodes: SeriesEpisode[] = [
  {
    id: "01",
    src: "/frozen-mind-01.jpg",
    alt: "Armored warriors crossing a frozen battlefield",
    label: "EPISODE 01",
    title: "The first fracture",
    meta: "Free preview",
    accent: "free",
  },
  {
    id: "02",
    src: "/frozen-mind-02.jpg",
    alt: "A frost-covered knight in close-up",
    label: "EPISODE 02",
    title: "What she forgot",
    meta: "Continue the story",
  },
  {
    id: "03",
    src: "/frozen-mind-03.jpg",
    alt: "Knights approaching a frozen cathedral",
    label: "EPISODE 03",
    title: "The hidden answer",
    meta: "The mystery deepens",
  },
];
