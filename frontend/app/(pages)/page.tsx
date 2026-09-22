import { FeaturesSection } from "../components/features-section";
import { FinalCta } from "../components/final-cta";
import { GalleryCarousel } from "../components/gallery-carousel";
import { Header } from "../components/header";
import { Hero } from "../components/hero";
import { SeriesSection } from "../components/series-section";
import { SiteFooter } from "../components/site-footer";

export default function Home() {
  return (
    <main className="min-h-screen overflow-x-clip bg-canvas text-foreground">
      <Header />
      <Hero />
      <GalleryCarousel />
      <SeriesSection />
      <FeaturesSection />
      <FinalCta />
      <SiteFooter />
    </main>
  );
}
