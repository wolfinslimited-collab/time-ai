export const creditSuccessCopy = {
  closeAria: "Close",
  kicker: "PAYMENT CONFIRMED",
  title: "Credits added",
  ready: (credits: string) => `+${credits} credits are ready to use in your studio.`,
  balanceLabel: "New balance",
  creditsUnit: "credits",
  cta: "Start creating",
} as const;

export const newProjectCopy = {
  closeAria: "Close",
  kicker: "NEW CREATIVE SPACE",
  title: "Name your project.",
  nameLabel: "Project name",
  namePlaceholder: "Summer campaign",
  submit: "Create project",
} as const;

export const topUpCopy = {
  closeAria: "Close",
  kicker: "INSUFFICIENT CREDITS",
  title: "Not enough credits",
  lead: (needed: number, balance: number) =>
    `This run needs ${needed.toLocaleString()} credits. You have ${balance.toLocaleString()}.`,
  leadGeneric: "Choose a pack to keep creating in Studio.",
  credits: (n: number) => `${n.toLocaleString()} credits`,
  buy: "Buy",
  buying: "Opening checkout…",
  empty: "Credit packs are loading. Try again in a moment.",
  compare: "Compare all packs",
  balanceLabel: "Current balance",
} as const;
