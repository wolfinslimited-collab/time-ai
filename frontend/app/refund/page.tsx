import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Refund Policy — Timeless",
  description:
    "Refund terms for Timeless Studio web purchases and Timeless mobile subscriptions.",
  alternates: { canonical: "/refund" },
  robots: { index: true, follow: true },
};

const sections = [
  {
    title: "1. Timeless Studio web purchases",
    body: (
      <>
        <p>
          Timeless Studio credit packs are one-time digital purchases with
          payments securely processed by Stripe. Except
          where applicable law requires otherwise, completed purchases are
          generally non-refundable after credits have been delivered or used.
        </p>
        <p>
          Timeless considers refund requests case by case. This does not limit
          any mandatory consumer rights available where you live.
        </p>
      </>
    ),
  },
  {
    title: "2. How to request a web-purchase refund",
    body: (
      <p>
        Email <a href="mailto:info@timelessapp.ai">info@timelessapp.ai</a> with the email address used for your Timeless account, the approximate purchase time, and the reason for your request.
      </p>
    ),
  },
  {
    title: "3. Failed generations and restored credits",
    body: (
      <p>
        If an eligible Studio generation fails before a result is delivered,
        the credits charged for that generation are restored automatically.
        Restored credits are not a cash refund. If restoration does not appear,
        contact us with the approximate time of the generation and your account email.
      </p>
    ),
  },
  {
    title: "4. Mobile app subscriptions",
    body: (
      <p>
        Timeless Short Dramas subscriptions purchased through the Apple App
        Store or Google Play are billed and refunded by the applicable store.
        Requests for those purchases must be submitted directly to Apple or
        Google under its policies. Deleting your Timeless account does not
        automatically cancel an active store subscription.
      </p>
    ),
  },
  {
    title: "5. Fraud, abuse, and chargebacks",
    body: (
      <p>
        Refunds may be refused where there is evidence of fraud, abuse,
        excessive or bad-faith requests, or a violation of our Terms. If you
        do not recognize a charge, contact us promptly so the
        transaction can be investigated.
      </p>
    ),
  },
  {
    title: "6. Changes to this policy",
    body: (
      <p>
        We may update this policy when our products, payment arrangements, or
        legal obligations change. We will publish the revised policy here and
        update its effective date.
      </p>
    ),
  },
];

export default function RefundPage() {
  return (
    <main className="legal-page">
      <nav className="legal-nav shell" aria-label="Refund policy navigation">
        <Link className="brand" href="/" aria-label="Timeless home">
          <img className="brand-mark" src="/timeless-icon.png" alt="" />
          <span>
            TIMELESS
            <small>AI STUDIO</small>
          </span>
        </Link>
        <Link className="legal-back" href="/pricing">
          View pricing <span aria-hidden="true">↗</span>
        </Link>
      </nav>

      <header className="legal-hero shell">
        <p className="kicker">LEGAL / REFUNDS</p>
        <h1>Refund Policy</h1>
        <p className="legal-intro">
          This policy explains how refunds and failed generations are handled
          for Timeless Studio web purchases and Timeless mobile subscriptions.
        </p>
        <div className="legal-meta">
          <span>Effective 4 September 2026</span>
          <span>Timeless · timelessapp.ai</span>
        </div>
      </header>

      <div className="legal-layout shell">
        <aside className="legal-summary" aria-label="Refund policy summary">
          <p className="kicker">AT A GLANCE</p>
          <strong>Support for every purchase channel.</strong>
          <p>Web payments are securely processed by Stripe and supported by Timeless.</p>
          <p>Eligible failed generations automatically restore credits.</p>
          <p>Apple and Google handle refunds for mobile subscriptions.</p>
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
            <h2>Need help?</h2>
            <p>
              Email <a href="mailto:info@timelessapp.ai">info@timelessapp.ai</a> for help with a Timeless Studio web transaction.
            </p>
          </section>
        </article>
      </div>

      <footer className="legal-footer shell">
        <span>© 2026 Timeless</span>
        <div>
          <Link href="/pricing">Pricing</Link>
          <span aria-hidden="true"> · </span>
          <Link href="/terms">Terms of Service</Link>
          <span aria-hidden="true"> · </span>
          <Link href="/privacy">Privacy Policy</Link>
        </div>
      </footer>
    </main>
  );
}
