import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="w-full border-t border-foreground/10">
      <div className="mx-auto grid min-h-32 w-full max-w-6xl grid-cols-1 items-center gap-6 px-4 py-9 font-mono text-xs uppercase tracking-widest text-muted sm:px-6 md:grid-cols-[1fr_auto_auto] md:gap-12">
        <div className="grid gap-2">
          <strong className="text-foreground">TIMELESS</strong>
          <span className="text-subtle">Short dramas for mobile</span>
        </div>
        <nav className="flex flex-wrap gap-6" aria-label="Legal">
          <Link className="text-muted transition hover:text-accent-soft" href="/download">
            Download
          </Link>
          <Link className="text-muted transition hover:text-accent-soft" href="/studio">
            AI Studio
          </Link>
          <Link className="text-muted transition hover:text-accent-soft" href="/pricing">
            Pricing
          </Link>
          <Link className="text-muted transition hover:text-accent-soft" href="/refund">
            Refunds
          </Link>
          <Link className="text-muted transition hover:text-accent-soft" href="/privacy">
            Privacy
          </Link>
          <Link className="text-muted transition hover:text-accent-soft" href="/terms">
            Terms
          </Link>
          <a
            className="text-muted transition hover:text-accent-soft"
            href="mailto:info@timelessapp.ai"
          >
            Contact
          </a>
        </nav>
        <span className="text-subtle">© 2026 Timeless</span>
      </div>
    </footer>
  );
}
