"use client";

import type { Session } from "@supabase/supabase-js";
import { LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { AuthDialog, displayName } from "../../../../components/studio/auth-dialog";
import {
  type AdminCreditPack,
  centsToDollarsInput,
  CREDIT_PACK_KEY_PATTERN,
  dollarsToCents,
} from "../../../../lib/studio/credit-packs";
import { studioSupabase } from "../../../../lib/studio/supabase";

type PackForm = {
  key: string;
  name: string;
  description: string;
  credits: string;
  priceDollars: string;
  currency: string;
  badge: string;
  sort_order: string;
  is_active: boolean;
};

const emptyForm = (): PackForm => ({
  key: "",
  name: "",
  description: "",
  credits: "1000",
  priceDollars: "9.99",
  currency: "usd",
  badge: "",
  sort_order: "40",
  is_active: true,
});

function formFromPack(pack: AdminCreditPack): PackForm {
  return {
    key: pack.key,
    name: pack.name,
    description: pack.description,
    credits: String(pack.credits),
    priceDollars: centsToDollarsInput(pack.price_cents),
    currency: pack.currency || "usd",
    badge: pack.badge || "",
    sort_order: String(pack.sort_order ?? 0),
    is_active: pack.is_active,
  };
}

const fieldClass =
  "min-h-11 w-full rounded-xl border border-white/10 bg-canvas px-3.5 text-sm text-foreground outline-none placeholder:text-subtle focus:ring-1 focus:ring-accent";
const labelClass = "grid gap-1.5 text-xs font-medium tracking-wide text-muted uppercase";

function money(cents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

export function PacksAdmin() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [packs, setPacks] = useState<AdminCreditPack[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [form, setForm] = useState<PackForm>(emptyForm);
  const [formOpen, setFormOpen] = useState(false);

  const user = session?.user ?? null;

  const refreshAdmin = useCallback(async (nextSession: Session | null) => {
    if (!nextSession) {
      setIsAdmin(false);
      setAdminChecked(true);
      return;
    }
    const { data, error } = await studioSupabase.rpc("is_admin");
    if (error) {
      setIsAdmin(false);
      setNotice(error.message);
    } else {
      setIsAdmin(Boolean(data));
    }
    setAdminChecked(true);
  }, []);

  const loadPacks = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await studioSupabase
        .from("studio_credit_packs")
        .select("key,name,description,credits,price_cents,currency,badge,is_active,sort_order,created_at,updated_at")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      setPacks((data || []) as AdminCreditPack[]);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not load credit packs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void studioSupabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setAuthReady(true);
      void refreshAdmin(data.session);
    });
    const { data } = studioSupabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
      setAdminChecked(false);
      void refreshAdmin(nextSession);
      if (nextSession) setAuthOpen(false);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [refreshAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    void loadPacks();
  }, [isAdmin, loadPacks]);

  function openCreate() {
    setEditingKey(null);
    setForm(emptyForm());
    setFormOpen(true);
    setNotice(null);
  }

  function openEdit(pack: AdminCreditPack) {
    setEditingKey(pack.key);
    setForm(formFromPack(pack));
    setFormOpen(true);
    setNotice(null);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingKey(null);
    setForm(emptyForm());
  }

  async function savePack(event: FormEvent) {
    event.preventDefault();
    if (saving) return;

    const key = form.key.trim().toLowerCase();
    const name = form.name.trim();
    const description = form.description.trim();
    const credits = Math.floor(Number(form.credits));
    const price_cents = dollarsToCents(form.priceDollars);
    const currency = form.currency.trim().toLowerCase() || "usd";
    const badge = form.badge.trim() || null;
    const sort_order = Math.floor(Number(form.sort_order)) || 0;

    if (!editingKey && !CREDIT_PACK_KEY_PATTERN.test(key)) {
      setNotice("Key must match a-z0-9 with optional _ or -, 2–64 characters.");
      return;
    }
    if (!name) {
      setNotice("Name is required.");
      return;
    }
    if (!Number.isFinite(credits) || credits <= 0) {
      setNotice("Credits must be a positive whole number.");
      return;
    }
    if (!Number.isFinite(price_cents) || price_cents < 50) {
      setNotice("Price must be at least $0.50.");
      return;
    }
    if (!/^[a-z]{3}$/.test(currency)) {
      setNotice("Currency must be a 3-letter code (e.g. usd).");
      return;
    }

    setSaving(true);
    setNotice(null);
    try {
      if (editingKey) {
        const { error } = await studioSupabase
          .from("studio_credit_packs")
          .update({
            name,
            description,
            credits,
            price_cents,
            currency,
            badge,
            sort_order,
            is_active: form.is_active,
          })
          .eq("key", editingKey);
        if (error) throw error;
      } else {
        const { error } = await studioSupabase.from("studio_credit_packs").insert({
          key,
          name,
          description,
          credits,
          price_cents,
          currency,
          badge,
          sort_order,
          is_active: form.is_active,
        });
        if (error) throw error;
      }
      closeForm();
      await loadPacks();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save pack.");
    } finally {
      setSaving(false);
    }
  }

  async function setActive(pack: AdminCreditPack, is_active: boolean) {
    setNotice(null);
    const { error } = await studioSupabase
      .from("studio_credit_packs")
      .update({ is_active })
      .eq("key", pack.key);
    if (error) {
      setNotice(error.message);
      return;
    }
    await loadPacks();
  }

  async function deletePack(pack: AdminCreditPack) {
    if (!window.confirm(`Permanently delete “${pack.name}” (${pack.key})? Prefer deactivate if it has been sold.`)) {
      return;
    }
    setNotice(null);
    const { error } = await studioSupabase.from("studio_credit_packs").delete().eq("key", pack.key);
    if (error) {
      const message = error.message || "Delete failed.";
      setNotice(
        /foreign key|violates|referenced/i.test(message)
          ? "This pack has checkout history and cannot be deleted. Deactivate it instead."
          : message,
      );
      return;
    }
    if (editingKey === pack.key) closeForm();
    await loadPacks();
  }

  if (!authReady || (user && !adminChecked)) {
    return (
      <main className="grid min-h-screen place-items-center bg-canvas text-foreground">
        <p className="inline-flex items-center gap-2 text-sm text-muted">
          <LoaderCircle className="animate-spin" size={16} /> Checking access…
        </p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center bg-canvas px-6 text-foreground">
        <div className="max-w-md text-center">
          <p className="font-mono text-xs tracking-widest text-subtle uppercase">Admin</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Studio credit packs</h1>
          <p className="mt-3 text-sm text-muted">Sign in with an admin Timeless account to manage packs.</p>
          <button
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground"
            type="button"
            onClick={() => setAuthOpen(true)}
          >
            Sign in
          </button>
        </div>
        {authOpen && (
          <AuthDialog
            onClose={() => setAuthOpen(false)}
            onCancel={() => setAuthOpen(false)}
            onNotice={setNotice}
          />
        )}
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="grid min-h-screen place-items-center bg-canvas px-6 text-foreground">
        <div className="max-w-md text-center">
          <p className="font-mono text-xs tracking-widest text-subtle uppercase">Access denied</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Admin only</h1>
          <p className="mt-3 text-sm text-muted">
            Signed in as {displayName(user)}, but this account is not an admin.
          </p>
          <Link className="mt-6 inline-flex text-sm text-accent-soft hover:text-accent" href="/studio">
            Back to Studio
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-canvas text-foreground">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div>
            <p className="font-mono text-xs tracking-widest text-subtle uppercase">Admin</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Studio credit packs</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted">{displayName(user)}</span>
            <Link className="text-muted hover:text-foreground" href="/studio">
              Studio
            </Link>
            <Link className="text-muted hover:text-foreground" href="/pricing">
              Pricing
            </Link>
            <button
              className="rounded-lg border border-white/10 px-3 py-2 text-muted hover:text-foreground"
              type="button"
              onClick={() => void studioSupabase.auth.signOut()}
            >
              Sign out
            </button>
            <button
              className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 font-semibold text-accent-foreground"
              type="button"
              onClick={openCreate}
            >
              <Plus size={16} /> New pack
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-6 px-6 py-8">
        {notice && (
          <p className="rounded-xl bg-accent-deep/20 px-4 py-3 text-sm text-accent-soft" role="alert">
            {notice}
          </p>
        )}

        {formOpen && (
          <form className="grid gap-4 rounded-2xl border border-white/10 bg-surface p-5" onSubmit={savePack}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{editingKey ? `Edit ${editingKey}` : "Create pack"}</h2>
              <button className="text-sm text-muted hover:text-foreground" type="button" onClick={closeForm}>
                Cancel
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={labelClass}>
                Key
                <input
                  className={fieldClass}
                  value={form.key}
                  disabled={Boolean(editingKey)}
                  onChange={(event) => setForm((current) => ({ ...current, key: event.target.value }))}
                  placeholder="spark"
                  required={!editingKey}
                />
              </label>
              <label className={labelClass}>
                Name
                <input
                  className={fieldClass}
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  required
                />
              </label>
              <label className={`${labelClass} sm:col-span-2`}>
                Description
                <textarea
                  className={`${fieldClass} min-h-20 py-3`}
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                />
              </label>
              <label className={labelClass}>
                Credits
                <input
                  className={fieldClass}
                  type="number"
                  min={1}
                  step={1}
                  value={form.credits}
                  onChange={(event) => setForm((current) => ({ ...current, credits: event.target.value }))}
                  required
                />
              </label>
              <label className={labelClass}>
                Price (USD)
                <input
                  className={fieldClass}
                  type="number"
                  min={0.5}
                  step={0.01}
                  value={form.priceDollars}
                  onChange={(event) => setForm((current) => ({ ...current, priceDollars: event.target.value }))}
                  required
                />
              </label>
              <label className={labelClass}>
                Currency
                <input
                  className={fieldClass}
                  value={form.currency}
                  onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value }))}
                  maxLength={3}
                  required
                />
              </label>
              <label className={labelClass}>
                Badge
                <input
                  className={fieldClass}
                  value={form.badge}
                  onChange={(event) => setForm((current) => ({ ...current, badge: event.target.value }))}
                  placeholder="Most popular"
                />
              </label>
              <label className={labelClass}>
                Sort order
                <input
                  className={fieldClass}
                  type="number"
                  step={1}
                  value={form.sort_order}
                  onChange={(event) => setForm((current) => ({ ...current, sort_order: event.target.value }))}
                />
              </label>
              <label className="flex items-center gap-3 self-end pb-2 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))}
                />
                Active (visible on Studio / Pricing)
              </label>
            </div>
            <button
              className="inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground disabled:opacity-60"
              disabled={saving}
              type="submit"
            >
              {saving ? (
                <>
                  <LoaderCircle className="animate-spin" size={16} /> Saving…
                </>
              ) : editingKey ? (
                "Save changes"
              ) : (
                "Create pack"
              )}
            </button>
          </form>
        )}

        <section className="overflow-x-auto rounded-2xl border border-white/10 bg-surface">
          {loading ? (
            <p className="inline-flex items-center gap-2 px-5 py-8 text-sm text-muted">
              <LoaderCircle className="animate-spin" size={16} /> Loading packs…
            </p>
          ) : packs.length === 0 ? (
            <p className="px-5 py-8 text-sm text-muted">No credit packs yet. Create the first one.</p>
          ) : (
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead className="border-b border-white/10 text-xs tracking-wide text-subtle uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">Pack</th>
                  <th className="px-4 py-3 font-medium">Credits</th>
                  <th className="px-4 py-3 font-medium">Price</th>
                  <th className="px-4 py-3 font-medium">Sort</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {packs.map((pack) => (
                  <tr className="border-b border-white/5 align-top" key={pack.key}>
                    <td className="px-4 py-4">
                      <div className="font-medium text-foreground">{pack.name}</div>
                      <div className="mt-0.5 font-mono text-xs text-subtle">{pack.key}</div>
                      {pack.badge && <div className="mt-1 text-xs text-accent-soft">{pack.badge}</div>}
                      {pack.description && <p className="mt-2 max-w-xs text-xs text-muted">{pack.description}</p>}
                    </td>
                    <td className="px-4 py-4 tabular-nums">{pack.credits.toLocaleString("en-US")}</td>
                    <td className="px-4 py-4 tabular-nums">{money(pack.price_cents, pack.currency)}</td>
                    <td className="px-4 py-4 tabular-nums">{pack.sort_order}</td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs ${
                          pack.is_active ? "bg-success/15 text-success" : "bg-elevated text-subtle"
                        }`}
                      >
                        {pack.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-muted hover:text-foreground"
                          type="button"
                          onClick={() => openEdit(pack)}
                        >
                          <Pencil size={13} /> Edit
                        </button>
                        <button
                          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-muted hover:text-foreground"
                          type="button"
                          onClick={() => void setActive(pack, !pack.is_active)}
                        >
                          {pack.is_active ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-muted hover:text-accent-soft"
                          type="button"
                          onClick={() => void deletePack(pack)}
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  );
}
