import { Header } from "../../components/header";
import { SiteFooter } from "../../components/site-footer";

export const metadata = {
  title: "Resources — Timeless",
  description: "Guides, tips, and resources for watching and creating with Timeless.",
};

export default function ResourcesPage() {
  return (
    <main className="min-h-screen overflow-x-clip bg-neutral-950 text-neutral-50">
      <Header />
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 md:py-28 lg:py-32">
        <p className="m-0 font-mono text-xs font-semibold uppercase tracking-widest text-rose-400">
          Resources
        </p>
        <h1 className="mt-5 mb-7 text-balance text-5xl font-normal leading-none tracking-tight sm:text-6xl lg:text-7xl">
          Resources coming soon.
        </h1>
        <p className="m-0 max-w-xl text-lg leading-relaxed text-white/55">
          Guides and creator resources will land here. Check back soon.
        </p>
      </section>
      <SiteFooter />
    </main>
  );
}
