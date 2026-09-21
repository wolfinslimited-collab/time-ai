import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — Timeless",
  description:
    "The terms that apply when you use the Timeless Short Dramas app and related services.",
  alternates: { canonical: "/terms" },
  robots: { index: true, follow: true },
};

const sections = [
  {
    title: "1. Using Timeless",
    body: (
      <p>
        These Terms govern your use of the Timeless Short Dramas mobile app,
        website, video service, and related features provided by Wolfins
        Limited AI Lab. By using Timeless, you agree to these Terms and our
        Privacy Policy. If you do not agree, do not use the service.
      </p>
    ),
  },
  {
    title: "2. Eligibility and accounts",
    body: (
      <p>
        You must be legally able to enter into these Terms in your country. If
        you are below the age of legal majority, a parent or guardian must
        approve your use. You are responsible for the accuracy of account
        information, protecting your sign-in credentials, and activity on your
        account. Guest access may be lost if you delete the app or change
        devices before creating an account.
      </p>
    ),
  },
  {
    title: "3. Subscriptions, billing, and cancellation",
    body: (
      <>
        <p>
          Mobile subscriptions unlock eligible Timeless Short Dramas content
          for the stated billing period. Prices, trial or introductory terms,
          taxes, and renewal details are shown before purchase. Mobile
          subscriptions renew automatically unless cancelled through the Apple
          App Store or Google Play account used to purchase them.
        </p>
        <p>
          Apple or Google processes payments, cancellations, and refunds under
          its applicable rules. Deleting a Timeless account does not
          automatically cancel a store subscription. You can restore a valid
          purchase in the app using the same store account.
        </p>
        <p>
          Timeless Studio web credit packs are one-time purchases and do not
          renew automatically. Payments are securely processed by Stripe. The
          current pack price, applicable
          taxes, and credit amount are shown before checkout. Refund requests
          are handled under our <Link href="/refund">Refund Policy</Link> and
          any mandatory consumer rights that apply.
        </p>
      </>
    ),
  },
  {
    title: "4. Content licence",
    body: (
      <p>
        Timeless and its licensors own the service, series, episodes,
        subtitles, artwork, trademarks, and software. We grant you a limited,
        personal, non-exclusive, non-transferable, revocable licence to stream
        available content for private, non-commercial viewing while your
        access is valid. No ownership rights are transferred to you.
      </p>
    ),
  },
  {
    title: "5. Acceptable use",
    body: (
      <p>
        You may not copy, record, download, redistribute, sell, publicly
        perform, scrape, reverse engineer, bypass access controls, share
        credentials commercially, interfere with the service, introduce
        malicious code, misuse another person&apos;s account, or use Timeless in
        violation of law or third-party rights. We may investigate and limit
        access when reasonably necessary to protect users, content, or the
        service.
      </p>
    ),
  },
  {
    title: "6. Availability and changes",
    body: (
      <p>
        Series, episodes, languages, quality levels, features, and device
        support may vary by country and may change as licences or technical
        requirements change. We may update, suspend, or discontinue parts of
        Timeless. We will use reasonable care but do not promise uninterrupted
        or error-free availability.
      </p>
    ),
  },
  {
    title: "7. Suspension and termination",
    body: (
      <p>
        You may stop using Timeless at any time and may delete a registered
        account from Profile in the app. We may suspend or terminate access for
        material or repeated violations of these Terms, fraud, security risks,
        legal requirements, or conduct that harms Timeless, its users, or
        rights holders. Provisions that by their nature should survive will
        remain in effect.
      </p>
    ),
  },
  {
    title: "8. Disclaimers and liability",
    body: (
      <p>
        To the extent permitted by law, Timeless is provided on an “as is” and
        “as available” basis. We exclude implied warranties that may legally be
        excluded. Wolfins Limited AI Lab is not liable for indirect,
        incidental, special, consequential, or punitive loss, or loss of data,
        revenue, or opportunity. Nothing in these Terms excludes liability or
        consumer rights that cannot lawfully be excluded.
      </p>
    ),
  },
  {
    title: "9. Changes to these Terms",
    body: (
      <p>
        We may update these Terms when the service, law, or business changes.
        We will publish the updated version here and revise the effective date.
        If a material change requires notice or consent under applicable law,
        we will provide it before the change takes effect.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <main className="legal-page">
      <nav className="legal-nav shell" aria-label="Terms navigation">
        <Link className="brand" href="/" aria-label="Timeless home">
          <img className="brand-mark" src="/timeless-icon.png" alt="" />
          <span>
            TIMELESS
            <small>SHORT DRAMAS</small>
          </span>
        </Link>
        <Link className="legal-back" href="/">
          Back to Timeless <span aria-hidden="true">↗</span>
        </Link>
      </nav>

      <header className="legal-hero shell">
        <p className="kicker">LEGAL / TERMS</p>
        <h1>Terms of Service</h1>
        <p className="legal-intro">
          These Terms explain the rules for using Timeless Short Dramas,
          including accounts, subscriptions, and licensed video content.
        </p>
        <div className="legal-meta">
          <span>Effective 4 September 2026</span>
          <span>Timeless · com.wolfine.app</span>
        </div>
      </header>

      <div className="legal-layout shell">
        <aside className="legal-summary" aria-label="Terms summary">
          <p className="kicker">AT A GLANCE</p>
          <strong>Personal streaming access.</strong>
          <p>Mobile billing is managed by Apple or Google.</p>
          <p>Studio web payments are securely processed by Stripe.</p>
          <p>Respect content rights and keep your account secure.</p>
        </aside>

        <article className="legal-content">
          {sections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              {section.body}
            </section>
          ))}

          <section className="legal-contact">
            <p className="kicker">CONTACT</p>
            <h2>Questions about these Terms</h2>
            <p>
              Email us at{" "}
              <a href="mailto:info@timelessapp.ai">info@timelessapp.ai</a>.
            </p>
          </section>
        </article>
      </div>

      <footer className="legal-footer shell">
        <span>© 2026 Timeless</span>
        <div>
          <a href="/pricing">Pricing</a>
          <span aria-hidden="true"> · </span>
          <a href="/refund">Refund Policy</a>
          <span aria-hidden="true"> · </span>
          <a href="/privacy">Privacy Policy</a>
          <span aria-hidden="true"> · </span>
          <a href="mailto:info@timelessapp.ai">info@timelessapp.ai</a>
        </div>
      </footer>
    </main>
  );
}
