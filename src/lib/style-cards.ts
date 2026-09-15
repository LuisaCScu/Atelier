import bank from "../../data/style-cards.v1.json";
import { FRIEND_GENDER } from "./friend";
import type { ChromaId, GenderId, ProfileSession, SeasonId, ShapeId, UndertoneId, ValueId } from "./types";

/** Locked v2 aesthetic ids for quiz + stylistRequest.likedAesthetics. */
export const LOCKED_AESTHETICS = [
  "scandi-clean",
  "french-girl-ease",
  "poet-soft",
  "bright-accent",
  "animal-mark",
  "leather-edge",
  "cowgirl-west",
  "groupie-rock",
] as const;
export type LockedAesthetic = (typeof LOCKED_AESTHETICS)[number];

export const AESTHETIC_LABELS: Record<LockedAesthetic, string> = {
  "scandi-clean": "Scandi Clean",
  "french-girl-ease": "French Girl Ease",
  "poet-soft": "Poet Soft",
  "bright-accent": "Bright Accent",
  "animal-mark": "Animal Mark",
  "leather-edge": "Leather Edge",
  "cowgirl-west": "Cowgirl West",
  "groupie-rock": "Groupie Rock",
};

/** Old house labels → new ids (Stylist 2026-09-10 legacy map). */
const LEGACY_AESTHETIC_MAP: Record<string, LockedAesthetic> = {
  "Paddock Cashmere": "scandi-clean",
  "Paddock leather-heavy": "cowgirl-west",
  Paddock: "cowgirl-west",
  "Harbor Granddaughter": "french-girl-ease",
  Harbor: "french-girl-ease",
  "Harvest Tweed": "bright-accent",
  Harvest: "bright-accent",
};

export function normalizeAestheticId(raw: string | null | undefined): LockedAesthetic | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if ((LOCKED_AESTHETICS as readonly string[]).includes(trimmed)) return trimmed as LockedAesthetic;
  const legacy = LEGACY_AESTHETIC_MAP[trimmed];
  if (legacy) return legacy;
  const lower = trimmed.toLowerCase();
  for (const id of LOCKED_AESTHETICS) {
    if (id === lower || AESTHETIC_LABELS[id].toLowerCase() === lower) return id;
  }
  return null;
}

export type StyleCardColor = {
  seasons: string[];
  undertone: string[];
  value: string[];
  chroma: string[];
  nearFace: string[];
  avoidIf?: {
    seasons?: string[];
    undertone?: string[];
    value?: string[];
    chroma?: string[];
  };
};

export type StyleCardV1 = {
  id: string;
  gender: GenderId;
  image: string;
  alt: string;
  aesthetics: string[];
  secondaryAesthetics?: string[];
  silhouette: string[];
  shapeFit: string[];
  color: StyleCardColor;
  occasions: string[];
  formulaHint: string;
  weight: number;
  colorIntensity: "muted" | "mixed" | "bright";
  fit: "fitted" | "relaxed" | "oversized";
  accessories: "minimal" | "moderate" | "statement";
  /** Bag/jewelry scale — separate from accessories finish amount. */
  accessoryScale?: "small" | "medium" | "big";
  /** Jewelry amount lean (separate from bag accessoryScale). */
  jewelryAmount?: "minimal" | "layered" | "stack";
  structureVsDrape: "structured" | "mixed" | "drapey";
  coverage: "open" | "balanced" | "covered";
  patternVsSolid: "solid" | "textured" | "printed";
  footwear: "heels" | "flats" | "boots" | "bare/sandal";
  formality: "casual" | "smart-casual" | "polished";
  statementLevel: "quiet" | "balanced" | "bold";
  signalTags: string[];
  /** Look-age bands this card may appear for (lookAge filter). Required on new cards; defaults to ["mid"] when missing. */
  ageBands: Array<"younger" | "mid" | "mature">;
  source?: { license?: string; url?: string; host?: string };
};

export const SWIPE_DECK_COUNT = 14;


/** Near-duplicate fingerprint (dHash group). Same visualKey ⇒ same look — session/deck hard-unique. */
export const STYLE_CARD_VISUAL_KEY: Record<string, string> = {
  "dx-solid-column": "dx-mat-coat-column",
  "dx-floral-dress": "dx-floral-dress",
  "dx-animal-punct": "am-leopard-scarf",
  "dx-color-clash": "dx-color-clash",
  "dx-quiet-accent": "dx-quiet-accent",
  "dx-all-neutral": "dx-all-neutral",
  "dx-baggy-oversized": "dx-baggy-oversized",
  "dx-tight-fitted": "dx-tight-fitted",
  "dx-big-tote": "dx-big-tote",
  "dx-mini-bag": "dx-mini-bag",
  "dx-dress-boots": "dx-dress-boots",
  "dx-print-skirt-tee": "dx-print-skirt-tee",
  "ba-cobalt-elevate": "ba-cobalt-elevate",
  "am-leopard-scarf": "am-leopard-scarf",
  "ht-rust-suit-field": "ht-rust-suit-field",
  "fg-breton-trench": "fg-breton-trench",
  "dx-sporty-polish": "dx-sporty-polish",
  "dx-casual-soft-baggy": "dx-casual-soft-baggy",
  "dx-short-dress": "dx-short-dress",
  "dx-rock-ripped": "dx-rock-ripped",
  "dx-cowgirl-west": "dx-cowgirl-west",
  "dx-groupie-rock": "dx-groupie-rock",
  "dx-y-crop-cargo": "dx-casual-soft-baggy",
  "dx-y-tennis-skirt": "dx-y-tennis-skirt",
  "dx-y-slip-mini": "dx-y-slip-mini",
  "dx-y-hoodie-bike": "dx-baggy-oversized",
  "dx-y-denim-maxi": "dx-y-denim-maxi",
  "dx-y-party-sequin": "dx-color-clash",
  "dx-y-cargo-set": "dx-all-neutral",
  "dx-y-mesh-layer": "dx-tight-fitted",
  "dx-y-pastel-clash": "dx-floral-dress",
  "dx-y-platform-boot": "dx-rock-ripped",
  "dx-m-work-chic": "ba-cobalt-elevate",
  "dx-m-leather-trouser": "dx-m-leather-trouser",
  "dx-mat-column-dress": "dx-mat-coat-column",
  "dx-mat-knit-set": "dx-mat-knit-set",
  "dx-mat-coat-column": "dx-mat-coat-column",
  "dx-mat-silk-wide": "dx-mat-silk-wide",
  "dx-y-midriff-tie": "dx-y-midriff-tie",
  "dx-y-tube-cargo": "dx-y-tube-cargo",
  "dx-y-cutout-set": "dx-y-cutout-set",
  "dx-y-blazer-shorts": "dx-y-blazer-shorts",
  "dx-y-floral-shorts": "dx-y-floral-shorts",
  "dx-y-athletic-short": "dx-y-athletic-short",
  "dx-y-lowrise-crop": "dx-y-lowrise-crop",
  "dx-y-western-shorts": "dx-y-western-shorts",
  "dx-jewelry-one-necklace": "dx-jewelry-one-necklace",
  "dx-jewelry-layered-necklaces": "dx-jewelry-layered-necklaces",
  "dx-jewelry-simple-wrist": "dx-jewelry-simple-wrist",
  "dx-jewelry-stack-wrist": "dx-jewelry-stack-wrist",
};

export function styleCardVisualKey(card: StyleCardV1): string {
  return STYLE_CARD_VISUAL_KEY[card.id] ?? card.id;
}


export type StyleFilterInput = {
  gender?: GenderId | null;
  shape?: ShapeId | null;
  season?: SeasonId | null;
  undertone?: UndertoneId | null;
  value?: ValueId | null;
  chroma?: ChromaId | null;
  lookAge?: "younger" | "mid" | "mature" | "mixed" | null;
  shownAt?: Record<string, number>;
  deckIds?: string[];
};

const SEASON_ALIASES: Record<string, SeasonId> = {
  "light-spring": "light-spring",
  "true-spring": "true-spring",
  "warm-spring": "true-spring",
  "bright-spring": "bright-spring",
  "clear-spring": "bright-spring",
  "light-summer": "light-summer",
  "true-summer": "true-summer",
  "cool-summer": "true-summer",
  "soft-summer": "soft-summer",
  "soft-autumn": "soft-autumn",
  "true-autumn": "true-autumn",
  "warm-autumn": "true-autumn",
  "dark-autumn": "dark-autumn",
  "deep-autumn": "dark-autumn",
  "dark-winter": "dark-winter",
  "deep-winter": "dark-winter",
  "true-winter": "true-winter",
  "bright-winter": "bright-winter",
};

const SHAPE_ALIASES: Record<string, ShapeId[]> = {
  hourglass: ["hourglass"],
  "long-line": ["long-line"],
  rectangle: ["balanced"],
  balanced: ["balanced"],
  pear: ["soft-middle"],
  "soft-middle": ["soft-middle"],
  "inverted-triangle": ["broad-shoulder"],
  "broad-shoulder": ["broad-shoulder"],
};

function canonSeason(raw?: string | null): SeasonId | null {
  if (!raw) return null;
  return SEASON_ALIASES[raw] ?? (raw as SeasonId);
}

function canonValue(raw?: string | null): "light" | "medium" | "deep" | null {
  if (!raw) return null;
  if (raw === "dark" || raw === "deep") return "deep";
  if (raw === "light" || raw === "medium") return raw;
  return null;
}

function canonChroma(raw?: string | null): "bright" | "muted" | null {
  if (!raw) return null;
  if (raw === "bright" || raw === "clear") return "bright";
  if (raw === "muted" || raw === "soft") return "muted";
  return null;
}

export const STYLE_CARD_BANK: StyleCardV1[] = (bank as StyleCardV1[]).map((card) => ({
  ...card,
  ageBands: card.ageBands?.length ? card.ageBands : (["mid"] as Array<"younger" | "mid" | "mature">),
  image: `/style-cards/${card.id}.jpg`,
}));

export function styleCardById(id: string): StyleCardV1 | undefined {
  return STYLE_CARD_BANK.find((card) => card.id === id);
}

export function styleCardsForGender(_gender?: GenderId | null): StyleCardV1[] {
  return STYLE_CARD_BANK.filter((card) => card.gender === FRIEND_GENDER);
}

function seasonsOf(card: StyleCardV1): Set<SeasonId> {
  return new Set(card.color.seasons.map(canonSeason).filter((item): item is SeasonId => Boolean(item)));
}

function undertonesOf(card: StyleCardV1): Set<string> {
  return new Set(card.color.undertone.map((item) => item.toLowerCase()));
}

function valuesOf(card: StyleCardV1): Set<string> {
  return new Set(card.color.value.map((item) => canonValue(item)).filter((item): item is NonNullable<typeof item> => Boolean(item)));
}

function chromasOf(card: StyleCardV1): Set<string> {
  return new Set(card.color.chroma.map((item) => canonChroma(item)).filter((item): item is NonNullable<typeof item> => Boolean(item)));
}

function seasonMatch(card: StyleCardV1, season?: SeasonId | null): boolean {
  const wanted = canonSeason(season);
  if (!wanted) return false;
  return seasonsOf(card).has(wanted);
}

function undertoneMatch(card: StyleCardV1, undertone?: UndertoneId | null): boolean {
  if (!undertone) return true;
  const tones = undertonesOf(card);
  return tones.has(undertone) || tones.has("neutral");
}

function valueMatch(card: StyleCardV1, value?: ValueId | null): boolean {
  const wanted = canonValue(value);
  if (!wanted) return true;
  return valuesOf(card).has(wanted);
}

function chromaMatch(card: StyleCardV1, chroma?: ChromaId | null): boolean {
  const wanted = canonChroma(chroma);
  if (!wanted) return true;
  return chromasOf(card).has(wanted);
}

function axesMatch(card: StyleCardV1, input: StyleFilterInput): boolean {
  return undertoneMatch(card, input.undertone) && valueMatch(card, input.value) && chromaMatch(card, input.chroma);
}

function hitsAvoid(card: StyleCardV1, input: StyleFilterInput): boolean {
  const avoid = card.color.avoidIf;
  if (!avoid) return false;
  const season = canonSeason(input.season);
  if (season && (avoid.seasons ?? []).map(canonSeason).includes(season)) return true;
  if (input.undertone && (avoid.undertone ?? []).includes(input.undertone)) return true;
  const value = canonValue(input.value);
  if (value && (avoid.value ?? []).map(canonValue).includes(value)) return true;
  const chroma = canonChroma(input.chroma);
  if (chroma && (avoid.chroma ?? []).map(canonChroma).includes(chroma)) return true;
  return false;
}

function shapeBoost(card: StyleCardV1, shape?: ShapeId | null): boolean {
  if (!shape) return false;
  if (card.shapeFit.includes(shape)) return true;
  return card.shapeFit.some((tag) => (SHAPE_ALIASES[tag] ?? []).includes(shape));
}

function primaryAesthetic(card: StyleCardV1): string {
  return card.aesthetics[0] ?? "";
}

/** Discriminative harvest tags a 12-card deck should try to surface (≥1 each). */
export const DECK_COVERAGE_TAGS = [
  "floral",
  "animal-print",
  "color-clash",
  "all-neutral",
  "oversized",
  "fitted",
  "dress",
  "big-tote",
  "mini-bag",
  "jewelry-minimal",
  "jewelry-layered",
  "jewelry-stack",
] as const;
export type DeckCoverageTag = (typeof DECK_COVERAGE_TAGS)[number];

function cardCoversTag(card: StyleCardV1, tag: DeckCoverageTag): boolean {
  const tags = new Set(card.signalTags ?? []);
  if (tags.has(tag)) return true;
  if (tag === "oversized") return card.fit === "oversized" || tags.has("oversized");
  if (tag === "fitted") return card.fit === "fitted" || tags.has("fitted");
  if (tag === "dress") return tags.has("dress") || card.silhouette.some((s) => s.includes("dress"));
  if (tag === "big-tote") {
    return tags.has("big-tote") || (card.accessoryScale === "big" && tags.has("tote"));
  }
  if (tag === "mini-bag") {
    return tags.has("mini-bag") || (card.accessoryScale === "small" && (tags.has("crossbody") || tags.has("leather-mini")));
  }
  if (tag === "animal-print") return tags.has("animal-print") || tags.has("leopard") || tags.has("animal");
  if (tag === "floral") return tags.has("floral");
  if (tag === "color-clash") return tags.has("color-clash");
  if (tag === "all-neutral") return tags.has("all-neutral") || tags.has("tonal");
  if (tag === "jewelry-minimal") {
    return tags.has("jewelry-minimal") || card.jewelryAmount === "minimal";
  }
  if (tag === "jewelry-layered") {
    return tags.has("jewelry-layered") || card.jewelryAmount === "layered";
  }
  if (tag === "jewelry-stack") {
    return tags.has("jewelry-stack") || card.jewelryAmount === "stack";
  }
  return false;
}

function pickImageKey(card: StyleCardV1): string {
  return (card.image ?? "").trim().toLowerCase();
}

function pickMixed(ranked: StyleCardV1[], count: number): StyleCardV1[] {
  const picked: StyleCardV1[] = [];
  const used = new Set<string>();
  const usedImages = new Set<string>();
  const usedVisual = new Set<string>();
  const free = (card: StyleCardV1) => {
    if (used.has(card.id)) return false;
    const img = pickImageKey(card);
    if (img && usedImages.has(img)) return false;
    if (usedVisual.has(styleCardVisualKey(card))) return false;
    return true;
  };
  const take = (card: StyleCardV1) => {
    picked.push(card);
    used.add(card.id);
    const img = pickImageKey(card);
    if (img) usedImages.add(img);
    usedVisual.add(styleCardVisualKey(card));
  };
  const groups = new Map<string, StyleCardV1[]>();
  for (const name of LOCKED_AESTHETICS) groups.set(name, []);
  for (const card of ranked) {
    const key = LOCKED_AESTHETICS.includes(primaryAesthetic(card) as LockedAesthetic)
      ? primaryAesthetic(card)
      : "other";
    const list = groups.get(key) ?? [];
    list.push(card);
    groups.set(key, list);
  }

  const rounds = Math.max(2, Math.ceil(count / LOCKED_AESTHETICS.length));
  for (let round = 0; round < rounds; round += 1) {
    for (const name of LOCKED_AESTHETICS) {
      const next = (groups.get(name) ?? []).find(free);
      if (!next || picked.length >= count) continue;
      take(next);
    }
  }

  const swapIn = (hit: StyleCardV1) => {
    if (!free(hit)) return;
    if (picked.length < count) {
      take(hit);
      return;
    }
    // Prefer dropping a duplicate aesthetic / non-coverage fill.
    const covered = new Set(
      DECK_COVERAGE_TAGS.filter((tag) => picked.some((card) => cardCoversTag(card, tag)))
    );
    const drop = [...picked]
      .reverse()
      .find((card) => {
        const alone = DECK_COVERAGE_TAGS.filter((tag) => cardCoversTag(card, tag) && !picked.some((other) => other.id !== card.id && cardCoversTag(other, tag)));
        return alone.length === 0;
      });
    if (!drop) return;
    used.delete(drop.id);
    const dropImg = pickImageKey(drop);
    if (dropImg) usedImages.delete(dropImg);
    usedVisual.delete(styleCardVisualKey(drop));
    picked.splice(picked.indexOf(drop), 1);
    take(hit);
    void covered;
  };

  const ensureScale = (scale: "big" | "small") => {
    if (picked.some((card) => card.accessoryScale === scale)) return;
    const hit = ranked.find((card) => card.accessoryScale === scale && free(card));
    if (hit) swapIn(hit);
  };
  ensureScale("big");
  ensureScale("small");

  const ensureJewelry = (amount: "minimal" | "layered" | "stack") => {
    if (picked.some((card) => card.jewelryAmount === amount)) return;
    const hit = ranked.find((card) => card.jewelryAmount === amount && free(card));
    if (hit) swapIn(hit);
  };
  // Pole coverage only (mirrors bag small/big) — layered optional via tags.
  ensureJewelry("minimal");
  ensureJewelry("stack");

  // Prefer covering Stylist discriminative harvest tags.
  for (const tag of DECK_COVERAGE_TAGS) {
    if (picked.some((card) => cardCoversTag(card, tag))) continue;
    const hit = ranked.find((card) => cardCoversTag(card, tag) && free(card));
    if (hit) swapIn(hit);
  }

  for (const card of ranked) {
    if (picked.length >= count) break;
    if (!free(card)) continue;
    take(card);
  }
  return picked.slice(0, count);
}


const AGE_BAND_IDS = ["younger", "mid", "mature"] as const;

function cardAgeBands(card: StyleCardV1): Array<"younger" | "mid" | "mature"> {
  return card.ageBands?.length ? card.ageBands : (["mid"] as Array<"younger" | "mid" | "mature">);
}

/** When lookAge is missing/mixed, nudge deck toward covering younger+mid+mature. */
function preferAgeBandDiversity(picked: StyleCardV1[], ranked: StyleCardV1[], count: number): StyleCardV1[] {
  const used = new Set(picked.map((c) => c.id));
  const usedImages = new Set(picked.map(pickImageKey).filter(Boolean));
  const usedVisual = new Set(picked.map(styleCardVisualKey));
  const free = (c: StyleCardV1) => {
    if (used.has(c.id)) return false;
    const img = pickImageKey(c);
    if (img && usedImages.has(img)) return false;
    if (usedVisual.has(styleCardVisualKey(c))) return false;
    return true;
  };
  const out = [...picked];
  for (const band of AGE_BAND_IDS) {
    if (out.some((c) => cardAgeBands(c).includes(band))) continue;
    const hit = ranked.find((c) => free(c) && cardAgeBands(c).includes(band));
    if (!hit) continue;
    if (out.length < count) {
      out.push(hit);
      used.add(hit.id);
      const img = pickImageKey(hit);
      if (img) usedImages.add(img);
      usedVisual.add(styleCardVisualKey(hit));
      continue;
    }
    // Swap out a card that does not uniquely cover another missing band.
    const dropIdx = [...out.keys()].reverse().find((i) => {
      const alone = AGE_BAND_IDS.filter(
        (b) => cardAgeBands(out[i]).includes(b) && !out.some((o, j) => j !== i && cardAgeBands(o).includes(b))
      );
      return alone.length === 0;
    });
    if (dropIdx === undefined) continue;
    const dropped = out[dropIdx];
    used.delete(dropped.id);
    const dropImg = pickImageKey(dropped);
    if (dropImg) usedImages.delete(dropImg);
    usedVisual.delete(styleCardVisualKey(dropped));
    out.splice(dropIdx, 1);
    out.push(hit);
    used.add(hit.id);
    const hitImg = pickImageKey(hit);
    if (hitImg) usedImages.add(hitImg);
    usedVisual.add(styleCardVisualKey(hit));
  }
  return out.slice(0, count);
}


/** Hard-unique by card id, image URL, and visual near-dup key — no duplicate looks in a deck/session. */
export function dedupeStyleCards(cards: StyleCardV1[]): StyleCardV1[] {
  const seenIds = new Set<string>();
  const seenUrls = new Set<string>();
  const seenVisual = new Set<string>();
  const out: StyleCardV1[] = [];
  for (const card of cards) {
    if (seenIds.has(card.id)) continue;
    const url = (card.image ?? "").trim().toLowerCase();
    if (url && seenUrls.has(url)) continue;
    const visual = styleCardVisualKey(card);
    if (seenVisual.has(visual)) continue;
    seenIds.add(card.id);
    if (url) seenUrls.add(url);
    seenVisual.add(visual);
    out.push(card);
  }
  return out;
}

export function selectStyleDeck(input: StyleFilterInput, count = SWIPE_DECK_COUNT): StyleCardV1[] {
  if (input.deckIds?.length) {
    const restored = dedupeStyleCards(
      input.deckIds.map(styleCardById).filter((card): card is StyleCardV1 => Boolean(card))
    );
    if (restored.length) return restored.slice(0, count);
  }

  const all = styleCardsForGender(input.gender);
  if (!all.length) return [];
  const lookAge = input.lookAge;
  const pool =
    lookAge && lookAge !== "mixed"
      ? all.filter((card) => {
          const bands: Array<"younger" | "mid" | "mature"> = card.ageBands?.length
            ? card.ageBands
            : ["mid"];
          return bands.includes(lookAge);
        })
      : all;
  if (!pool.length) return [];

  const hasSeason = Boolean(input.season);
  const hasAxes = Boolean(input.undertone || input.value || input.chroma);

  let eligible = pool;
  if (hasSeason) {
    const seasonHits = pool.filter((card) => seasonMatch(card, input.season));
    if (seasonHits.length >= count) eligible = seasonHits;
  } else if (hasAxes) {
    const axisHits = pool.filter((card) => axesMatch(card, input));
    if (axisHits.length >= count) eligible = axisHits;
  }

  const scored = eligible.map((card) => {
    let score = card.weight ?? 1;
    if (hasSeason && seasonMatch(card, input.season)) score += 24;
    else if (!hasSeason && hasAxes && axesMatch(card, input)) score += 16;
    if (hitsAvoid(card, input)) score -= 22;
    if (shapeBoost(card, input.shape)) score += 10;
    const lastShown = input.shownAt?.[card.id] ?? 0;
    return { card, score, lastShown };
  });

  scored.sort(
    (a, b) => b.score - a.score || a.lastShown - b.lastShown || a.card.id.localeCompare(b.card.id)
  );

  const threshold = scored[Math.min(count - 1, scored.length - 1)]?.score ?? 0;
  const band = scored
    .filter((row) => row.score >= threshold - 6)
    .sort((a, b) => a.lastShown - b.lastShown || b.score - a.score || a.card.id.localeCompare(b.card.id))
    .map((row) => row.card);

  const preferBands = !lookAge || lookAge === "mixed";
  let mixed = dedupeStyleCards(pickMixed(band, count));
  if (preferBands) mixed = dedupeStyleCards(preferAgeBandDiversity(mixed, band, count));
  if (mixed.length >= count) return mixed;
  let fallback = dedupeStyleCards(pickMixed(scored.map((row) => row.card), count));
  if (preferBands) fallback = dedupeStyleCards(preferAgeBandDiversity(fallback, scored.map((row) => row.card), count));
  return fallback;
}

export function representativeStyleCards(gender?: GenderId | null, perAesthetic = 2): StyleCardV1[] {
  const pool = styleCardsForGender(gender);
  return pickMixed(pool, perAesthetic * LOCKED_AESTHETICS.length);
}

function uniqueAesthetics(ids: string[], includeSecondary = false): string[] {
  const names: string[] = [];
  for (const id of ids) {
    const card = styleCardById(id);
    if (!card) continue;
    const list = includeSecondary
      ? [...card.aesthetics, ...(card.secondaryAesthetics ?? [])]
      : card.aesthetics;
    for (const name of list) {
      const normalized = normalizeAestheticId(name);
      if (!normalized) continue;
      if (!names.includes(normalized)) names.push(normalized);
    }
  }
  return names;
}

export function likedAestheticsFromIds(ids: string[]): string[] {
  return uniqueAesthetics(ids, false);
}

export function dislikedAestheticsFromIds(likedIds: string[], dislikedIds: string[]): string[] {
  const liked = new Set(uniqueAesthetics(likedIds, true));
  return uniqueAesthetics(dislikedIds, true).filter((name) => !liked.has(name));
}

export function dislikedSilhouettesFromIds(likedIds: string[], dislikedIds: string[]): string[] {
  const liked = new Set(
    likedIds.flatMap((id) => styleCardById(id)?.silhouette ?? [])
  );
  const names: string[] = [];
  for (const id of dislikedIds) {
    for (const name of styleCardById(id)?.silhouette ?? []) {
      if (liked.has(name) || names.includes(name)) continue;
      names.push(name);
    }
  }
  return names;
}

export function filterInputFromSession(session: ProfileSession): StyleFilterInput {
  return {
    gender: FRIEND_GENDER,
    shape: session.shape,
    season: session.season,
    undertone: session.undertone,
    value: session.value,
    chroma: session.chroma,
    lookAge: session.lookAge,
    shownAt: session.styleCardShownAt,
    deckIds: session.styleDeckIds,
  };
}
