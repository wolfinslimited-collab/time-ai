export const modelPickerCopy = {
  pickerAria: "Choose an AI model",
  kicker: "AI MODELS",
  title: "Choose the right engine",
  closeAria: "Close model picker",
  searchPlaceholder: "Search live models",
  listAria: "Live AI models",
  fromCredits: (credits: number) => `From ${credits} cr`,
  noMatches: (search: string) => `No live model matches “${search}”.`,
  liveThrough: "Live through Kie API",
  priceNote: "Price updates with every setting.",
} as const;
