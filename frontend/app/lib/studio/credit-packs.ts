export type CreditPack = {
  key: string;
  name: string;
  description: string;
  credits: number;
  price_cents: number;
  currency: string;
  badge: string | null;
};

export type AdminCreditPack = CreditPack & {
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
};

/** First-paint placeholders until `studio-catalog` returns live rows. */
export const placeholderCreditPacks: CreditPack[] = [
  {
    key: "spark",
    name: "Spark",
    description: "Find your next great idea.",
    credits: 1000,
    price_cents: 999,
    currency: "usd",
    badge: null,
  },
  {
    key: "creator",
    name: "Creator",
    description: "Make creating a daily habit.",
    credits: 3500,
    price_cents: 2999,
    currency: "usd",
    badge: "Most popular",
  },
  {
    key: "production",
    name: "Production",
    description: "Give every ambitious idea room.",
    credits: 10000,
    price_cents: 7999,
    currency: "usd",
    badge: "Best value",
  },
];

export const CREDIT_PACK_KEY_PATTERN = /^[a-z0-9][a-z0-9_-]{1,63}$/;

export function packArtSrc(key: string) {
  return `/pricing/${["spark", "creator", "production"].includes(key) ? key : "spark"}.svg`;
}

export function dollarsToCents(value: string | number) {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return Math.round(amount * 100);
}

export function centsToDollarsInput(cents: number) {
  return (Math.max(0, Number(cents) || 0) / 100).toFixed(2);
}
