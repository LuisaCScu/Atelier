/** Stylist outerwear / seasonality band for the current calendar month. */
export type ClimateBand = "hot" | "warm" | "mild" | "cool" | "cold";

export type LocaleV1 = {
  city?: string;
  region?: string;
  country?: string;
  timezone?: string;
  lat?: number;
  lng?: number;
};

const BANDS = new Set<ClimateBand>(["hot", "warm", "mild", "cool", "cold"]);

export function normalizeClimateBand(raw: string | null | undefined): ClimateBand | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase() as ClimateBand;
  return BANDS.has(v) ? v : null;
}

/** Rough US climate from IANA timezone + month (1–12). Soft heuristic until user picks a city. */
export function climateBandFromTimezone(timezone: string | undefined, month: number): ClimateBand {
  const tz = (timezone || "").trim();
  const m = month >= 1 && month <= 12 ? month : new Date().getUTCMonth() + 1;

  // Hot arid / tropical-leaning
  if (/Phoenix|Honolulu|Puerto_Rico|Jamaica|Mexico_City/i.test(tz)) {
    if (m >= 5 && m <= 9) return "hot";
    if (m === 4 || m === 10) return "warm";
    return "mild";
  }

  // Pacific coastal (CA, OR, WA, Vancouver) — mild summers, cool winters
  if (/Los_Angeles|Vancouver|Tijuana|Seattle|Portland/i.test(tz)) {
    if (m >= 6 && m <= 9) return "warm";
    if (m === 4 || m === 5 || m === 10) return "mild";
    return "cool";
  }

  // Mountain / northern plains — colder winters
  if (/Denver|Boise|Salt_Lake|Helena|Billings|Anchorage/i.test(tz)) {
    if (m >= 6 && m <= 8) return "warm";
    if (m === 5 || m === 9) return "mild";
    if (m === 4 || m === 10) return "cool";
    return "cold";
  }

  // Northeast / Midwest
  if (/New_York|Chicago|Detroit|Toronto|Boston|Montreal/i.test(tz)) {
    if (m >= 6 && m <= 8) return "warm";
    if (m === 5 || m === 9) return "mild";
    if (m === 4 || m === 10) return "cool";
    return "cold";
  }

  // Generic US / unknown — Stylist’s prior default was mild US
  if (m >= 6 && m <= 8) return "warm";
  if (m === 4 || m === 5 || m === 9 || m === 10) return "mild";
  if (m === 3 || m === 11) return "cool";
  return "cool";
}

export function localeFromTimezone(timezone: string | undefined): LocaleV1 {
  const tz = (timezone || "").trim();
  if (/Los_Angeles/i.test(tz)) return { region: "CA", country: "US", timezone: tz };
  if (/Vancouver/i.test(tz)) return { region: "BC", country: "CA", timezone: tz };
  if (/New_York/i.test(tz)) return { region: "NY", country: "US", timezone: tz };
  if (/Chicago/i.test(tz)) return { region: "IL", country: "US", timezone: tz };
  if (/Denver/i.test(tz)) return { region: "CO", country: "US", timezone: tz };
  if (/Phoenix/i.test(tz)) return { region: "AZ", country: "US", timezone: tz };
  if (/Seattle/i.test(tz)) return { region: "WA", country: "US", timezone: tz };
  if (tz) return { country: "US", timezone: tz };
  return { country: "US" };
}

export function resolveLocaleAndClimate(input: {
  locale?: LocaleV1 | null;
  climateBand?: ClimateBand | null;
  timezone?: string | null;
  now?: Date;
}): { locale: LocaleV1; climateBand: ClimateBand } {
  const now = input.now ?? new Date();
  const month = now.getMonth() + 1;
  const timezone = input.timezone?.trim() || input.locale?.timezone || undefined;
  const inferred = localeFromTimezone(timezone);
  const locale: LocaleV1 = {
    ...inferred,
    ...Object.fromEntries(
      Object.entries(input.locale ?? {}).filter(([, v]) => v != null && String(v).trim() !== "")
    ),
    ...(timezone ? { timezone } : {}),
  };
  const climateBand =
    input.climateBand ??
    climateBandFromTimezone(locale.timezone || timezone, month);
  return { locale, climateBand };
}
