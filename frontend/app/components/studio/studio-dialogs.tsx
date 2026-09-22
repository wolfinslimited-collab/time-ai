"use client";

import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import type { CheckoutConfirmation } from "../../lib/studio/studio-types";

export function CreditSuccessDialog({
  confirmation,
  onClose,
}: {
  confirmation: CheckoutConfirmation;
  onClose: () => void;
}) {
  return (
    <div
      className="studio-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="studio-modal studio-credit-success"
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-credit-success-title"
      >
        <button className="studio-modal-close" onClick={onClose} type="button" aria-label="Close">
          <X size={18} />
        </button>
        <span className="studio-success-icon">
          <Check size={26} />
        </span>
        <p className="studio-modal-kicker">PAYMENT CONFIRMED</p>
        <h2 id="studio-credit-success-title">Credits added</h2>
        <p className="studio-modal-copy">
          +{confirmation.creditsAdded.toLocaleString()} credits are ready to use in your studio.
        </p>
        <div className="studio-success-balance">
          <span>New balance</span>
          <strong>{confirmation.balance.toLocaleString()}</strong>
          <small>credits</small>
        </div>
        <button className="studio-modal-primary" type="button" onClick={onClose}>
          Start creating
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
      className="studio-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="studio-modal studio-project-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-project-title"
      >
        <button className="studio-modal-close" onClick={onClose} type="button" aria-label="Close">
          <X size={18} />
        </button>
        <p className="studio-modal-kicker">NEW CREATIVE SPACE</p>
        <h2 id="studio-project-title">Name your project.</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onCreate(name);
          }}
        >
          <label>
            Project name
            <input
              autoFocus
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Summer campaign"
              required
            />
          </label>
          <button className="studio-modal-primary" type="submit">
            <Plus size={16} /> Create project
          </button>
        </form>
      </section>
    </div>
  );
}
