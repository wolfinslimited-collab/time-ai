import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Timeless",
  description:
    "How the Timeless Short Dramas app collects, uses, protects, and deletes personal information.",
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true },
};

const sections = [
  {
    title: "1. Information we process",
    body: (
      <>
        <p>
          You can browse, subscribe, restore purchases, and watch Timeless
          without providing your name or email address. We create a
          pseudonymous guest identifier to protect subscription access.
        </p>
        <p>
          If you choose to create a Timeless account, we process your email
          address, display name, and authentication records. We also process
          saved series, viewing progress, likes, subscription entitlement,
          notification preferences, and a device push token when you allow
          notifications. Technical diagnostics may include app version,
          device platform, timestamps, and error information.
        </p>
        <p>
          On our website, the Meta Pixel processes page visits and limited
          purchase-funnel events so we can measure advertising. These events
          may include the page visited, browser and device information, a
          credit-pack identifier, and the purchase value and currency. We do
          not deliberately send creation prompts, generated files, email
          addresses, or Stripe checkout identifiers through the Meta Pixel.
        </p>
      </>
    ),
  },
  {
    title: "2. Why we use information",
    body: (
      <p>
        We use this information to provide secure sign-in, synchronize your
        library and viewing progress, authorize video playback, verify and
        restore subscriptions, deliver requested notifications, prevent abuse,
        respond to support requests, and improve app performance and
        reliability. We also use limited website events to measure and improve
        our advertising campaigns. We do not sell your personal information.
      </p>
    ),
  },
  {
    title: "3. Payments and subscriptions",
    body: (
      <>
        <p>
          Apple or Google processes mobile-app purchases and payment details
          under its own privacy policy. Timeless receives transaction
          identifiers and entitlement status needed to verify and restore access.
        </p>
        <p>
          Stripe processes Timeless Studio web purchases. Stripe handles
          checkout, payment, and fraud prevention under its privacy terms. We
          receive transaction, customer, and entitlement information needed to
          deliver credits and support your purchase. Timeless does not receive
          your full payment-card details from Apple, Google, or Stripe.
        </p>
      </>
    ),
  },
  {
    title: "4. Service providers and sharing",
    body: (
      <p>
        Timeless uses service providers that help operate the app, including
        Supabase for authentication and application data, secure cloud storage
        and content-delivery infrastructure for protected media, Firebase Cloud
        Messaging for notifications you request, Apple and Google for app
        distribution and purchases, and Stripe for Timeless Studio web
        transactions. We also use Meta for website advertising measurement
        and campaign optimization. We share only the information needed for
        these providers to perform their services. We may also disclose
        information when required by law or to protect users, rights holders,
        or the security of Timeless.
      </p>
    ),
  },
  {
    title: "5. Security and international processing",
    body: (
      <p>
        We use access controls, private storage, encrypted connections, and
        short-lived playback links to protect account and media data. Our
        service providers may process information in countries other than your
        own, subject to their contractual and legal safeguards. No online
        service can guarantee absolute security.
      </p>
    ),
  },
  {
    title: "6. Retention and deletion",
    body: (
      <p>
        We keep account information while your account is active and as needed
        for security, accounting, dispute resolution, or legal obligations.
        You can permanently delete a registered Timeless account from Profile
        in the app. Account deletion removes the account data controlled by
        Timeless, subject to limited legally required retention. Cancelling an
        Apple or Google subscription is managed separately through the store
        where you purchased it.
      </p>
    ),
  },
  {
    title: "7. Your choices and rights",
    body: (
      <p>
        Email registration is optional. Notifications are optional and can be
        disabled in your device settings. You may use guest access, update your
        display name after registering, sign out, request password recovery,
        and delete your registered account in the app. You can use browser
        controls and Meta&apos;s advertising settings to limit advertising cookies
        and related measurement. You may contact us to
        request access, correction, deletion, or help exercising privacy rights
        available in your region.
      </p>
    ),
  },
  {
    title: "8. Children",
    body: (
      <p>
        Timeless is not directed to children under the minimum digital-consent
        age in their country. If you believe a child has provided personal
        information to Timeless without appropriate permission, contact us so
        we can review and delete it.
      </p>
    ),
  },
  {
    title: "9. Changes to this policy",
    body: (
      <p>
        We may update this policy as Timeless, applicable law, or our service
        providers change. We will publish the revised policy here and update
        the effective date when changes are material.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <nav className="legal-nav shell" aria-label="Privacy policy navigation">
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
        <p className="kicker">LEGAL / PRIVACY</p>
        <h1>Privacy Policy</h1>
        <p className="legal-intro">
          This policy explains how Timeless Short Dramas, provided by Wolfins
          Limited AI Lab, collects, uses, shares, and protects information when
          you use the Timeless mobile app and related services.
        </p>
        <div className="legal-meta">
          <span>Effective 4 September 2026</span>
          <span>Timeless · com.wolfine.app</span>
        </div>
      </header>

      <div className="legal-layout shell">
        <aside className="legal-summary" aria-label="Policy summary">
          <p className="kicker">AT A GLANCE</p>
          <strong>No sale of personal information.</strong>
          <p>Account registration and notifications are optional.</p>
          <p>You can delete a registered account from Profile in the app.</p>
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
            <h2>Questions or privacy requests</h2>
            <p>
              Email us at{" "}
              <a href="mailto:info@timelessapp.ai">info@timelessapp.ai</a>.
              Please include enough information for us to identify your account
              and understand your request.
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
          <a href="/terms">Terms of Service</a>
          <span aria-hidden="true"> · </span>
          <a href="mailto:info@timelessapp.ai">info@timelessapp.ai</a>
        </div>
      </footer>
    </main>
  );
}
