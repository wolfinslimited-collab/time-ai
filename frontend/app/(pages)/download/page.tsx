import type { Metadata } from "next";
import Link from "next/link";

const APP_STORE_URL = "https://apps.apple.com/app/id6740804440";
const GOOGLE_PLAY_URL = "https://play.google.com/store/apps/details?id=com.wolfine.app";

export const metadata: Metadata = {
  title: "Download Timeless for iPhone and Android",
  description: "Download Timeless: Short Dramas from the App Store or Google Play.",
};

export default function DownloadPage() {
  return (
    <main className="min-h-screen overflow-x-clip bg-neutral-950 text-neutral-50">
      <nav
        className="mx-auto flex min-h-20 w-full max-w-6xl items-center justify-between gap-6 border-b border-white/10 px-4 sm:min-h-24 sm:px-6"
        aria-label="Download navigation"
      >
        <Link
          className="inline-flex items-center gap-3 text-sm font-extrabold tracking-widest"
          href="/"
          aria-label="Timeless: Short Dramas home"
        >
          <img className="size-10 rounded-xl" src="/timeless-icon.png" alt="" />
          <span className="grid gap-0.5">
            TIMELESS
            <small className="font-mono text-xs tracking-widest text-rose-400">SHORT DRAMAS</small>
          </span>
        </Link>
        <Link className="inline-flex items-center gap-2.5 text-xs font-bold text-white/70 hover:text-white" href="/">
          <span aria-hidden="true">←</span>
          <span className="hidden sm:inline">Back to stories</span>
        </Link>
      </nav>

      <section className="mx-auto grid w-full max-w-6xl items-center gap-14 px-4 py-14 pb-20 sm:px-6 md:min-h-screen md:grid-cols-2 md:gap-20 md:py-20 lg:gap-28">
        <div>
          <p className="m-0 font-mono text-xs font-semibold uppercase tracking-widest text-rose-400">
            WATCH ANYWHERE
          </p>
          <h1 className="my-6 text-5xl font-normal leading-none tracking-tighter sm:text-7xl lg:text-8xl xl:text-9xl">
            Your next story
            <br />
            <em className="font-normal text-rose-300">starts here.</em>
          </h1>
          <p className="m-0 max-w-2xl text-lg leading-relaxed text-white/60">
            Get Timeless on iPhone, iPad, or Android and start watching addictive short dramas in
            minutes.
          </p>

          <div className="mt-8 grid max-w-2xl grid-cols-1 gap-3 sm:mt-10 sm:grid-cols-2" aria-label="Choose your app store">
            <a
              className="grid min-h-24 min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3.5 rounded-2xl border border-white/20 bg-white/5 p-5 transition duration-200 hover:-translate-y-0.5 hover:border-rose-300/70 hover:bg-white/10"
              href={APP_STORE_URL}
            >
              <span
                className="grid size-11 place-items-center rounded-xl bg-gradient-to-br from-rose-400 to-amber-200 text-neutral-950"
                aria-hidden="true"
              >
                <img className="block size-6" src="/apple-logo.svg" alt="" />
              </span>
              <span className="grid min-w-0 gap-0.5">
                <small className="text-xs text-white/45">Download on the</small>
                <strong className="text-2xl font-normal leading-tight">App Store</strong>
                <span className="text-xs text-white/45">For iPhone and iPad</span>
              </span>
              <span className="self-start text-sm font-normal text-rose-300" aria-hidden="true">
                ↗
              </span>
            </a>
            <a
              className="grid min-h-24 min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3.5 rounded-2xl border border-white/20 bg-white/5 p-5 transition duration-200 hover:-translate-y-0.5 hover:border-rose-300/70 hover:bg-white/10"
              href={GOOGLE_PLAY_URL}
              target="_blank"
              rel="noreferrer"
            >
              <span
                className="grid size-11 place-items-center rounded-xl bg-gradient-to-br from-lime-300 to-emerald-400 text-neutral-950"
                aria-hidden="true"
              >
                <img className="block size-7" src="/google-play-logo.svg" alt="" />
              </span>
              <span className="grid min-w-0 gap-0.5">
                <small className="text-xs text-white/45">Get it on</small>
                <strong className="text-2xl font-normal leading-tight">Google Play</strong>
                <span className="text-xs text-white/45">For Android phones and tablets</span>
              </span>
              <span className="self-start text-sm font-normal text-rose-300" aria-hidden="true">
                ↗
              </span>
            </a>
          </div>

          <p className="mt-4 mb-0 text-xs leading-normal text-white/35">
            Free to download. Store availability and pricing may vary by country.
          </p>
        </div>

        <aside
          className="relative flex min-h-96 w-full max-w-lg flex-col justify-end overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-b from-transparent via-neutral-950/50 to-neutral-950 p-7 shadow-2xl sm:p-10 lg:max-w-none"
          aria-label="Timeless app preview"
        >
          <div
            className="absolute inset-0 bg-gradient-to-br from-rose-950/40 to-neutral-950"
            aria-hidden="true"
          />
          <div
            className="absolute -top-20 -right-28 aspect-square w-full rounded-full bg-rose-600 opacity-40 blur-3xl"
            aria-hidden="true"
          />
          <img
            className="relative z-10 mb-auto size-20 rounded-2xl"
            src="/timeless-icon.png"
            alt="Timeless app icon"
          />
          <p className="relative z-10 mb-4 font-mono text-xs font-bold tracking-widest text-rose-400">
            TIMELESS: SHORT DRAMAS
          </p>
          <h2 className="relative z-10 m-0 text-4xl font-normal leading-none tracking-tight sm:text-5xl">
            Big emotions.
            <br />
            One more episode.
          </h2>
          <div className="relative z-10 mt-7 flex flex-wrap gap-2" aria-label="App highlights">
            <span className="rounded-full border border-white/15 px-3 py-2 text-xs text-white/70">
              Vertical stories
            </span>
            <span className="rounded-full border border-white/15 px-3 py-2 text-xs text-white/70">
              Free previews
            </span>
            <span className="rounded-full border border-white/15 px-3 py-2 text-xs text-white/70">
              Watch anywhere
            </span>
          </div>
        </aside>
      </section>

      <footer className="mx-auto flex min-h-24 w-full max-w-6xl flex-col-reverse items-start justify-center gap-6 border-t border-white/10 px-4 py-7 font-mono text-xs uppercase tracking-widest text-white/40 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:px-6 sm:py-0">
        <span>© 2026 Timeless</span>
        <nav className="flex flex-wrap gap-6" aria-label="Legal">
          <Link className="hover:text-rose-300" href="/privacy">
            Privacy
          </Link>
          <Link className="hover:text-rose-300" href="/terms">
            Terms
          </Link>
          <a className="hover:text-rose-300" href="mailto:info@timelessapp.ai">
            Contact
          </a>
        </nav>
      </footer>
    </main>
  );
}
