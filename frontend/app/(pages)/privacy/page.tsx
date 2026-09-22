import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "../../components/brand";

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
    <main className="legal-page min-h-screen bg-neutral-950 text-stone-100">
      <nav className="legal-nav shell flex h-24 items-center justify-between border-b border-white/20 max-md:h-20" aria-label="Privacy policy navigation">
        <Brand size="xs" />
        <Link className="legal-back border-b border-neutral-600 py-2.5 text-sm font-semibold uppercase tracking-widest text-neutral-400 hover:text-lime-300" href="/">
          <span className="max-md:hidden">Back to Timeless  </span><span className="text-lime-300" aria-hidden="true">↗</span>
        </Link>
      </nav>

      <header className="legal-hero shell border-b border-white/20 py-24 pb-18 max-md:py-16 max-md:pb-13">
        <p className="kicker m-0 font-mono text-sm font-semibold uppercase tracking-widest text-neutral-500">LEGAL / PRIVACY</p>
        <h1 className="my-7 text-7xl md:text-8xl lg:text-9xl">Privacy Policy</h1>
        <p className="legal-intro m-0 max-w-3xl text-2xl leading-snug text-neutral-400 md:text-3xl">
          This policy explains how Timeless Short Dramas, provided by Wolfins
          Limited AI Lab, collects, uses, shares, and protects information when
          you use the Timeless mobile app and related services.
        </p>
        <div className="legal-meta mt-10 flex flex-wrap gap-x-8 gap-y-4 font-mono text-sm uppercase tracking-widest text-neutral-500">
          <span>Effective 4 September 2026</span>
          <span>Timeless · com.wolfine.app</span>
        </div>
      </header>

      <div className="legal-layout shell grid gap-14 py-22 pb-30 max-md:grid-cols-1 max-md:gap-14 max-md:py-14 max-md:pb-20 lg:gap-28">
        <aside className="legal-summary sticky top-8 self-start bg-lime-300 p-7 text-neutral-950 max-md:static" aria-label="Policy summary">
          <p className="kicker m-0 font-mono text-sm font-semibold uppercase tracking-widest text-neutral-950/60">AT A GLANCE</p>
          <strong className="my-6 block text-3xl font-normal leading-tight">No sale of personal information.</strong>
          <p className="mt-3 border-t border-neutral-950/20 pt-3 text-sm leading-snug">Account registration and notifications are optional.</p>
          <p className="mt-3 border-t border-neutral-950/20 pt-3 text-sm leading-snug">You can delete a registered account from Profile in the app.</p>
        </aside>

        <article className="legal-content max-w-3xl">
          {sections.map((section) => (
            <section key={section.title} className="mb-12 border-b border-white/20 pb-12 max-md:mb-9 max-md:pb-9">
              <h2 className="mb-5 text-3xl font-normal leading-tight tracking-tight md:text-4xl">{section.title}</h2>
              {section.body}
            </section>
          ))}

          <section className="legal-contact mb-12 border-b-0 bg-stone-100 p-9 text-neutral-950 max-md:p-6">
            <p className="kicker m-0 font-mono text-sm font-semibold uppercase tracking-widest text-neutral-500">CONTACT</p>
            <h2 className="mt-4 mb-5 text-3xl font-normal leading-tight tracking-tight md:text-4xl">Questions or privacy requests</h2>
            <p className="mb-4 text-base leading-relaxed text-neutral-600">
              Email us at{" "}
              <a className="font-bold text-lime-800 underline underline-offset-4" href="mailto:info@timelessapp.ai">info@timelessapp.ai</a>.
              Please include enough information for us to identify your account
              and understand your request.
            </p>
          </section>
        </article>
      </div>

      <footer className="legal-footer shell flex justify-between border-t border-white/20 py-7.5 pb-11 font-mono text-sm uppercase tracking-widest text-neutral-500 max-md:flex-col max-md:gap-4.5">
        <span>© 2026 Timeless</span>
        <div>
          <a className="hover:text-lime-300" href="/pricing">Pricing</a>
          <span aria-hidden="true"> · </span>
          <a className="hover:text-lime-300" href="/refund">Refund Policy</a>
          <span aria-hidden="true"> · </span>
          <a className="hover:text-lime-300" href="/terms">Terms of Service</a>
          <span aria-hidden="true"> · </span>
          <a className="hover:text-lime-300" href="mailto:info@timelessapp.ai">info@timelessapp.ai</a>
        </div>
      </footer>
    </main>
  );
}
