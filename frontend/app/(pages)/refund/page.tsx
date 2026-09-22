import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "../../components/brand";

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
    <main className="legal-page min-h-screen bg-neutral-950 text-stone-100">
      <nav className="legal-nav shell flex h-24 items-center justify-between border-b border-white/20 max-md:h-20" aria-label="Refund policy navigation">
        <Brand size="xs" subtitle="AI STUDIO" />
        <Link className="legal-back border-b border-neutral-600 py-2.5 text-sm font-semibold uppercase tracking-widest text-neutral-400 hover:text-lime-300" href="/pricing">
          <span className="max-md:hidden">View pricing  </span><span className="text-lime-300" aria-hidden="true">↗</span>
        </Link>
      </nav>

      <header className="legal-hero shell border-b border-white/20 py-24 pb-18 max-md:py-16 max-md:pb-13">
        <p className="kicker m-0 font-mono text-sm font-semibold uppercase tracking-widest text-neutral-500">LEGAL / REFUNDS</p>
        <h1 className="my-7 text-7xl md:text-8xl lg:text-9xl">Refund Policy</h1>
        <p className="legal-intro m-0 max-w-3xl text-2xl leading-snug text-neutral-400 md:text-3xl">
          This policy explains how refunds and failed generations are handled
          for Timeless Studio web purchases and Timeless mobile subscriptions.
        </p>
        <div className="legal-meta mt-10 flex flex-wrap gap-x-8 gap-y-4 font-mono text-sm uppercase tracking-widest text-neutral-500">
          <span>Effective 4 September 2026</span>
          <span>Timeless · timelessapp.ai</span>
        </div>
      </header>

      <div className="legal-layout shell grid gap-14 py-22 pb-30 max-md:grid-cols-1 max-md:gap-14 max-md:py-14 max-md:pb-20 lg:gap-28">
        <aside className="legal-summary sticky top-8 self-start bg-lime-300 p-7 text-neutral-950 max-md:static" aria-label="Refund policy summary">
          <p className="kicker m-0 font-mono text-sm font-semibold uppercase tracking-widest text-neutral-950/60">AT A GLANCE</p>
          <strong className="my-6 block text-3xl font-normal leading-tight">Support for every purchase channel.</strong>
          <p className="mt-3 border-t border-neutral-950/20 pt-3 text-sm leading-snug">Web payments are securely processed by Stripe and supported by Timeless.</p>
          <p className="mt-3 border-t border-neutral-950/20 pt-3 text-sm leading-snug">Eligible failed generations automatically restore credits.</p>
          <p className="mt-3 border-t border-neutral-950/20 pt-3 text-sm leading-snug">Apple and Google handle refunds for mobile subscriptions.</p>
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
            <h2 className="mt-4 mb-5 text-3xl font-normal leading-tight tracking-tight md:text-4xl">Need help?</h2>
            <p className="mb-4 text-base leading-relaxed text-neutral-600">
              Email <a className="font-bold text-lime-800 underline underline-offset-4" href="mailto:info@timelessapp.ai">info@timelessapp.ai</a> for help with a Timeless Studio web transaction.
            </p>
          </section>
        </article>
      </div>

      <footer className="legal-footer shell flex justify-between border-t border-white/20 py-7.5 pb-11 font-mono text-sm uppercase tracking-widest text-neutral-500 max-md:flex-col max-md:gap-4.5">
        <span>© 2026 Timeless</span>
        <div>
          <Link className="hover:text-lime-300" href="/pricing">Pricing</Link>
          <span aria-hidden="true"> · </span>
          <Link className="hover:text-lime-300" href="/terms">Terms of Service</Link>
          <span aria-hidden="true"> · </span>
          <Link className="hover:text-lime-300" href="/privacy">Privacy Policy</Link>
        </div>
      </footer>
    </main>
  );
}
