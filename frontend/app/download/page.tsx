import type { Metadata } from "next";
import Link from "next/link";

const APP_STORE_URL =
  "https://apps.apple.com/app/id6740804440";
const GOOGLE_PLAY_URL =
  "https://play.google.com/store/apps/details?id=com.wolfine.app";

export const metadata: Metadata = {
  title: "Download Timeless for iPhone and Android",
  description:
    "Download Timeless: Short Dramas from the App Store or Google Play.",
};

export default function DownloadPage() {
  return (
    <main className="download-page">
      <nav className="download-nav drama-shell" aria-label="Download navigation">
        <Link className="drama-brand" href="/" aria-label="Timeless: Short Dramas home">
          <img src="/timeless-icon.png" alt="" />
          <span>
            TIMELESS
            <small>SHORT DRAMAS</small>
          </span>
        </Link>
        <Link className="download-back" href="/">
          <span aria-hidden="true">←</span> Back to stories
        </Link>
      </nav>

      <section className="download-hero drama-shell">
        <div className="download-copy">
          <p className="drama-kicker">WATCH ANYWHERE</p>
          <h1>
            Your next story
            <br />
            <em>starts here.</em>
          </h1>
          <p className="download-intro">
            Get Timeless on iPhone, iPad, or Android and start watching
            addictive short dramas in minutes.
          </p>

          <div className="download-store-grid" aria-label="Choose your app store">
            <a href={APP_STORE_URL}>
              <span className="download-platform-mark" aria-hidden="true">
                <img src="/apple-logo.svg" alt="" />
              </span>
              <span className="download-store-copy">
                <small>Download on the</small>
                <strong>App Store</strong>
                <span>For iPhone and iPad</span>
              </span>
              <b aria-hidden="true">↗</b>
            </a>
            <a href={GOOGLE_PLAY_URL} target="_blank" rel="noreferrer">
              <span className="download-platform-mark download-platform-mark-android" aria-hidden="true">
                <img src="/google-play-logo.svg" alt="" />
              </span>
              <span className="download-store-copy">
                <small>Get it on</small>
                <strong>Google Play</strong>
                <span>For Android phones and tablets</span>
              </span>
              <b aria-hidden="true">↗</b>
            </a>
          </div>

          <p className="download-note">
            Free to download. Store availability and pricing may vary by country.
          </p>
        </div>

        <aside className="download-preview" aria-label="Timeless app preview">
          <div className="download-preview-glow" aria-hidden="true" />
          <img src="/timeless-icon.png" alt="Timeless app icon" />
          <p>TIMELESS: SHORT DRAMAS</p>
          <h2>Big emotions.<br />One more episode.</h2>
          <div className="download-preview-tags" aria-label="App highlights">
            <span>Vertical stories</span>
            <span>Free previews</span>
            <span>Watch anywhere</span>
          </div>
        </aside>
      </section>

      <footer className="download-footer drama-shell">
        <span>© 2026 Timeless</span>
        <nav aria-label="Legal">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <a href="mailto:info@timelessapp.ai">Contact</a>
        </nav>
      </footer>
    </main>
  );
}
