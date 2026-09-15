import type { OccasionId } from "./types";
import {
  STYLE_CHAT_LOOK_MIX,
  type StylistLookMixSlotV1,
} from "./stylist-contract";

const OCCASION_IDS: OccasionId[] = ["work", "weekend", "night", "travel", "event"];

const OCCASION_KEYWORDS: Array<[OccasionId, RegExp]> = [
  ["work", /\b(work|office|meeting|client|interview|business|desk)\b/i],
  ["night", /\b(night|dinner|date|bar|cocktail|club|party)\b/i],
  ["travel", /\b(travel|flight|airport|trip|vacation|getaway)\b/i],
  ["event", /\b(event|wedding|gala|ceremony|graduation|formal)\b/i],
  ["weekend", /\b(weekend|brunch|casual|errands|coffee|saturday|sunday)\b/i],
];

export const STYLE_CHAT_OCCASION_NOTE_MAX = 280;

/** Re-export the Style chat 4-look recipe so UI and tests share one table. */
export { STYLE_CHAT_LOOK_MIX };
export type { StylistLookMixSlotV1 };

export function isOccasionId(value: unknown): value is OccasionId {
  return typeof value === "string" && OCCASION_IDS.includes(value as OccasionId);
}

/** Map free-text (or a chip id) to a packet occasion. Defaults to weekend. */
export function inferOccasionId(text: string, fallback: OccasionId = "weekend"): OccasionId {
  const raw = text.trim().toLowerCase();
  if (isOccasionId(raw)) return raw;
  for (const [id, re] of OCCASION_KEYWORDS) {
    if (re.test(raw)) return id;
  }
  return fallback;
}

export function parseOccasionIds(raw: unknown): OccasionId[] | undefined {
  const values = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(/[,\s]+/)
      : raw == null
        ? []
        : [raw];
  const ids = values.map((item) => String(item).trim()).filter(isOccasionId);
  return ids.length ? [...new Set(ids)] : undefined;
}

export function parseOccasionNote(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim().slice(0, STYLE_CHAT_OCCASION_NOTE_MAX);
  return trimmed || undefined;
}

/** Chip + optional details → occasions[] + occasionNote for the stylist packet. */
export function styleChatPacketFromInput(input: {
  occasion?: unknown;
  occasions?: unknown;
  occasionNote?: unknown;
  details?: unknown;
}): { occasions: OccasionId[]; occasionNote?: string } {
  const note = parseOccasionNote(input.occasionNote ?? input.details);
  const fromList = parseOccasionIds(input.occasions) ?? parseOccasionIds(input.occasion);
  if (fromList?.length) {
    return { occasions: fromList, ...(note ? { occasionNote: note } : {}) };
  }
  if (note) {
    return { occasions: [inferOccasionId(note)], occasionNote: note };
  }
  return { occasions: ["weekend"] };
}
