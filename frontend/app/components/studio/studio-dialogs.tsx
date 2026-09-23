"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Plus, X } from "lucide-react";
import type { CreditPack } from "../../lib/studio/credit-packs";
import type { CheckoutConfirmation } from "../../lib/studio/studio-types";
import { creditSuccessCopy, newProjectCopy, topUpCopy } from "./copy/dialogs";

const fieldClass =
  "min-h-12 w-full rounded-xl border-0 bg-canvas px-3.5 text-sm text-foreground shadow-none outline-none placeholder:text-subtle focus:ring-1 focus:ring-elevated-hover";

const closeButtonClass =
  "absolute top-3.5 right-3.5 grid size-8 place-items-center rounded-lg bg-transparent text-muted transition-colors hover:bg-elevated-hover hover:text-foreground";

const primaryButtonClass =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-0 bg-accent px-4 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent-soft";

function formatPackPrice(pack: CreditPack) {
  const amount = pack.price_cents / 100;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: pack.currency.toUpperCase(),
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

export function CreditSuccessDialog({
  confirmation,
  onClose,
}: {
  confirmation: CheckoutConfirmation;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/75 p-7 backdrop-blur-lg"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="relative w-full max-w-sm rounded-2xl bg-elevated px-8 pb-7 pt-10 text-center shadow-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-credit-success-title"
      >
        <button
          className={closeButtonClass}
          onClick={onClose}
          type="button"
          aria-label={creditSuccessCopy.closeAria}
        >
          <X size={18} />
        </button>
        <span className="mx-auto mb-5 grid size-14 place-items-center rounded-full bg-success text-success-foreground ring-8 ring-success/10">
          <Check size={26} />
        </span>
        <p className="m-0 mb-2.5 font-mono text-xs tracking-widest text-accent">
          {creditSuccessCopy.kicker}
        </p>
        <h2
          id="studio-credit-success-title"
          className="m-0 text-2xl font-semibold tracking-tight text-foreground"
        >
          {creditSuccessCopy.title}
        </h2>
        <p className="mx-auto mt-2.5 mb-5 max-w-xs text-sm leading-relaxed text-muted">
          {creditSuccessCopy.ready(confirmation.creditsAdded.toLocaleString())}
        </p>
        <div className="mb-5 grid grid-cols-[1fr_auto_auto] items-baseline gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-left">
          <span className="text-xs text-muted">{creditSuccessCopy.balanceLabel}</span>
          <strong className="text-2xl tracking-tight text-foreground">
            {confirmation.balance.toLocaleString()}
          </strong>
          <small className="text-xs text-muted">{creditSuccessCopy.creditsUnit}</small>
        </div>
        <button className={primaryButtonClass} type="button" onClick={onClose}>
          {creditSuccessCopy.cta}
        </button>
      </section>
    </div>
  );
}

export function NewProjectDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState("");
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/75 p-7 backdrop-blur-lg"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="relative w-full max-w-sm rounded-2xl bg-elevated px-8 pb-7 pt-10 text-center shadow-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-project-title"
      >
        <button
          className={closeButtonClass}
          onClick={onClose}
          type="button"
          aria-label={newProjectCopy.closeAria}
        >
          <X size={18} />
        </button>
        <p className="m-0 mb-2.5 font-mono text-xs tracking-widest text-accent">
          {newProjectCopy.kicker}
        </p>
        <h2
          id="studio-project-title"
          className="m-0 text-2xl font-semibold tracking-tight text-foreground"
        >
          {newProjectCopy.title}
        </h2>
        <form
          className="mt-7 grid gap-3.5 text-left"
          onSubmit={(event) => {
            event.preventDefault();
            onCreate(name);
          }}
        >
          <label className="grid gap-2 text-sm font-medium text-muted">
            {newProjectCopy.nameLabel}
            <input
              className={fieldClass}
              autoFocus
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={newProjectCopy.namePlaceholder}
              required
            />
          </label>
          <button className={`${primaryButtonClass} mt-1`} type="submit">
            <Plus size={16} /> {newProjectCopy.submit}
          </button>
        </form>
      </section>
    </div>
  );
}

export function TopUpDialog({
  packs,
  balance,
  neededCredits,
  checkingOut,
  onClose,
  onSelectPack,
}: {
  packs: CreditPack[];
  balance: number;
  neededCredits?: number;
  checkingOut: boolean;
  onClose: () => void;
  onSelectPack: (packKey: string) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/75 p-7 backdrop-blur-lg"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && !checkingOut && onClose()}
    >
      <section
        className="relative w-full max-w-md rounded-2xl bg-elevated px-7 pb-7 pt-10 text-center shadow-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-top-up-title"
      >
        <button
          className={closeButtonClass}
          onClick={onClose}
          type="button"
          disabled={checkingOut}
          aria-label={topUpCopy.closeAria}
        >
          <X size={18} />
        </button>
        <p className="m-0 mb-2.5 font-mono text-xs tracking-widest text-accent">{topUpCopy.kicker}</p>
        <h2
          id="studio-top-up-title"
          className="m-0 text-2xl font-semibold tracking-tight text-foreground"
        >
          {topUpCopy.title}
        </h2>
        <p className="mx-auto mt-2.5 mb-5 max-w-sm text-sm leading-relaxed text-muted">
          {typeof neededCredits === "number"
            ? topUpCopy.lead(neededCredits, balance)
            : topUpCopy.leadGeneric}
        </p>
        <div className="mb-4 flex items-baseline justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left">
          <span className="text-xs text-muted">{topUpCopy.balanceLabel}</span>
          <strong className="text-lg tracking-tight text-foreground">{balance.toLocaleString()}</strong>
        </div>
        {packs.length ? (
          <ul className="m-0 grid list-none gap-2 p-0 text-left">
            {packs.map((pack) => (
              <li key={pack.key}>
                <button
                  type="button"
                  disabled={checkingOut}
                  onClick={() => onSelectPack(pack.key)}
                  className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left transition-colors hover:border-accent/30 hover:bg-accent/10 disabled:cursor-wait disabled:opacity-60"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <strong className="text-sm font-semibold text-foreground">{pack.name}</strong>
                      {pack.badge ? (
                        <span className="rounded-md bg-accent/15 px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-accent uppercase">
                          {pack.badge}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted">{topUpCopy.credits(pack.credits)}</span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-foreground">
                    {checkingOut ? topUpCopy.buying : formatPackPrice(pack)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 text-sm text-muted">{topUpCopy.empty}</p>
        )}
        <Link
          href="/pricing"
          className="mt-5 inline-block text-sm text-muted transition-colors hover:text-foreground"
          onClick={onClose}
        >
          {topUpCopy.compare}
        </Link>
      </section>
    </div>
  );
}
