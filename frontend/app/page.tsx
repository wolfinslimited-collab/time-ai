import Link from "next/link";

const benefits = [
  {
    number: "01",
    title: "Stories made for mobile",
    copy: "Watch cinematic short dramas in a vertical, one-handed experience designed for the moments between everything else.",
  },
  {
    number: "02",
    title: "Smooth on every connection",
    copy: "Adaptive streaming selects the right quality for your connection, with manual quality controls whenever you want them.",
  },
  {
    number: "03",
    title: "Your story follows you",
    copy: "Save favorites and continue watching across devices with an optional Timeless account.",
  },
];

const genres = [
  "ROMANCE",
  "MYSTERY",
  "REVENGE",
  "SUSPENSE",
  "SHORT DRAMAS",
  "ORIGINAL STORIES",
];

export default function Home() {
  return (
    <main className="drama-site">
      <nav className="drama-nav drama-shell" aria-label="Primary navigation">
        <a className="drama-brand" href="#top" aria-label="Timeless: Short Dramas home">
          <img src="/timeless-icon.png" alt="" />
          <span>
            TIMELESS
            <small>SHORT DRAMAS</small>
          </span>
        </a>
        <div className="drama-nav-links">
          <a href="#series">Frozen Mind</a>
          <a href="#features">Features</a>
          <Link href="/studio">AI Studio</Link>
          <Link href="/pricing">Pricing</Link>
        </div>
        <Link className="drama-nav-cta" href="/download">
          Download <span aria-hidden="true">↗</span>
        </Link>
      </nav>

      <section className="drama-hero drama-shell" id="top">
        <div className="drama-glow" aria-hidden="true" />
        <div className="drama-hero-copy">
          <p className="drama-kicker">TIMELESS: SHORT DRAMAS</p>
          <h1>
            Timeless: Short Dramas
            <br />
            <em>Big emotions. One more episode.</em>
          </h1>
          <p>
            Timeless is a mobile streaming app for addictive short dramas.
            Discover vertical stories, watch free previews, save favorites, and
            continue every twist wherever you go.
          </p>
          <div className="drama-actions" id="download">
            <a
              className="drama-button drama-button-primary"
              href="https://apps.apple.com/app/id6740804440"
            >
              Download for iPhone <span aria-hidden="true">↗</span>
            </a>
            <a
              className="drama-button drama-button-secondary"
              href="https://play.google.com/store/apps/details?id=com.wolfine.app"
              target="_blank"
              rel="noreferrer"
            >
              Get it on Google Play <span aria-hidden="true">↗</span>
            </a>
          </div>
          <p className="drama-platform-note">
            Free to download · Optional account · New episodes added regularly
          </p>
        </div>

        <aside className="drama-phone" aria-label="Timeless short drama app preview">
          <img className="drama-phone-art" src="/frozen-mind-02.jpg" alt="" />
          <div className="drama-phone-top">
            <img src="/timeless-icon.png" alt="Timeless app icon" />
            <span>TIMELESS ORIGINAL</span>
          </div>
          <div className="drama-phone-title">
            <small>NOW STREAMING</small>
            <strong>THE FROZEN MIND</strong>
            <p>Every memory hides a reason.</p>
          </div>
          <div className="drama-play">▶ Watch episode 1</div>
          <div className="drama-progress"><i /></div>
        </aside>
      </section>

      <section className="drama-marquee" aria-label="Timeless genres">
        <div className="drama-marquee-track">
          <div className="drama-marquee-group">
            {genres.map((genre) => <span key={genre}>{genre}</span>)}
          </div>
        </div>
      </section>

      <section className="drama-series drama-shell drama-section" id="series">
        <div className="drama-section-heading">
          <p className="drama-kicker">FIRST TIMELESS ORIGINAL</p>
          <h2>The Frozen Mind</h2>
          <p>
            A psychological short series about memory, trust, and the truth
            waiting underneath both.
          </p>
        </div>
        <div className="drama-episodes">
          <article className="drama-episode drama-episode-free">
            <img src="/frozen-mind-01.jpg" alt="Armored warriors crossing a frozen battlefield" />
            <span>EPISODE 01</span>
            <h3>The first fracture</h3>
            <p>Free preview</p>
            <b aria-hidden="true">▶</b>
          </article>
          <article className="drama-episode">
            <img src="/frozen-mind-02.jpg" alt="A frost-covered knight in close-up" />
            <span>EPISODE 02</span>
            <h3>What she forgot</h3>
            <p>Continue the story</p>
            <b aria-hidden="true">▶</b>
          </article>
          <article className="drama-episode">
            <img src="/frozen-mind-03.jpg" alt="Knights approaching a frozen cathedral" />
            <span>EPISODE 03</span>
            <h3>The hidden answer</h3>
            <p>The mystery deepens</p>
            <b aria-hidden="true">▶</b>
          </article>
        </div>
      </section>

      <section className="drama-features drama-section" id="features">
        <div className="drama-shell">
          <div className="drama-section-heading drama-section-heading-light">
            <p className="drama-kicker">BUILT FOR THE NEXT EPISODE</p>
            <h2>Every detail keeps the story moving.</h2>
          </div>
          <div className="drama-benefit-grid">
            {benefits.map((benefit) => (
              <article key={benefit.number}>
                <span>{benefit.number}</span>
                <h3>{benefit.title}</h3>
                <p>{benefit.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="drama-final drama-shell drama-section">
        <img src="/timeless-icon.png" alt="" />
        <p className="drama-kicker">YOUR NEXT STORY IS WAITING</p>
        <h2>Start watching Timeless.</h2>
        <div className="drama-actions">
          <a className="drama-button drama-button-primary" href="https://apps.apple.com/app/id6740804440">
            App Store <span aria-hidden="true">↗</span>
          </a>
          <a className="drama-button drama-button-secondary" href="https://play.google.com/store/apps/details?id=com.wolfine.app" target="_blank" rel="noreferrer">
            Google Play <span aria-hidden="true">↗</span>
          </a>
        </div>
      </section>

      <footer className="drama-footer drama-shell">
        <div>
          <strong>TIMELESS</strong>
          <span>Short dramas for mobile</span>
        </div>
        <nav aria-label="Legal">
          <Link href="/download">Download</Link>
          <Link href="/studio">AI Studio</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/refund">Refunds</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <a href="mailto:info@timelessapp.ai">Contact</a>
        </nav>
        <span>© 2026 Timeless</span>
      </footer>
    </main>
  );
}
