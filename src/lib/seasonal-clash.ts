export type SeasonalClash = {
  id: string;
  ticker: string;
  masthead: string;
  /** Deep field — garnet for Fall 26. */
  cover: string;
  cream: string;
  /** Clash pair — lavender for Fall 26. */
  accent: string;
};

export const SEASONAL_CLASHES = {
  "fall-26": {
    id: "fall-26",
    ticker: "Fall 26 color trend: garnet and lavender clash",
    masthead: "EDITORIAL 07 — FW27",
    cover: "#5C1A26",
    cream: "#F4EDE3",
    accent: "#C9B4D4",
  },
} as const satisfies Record<string, SeasonalClash>;

export type SeasonalClashId = keyof typeof SEASONAL_CLASHES;

/** Swap this (or pass `clashId` to the cover) to rotate season palette. */
export const ACTIVE_SEASONAL_CLASH_ID: SeasonalClashId = "fall-26";

/**
 * Daily ticker bank for the cream trend pill (Fall 26).
 * Edit this list to add/remove lines — easy data-driven rotation.
 * Rotation uses America/Los_Angeles calendar day (documented lock).
 */
export const FALL_26_TREND_TICKERS = [
  "Fall 26 color trend: garnet and lavender clash",
  "Fall 26 color trend: chocolate and ivory",
  "Fall 26 color trend: oxblood and camel",
  "Fall 26 color trend: forest and cream",
] as const;

/** YYYY-MM-DD in America/Los_Angeles. */
export function pacificCalendarDay(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Stable day index from PT calendar date (not UTC). */
export function pacificDayIndex(now: Date = new Date()): number {
  const day = pacificCalendarDay(now);
  // en-CA → YYYY-MM-DD; parse as UTC noon to avoid TZ drift on the number.
  const [y, m, d] = day.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

export function trendTickerForDay(
  bank: readonly string[] = FALL_26_TREND_TICKERS,
  now: Date = new Date()
): string {
  if (!bank.length) return SEASONAL_CLASHES[ACTIVE_SEASONAL_CLASH_ID].ticker;
  const idx = ((pacificDayIndex(now) % bank.length) + bank.length) % bank.length;
  return bank[idx]!;
}

export function seasonalClash(id: SeasonalClashId = ACTIVE_SEASONAL_CLASH_ID): SeasonalClash {
  const base = SEASONAL_CLASHES[id];
  if (id === "fall-26") {
    return { ...base, ticker: trendTickerForDay(FALL_26_TREND_TICKERS) };
  }
  return base;
}
