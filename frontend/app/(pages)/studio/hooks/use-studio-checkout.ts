"use client";

import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { CreditPack } from "../../../lib/studio/credit-packs";
import { getMetaBrowserIdentifiers, trackMetaEvent } from "../../../meta-pixel";
import { messageForError } from "../../../lib/studio/studio-errors";
import { studioSupabase } from "../../../lib/studio/supabase";
import type { CheckoutConfirmation } from "../../../lib/studio/studio-types";
import type { useStudioInvoke } from "./use-studio-invoke";

type Invoke = ReturnType<typeof useStudioInvoke>;

export function useStudioCheckout(input: {
  user: User | null;
  authReady: boolean;
  catalogReady: boolean;
  creditPacks: CreditPack[];
  invoke: Invoke;
  setBalance: (balance: number) => void;
  setNotice: (message: string | null) => void;
  setAuthOpen: (open: boolean) => void;
}) {
  const { user, authReady, catalogReady, creditPacks, invoke, setBalance, setNotice, setAuthOpen } = input;
  const [pendingPack, setPendingPack] = useState<string | null>(null);
  const [checkoutConfirmation, setCheckoutConfirmation] = useState<CheckoutConfirmation | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const checkoutStarted = useRef(false);
  const handledCheckout = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    const checkoutResult = params.get("checkout");
    const sessionId = params.get("session_id");
    const purchaseEventId = params.get("meta_purchase_event_id") || undefined;

    const clearCheckoutParams = () => {
      const cleaned = new URL(window.location.href);
      cleaned.searchParams.delete("checkout");
      cleaned.searchParams.delete("session_id");
      cleaned.searchParams.delete("meta_purchase_event_id");
      window.history.replaceState({}, "", `${cleaned.pathname}${cleaned.search}${cleaned.hash}`);
    };

    if (checkoutResult === "cancel" || checkoutResult === "canceled") {
      const timer = window.setTimeout(() => setNotice("Checkout canceled. You were not charged."), 0);
      clearCheckoutParams();
      return () => window.clearTimeout(timer);
    }
    if (checkoutResult !== "success" || !sessionId || handledCheckout.current === sessionId) return;

    handledCheckout.current = sessionId;
    let active = true;
    let completed = false;
    const verifyCheckout = async () => {
      setNotice("Payment received. Confirming your credits…");
      for (let attempt = 0; attempt < 8 && active; attempt += 1) {
        const { data: checkout, error } = await studioSupabase
          .from("studio_stripe_checkouts")
          .select("credits,status,pack_key,amount_total,currency")
          .eq("stripe_session_id", sessionId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          completed = true;
          setNotice(messageForError(error));
          clearCheckoutParams();
          return;
        }
        if (checkout?.status === "paid") {
          const { data: wallet, error: walletError } = await studioSupabase
            .from("studio_credit_wallets")
            .select("balance")
            .eq("user_id", user.id)
            .maybeSingle();
          if (walletError) {
            completed = true;
            setNotice(messageForError(walletError));
            clearCheckoutParams();
            return;
          }
          const nextBalance = Number(wallet?.balance || 0);
          if (!active) return;
          setBalance(nextBalance);
          setNotice(null);
          setCheckoutConfirmation({ creditsAdded: Number(checkout.credits || 0), balance: nextBalance });
          const purchaseMarker = `timeless-meta-purchase:${purchaseEventId || sessionId}`;
          let shouldTrackPurchase = true;
          try {
            shouldTrackPurchase = window.localStorage.getItem(purchaseMarker) !== "sent";
          } catch {
            // Storage can be unavailable in hardened browser modes; checkout
            // URL cleanup and the in-memory guard still prevent normal repeats.
          }
          if (shouldTrackPurchase) {
            trackMetaEvent("Purchase", {
              content_ids: [String(checkout.pack_key || "studio-credits")],
              content_name: "Timeless Studio credits",
              content_type: "product",
              credits: Number(checkout.credits || 0),
              currency: String(checkout.currency || "usd").toUpperCase(),
              value: Number(checkout.amount_total || 0) / 100,
            }, purchaseEventId);
            try {
              window.localStorage.setItem(purchaseMarker, "sent");
            } catch {
              // The event is still queued even when persistent storage is blocked.
            }
          }
          completed = true;
          clearCheckoutParams();
          return;
        }
        if (["failed", "expired"].includes(String(checkout?.status || ""))) {
          completed = true;
          setNotice("Stripe could not complete this checkout. Your credits were not changed.");
          clearCheckoutParams();
          return;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
      }
      if (active) {
        completed = true;
        setNotice("Your payment is still being confirmed. Your balance will update automatically.");
        clearCheckoutParams();
      }
    };
    void verifyCheckout();
    return () => {
      active = false;
      if (!completed && handledCheckout.current === sessionId) handledCheckout.current = null;
    };
  }, [setBalance, setNotice, user]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const requested = url.searchParams.get("buy");
    let saved: string | null = null;
    try {
      saved = sessionStorage.getItem("timeless.pendingPack");
    } catch {
      // ignore
    }
    const selected = requested || saved;
    if (!selected) return;
    // Persist deep-link intent immediately; validate against live packs once catalog is ready.
    try {
      sessionStorage.setItem("timeless.pendingPack", selected);
    } catch {
      // ignore
    }
    if (requested) {
      url.searchParams.delete("buy");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
    if (!catalogReady) return;
    if (!creditPacks.some((pack) => pack.key === selected)) {
      try {
        sessionStorage.removeItem("timeless.pendingPack");
      } catch {
        // ignore
      }
      const timer = window.setTimeout(() => setNotice("That credit pack is not available right now."), 0);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => setPendingPack(selected), 0);
    return () => window.clearTimeout(timer);
  }, [catalogReady, creditPacks, setNotice]);

  async function startCheckout(packKey: string) {
    if (!user) return setAuthOpen(true);
    const initiateCheckoutEventId = crypto.randomUUID();
    const purchaseEventId = crypto.randomUUID();
    const pack = creditPacks.find((item) => item.key === packKey);
    if (pack) {
      trackMetaEvent("InitiateCheckout", {
        content_ids: [pack.key],
        content_name: `${pack.name} Studio credits`,
        content_type: "product",
        credits: pack.credits,
        currency: pack.currency.toUpperCase(),
        num_items: 1,
        value: pack.price_cents / 100,
      }, initiateCheckoutEventId);
    }
    setCheckingOut(true);
    setNotice("Opening secure checkout…");
    try {
      const result = await invoke<{ url: string }>("studio-stripe-checkout", {
        packKey,
        metaInitiateCheckoutEventId: initiateCheckoutEventId,
        metaPurchaseEventId: purchaseEventId,
        metaBrowserIdentifiers: getMetaBrowserIdentifiers(),
      });
      window.location.assign(result.url);
    } catch (error) {
      setNotice(messageForError(error));
    } finally {
      setCheckingOut(false);
    }
  }

  useEffect(() => {
    if (!authReady || !catalogReady || !pendingPack || checkoutStarted.current) return;
    if (!creditPacks.some((pack) => pack.key === pendingPack)) {
      const timer = window.setTimeout(() => {
        setPendingPack(null);
        try {
          sessionStorage.removeItem("timeless.pendingPack");
        } catch {
          // ignore
        }
      }, 0);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => {
      if (!user) {
        setAuthOpen(true);
        return;
      }
      if (checkoutStarted.current) return;
      checkoutStarted.current = true;
      try {
        sessionStorage.removeItem("timeless.pendingPack");
      } catch {
        // ignore
      }
      const packKey = pendingPack;
      setPendingPack(null);
      void startCheckout(packKey);
    }, 0);
    return () => window.clearTimeout(timer);
    // The ref prevents duplicate checkout creation across auth updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPack, user?.id, authReady, catalogReady, creditPacks]);

  return {
    pendingPack,
    setPendingPack,
    checkoutConfirmation,
    setCheckoutConfirmation,
    checkingOut,
    startCheckout,
  };
}
