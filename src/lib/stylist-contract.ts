import { packetValue, SEASON_GUIDES, seasonMappedAspects } from "./color-analysis";
import { resolveLocaleAndClimate } from "./climate-locale";
import { FRIEND_GENDER } from "./friend";
import { filterMvpItems, loadMvpCatalog, type MvpCatalogItem } from "./mvp-catalog";
import { dislikedAestheticsFromIds, dislikedSilhouettesFromIds, likedAestheticsFromIds } from "./style-cards";
import {
  ensurePacketStyleSignals,
  parseStyleSignals,
  rebuildStyleSignals,
  type StyleSignalsV1,
  type StylistStyleSignalsV1,
} from "./style-signals";
import type {
  ChromaId,
  GenderId,
  MetalPreferenceId,
  OccasionId,
  PathKind,
  PriorityId,
  ProfileSession,
  SeasonId,
  ShapeId,
  TorsoId,
  UndertoneId,
  ValueId,
} from "./types";

export const STYLIST_REQUEST_KIND = "atelier.stylistRequest.v1" as const;
export const STYLIST_RESPONSE_KIND = "atelier.stylistResponse.v1" as const;
export const STYLIST_DEMO_SHOP = "#demo-stub";
export const STYLIST_LOOK_COUNT = 4;
export const STYLIST_FREE_FITTING_COUNT = 3;
/**
 * Product lock 2026-09-12 (Luisa) — park worn fittings sitewide (cost).
 * When true: every create uses fittingCount 0; UI is tiles-only; no hero gate.
 */
export const FITTINGS_PARKED = true;
/** How to style it — prefer 3 tiles-only boards (product allows 2–3). */
export const STYLIST_STYLE_THIS_PIECE_LOOK_COUNT = 3;

export type StylistSwatchV1 = {
  name: string;
  hex: string;
};

export type StylistMeasurementsV1 = {
  heightCm: number | null;
  chestCm: number | null;
  waistCm: number | null;
  hipsCm: number | null;
  inseamCm: number | null;
  shoulderCm: number | null;
  neckCm: number | null;
};

export type StylistColorV1 = {
  season: SeasonId | null;
  undertone: UndertoneId | null;
  value: ValueId | null;
  chroma: ChromaId | null;
  swatches: StylistSwatchV1[];
  /** Optional extra — Stylist may ignore. */
  metal?: MetalPreferenceId | null;
};

export type StylistBudgetV1 = {
  min: number;
  max: number;
  currency: "USD";
};

/**
 * Owned closet pieces sent when look generation runs and the client closet is non-empty.
 * Friend is women-only — every piece is female apparel. Always send ≤10 when non-empty
 * (both `closetFirst` and `storeFirst`).
 *
 * Mix intent is driven by `generateMode` + optional `lookMix` (Stylist implements):
 * - styleChat (Style tab): exactly 4 looks via `lookMix` —
 *   look 1 mostly closet, looks 2–3 mix closet+store, look 4 store-only (no closet)
 * - closetFirst: core from closet; 1–2 store gap fillers; prefer `mixCloset`
 * - storeFirst: store priority; ≤1 closet if fits; `storeNew` / `mix`
 * - styleThisPiece: every look includes `closetPieceId`; fill rest with store SKUs;
 *   vary silhouettes; tiles-only (`fittingCount` 0); lookCount 2–3
 * Stylist soft-defaults `storeFirst` if `generateMode` is missing on old packets.
 *
 * Legacy mix labels (of each 4 looks; Stylist emits `look.source`):
 * 1. mostly closet + 1–2 store elevate → `mixCloset`
 * 2. mostly/all store new → `storeNew`
 * 3–4. mix → `mix`
 * Core / elevate budget rules are unchanged.
 */
export type StylistClosetPieceV1 = {
  id: string;
  role: StylistPieceRoleV1;
  name?: string;
  color?: string;
  colorNote?: string;
  /** Cutout image (data URL or hosted), Store-tile spirit. */
  image?: string;
  source?: "photo" | "manual" | "video";
  gender?: "female";
};

export type StylistLookSourceV1 = "mixCloset" | "mix" | "storeNew";

/** Per-look closet/store recipe on Style chat Generate (always 4 looks). */
export type StylistLookMixSlotV1 = {
  look: 1 | 2 | 3 | 4;
  source: StylistLookSourceV1;
  /** How much of this look should come from the client closet. Look 4 is store-only. */
  closet: "mostly" | "mix" | "none";
};

/**
 * Luisa Style Generate lock (2026-09): 4 looks —
 * 1 mostly closet, 2–3 mix closet+store, 4 store-only (no closet pieces).
 */
export const STYLE_CHAT_LOOK_MIX: StylistLookMixSlotV1[] = [
  { look: 1, source: "mixCloset", closet: "mostly" },
  { look: 2, source: "mix", closet: "mix" },
  { look: 3, source: "mix", closet: "mix" },
  { look: 4, source: "storeNew", closet: "none" },
];

export function lookMixCaption(source?: StylistLookSourceV1 | null): string {
  if (source === "mixCloset") return "Mostly closet";
  if (source === "mix") return "Closet + store";
  if (source === "storeNew") return "Store";
  return "";
}

/** Style chat → styleChat; Style my closet → closetFirst; Style a new outfit → storeFirst; How to style it → styleThisPiece. */
export type StylistGenerateModeV1 = "styleChat" | "closetFirst" | "storeFirst" | "styleThisPiece";

export type StylistRequestV1 = {
  kind: typeof STYLIST_REQUEST_KIND;
  requestId: string;
  gender: GenderId | null;
  path: PathKind;
  size: string | null;
  shape: ShapeId | null;
  torso: TorsoId | null;
  measurements: StylistMeasurementsV1;
  color: StylistColorV1;
  priorities: PriorityId[];
  likedAesthetics: string[];
  dislikedAesthetics: string[];
  dislikedSilhouettes?: string[];
  /**
   * Swipe + look feedback. Always sent on new packets with avoid.pieceIds and
   * feedback.lastReasons/lastLookId (per-user bans only — never global SKU ban).
   */
  styleSignals: StylistStyleSignalsV1;
  /** Prior board core hashes (also under styleSignals.recentServedCoreHashes). */
  recentServedCoreHashes?: string[];
  budget: StylistBudgetV1;
  occasions: OccasionId[];
  /**
   * Free-text details from Style chat ("dinner, keep it easy"). Complements `occasions`.
   * Stylist should honor this as the dressing brief.
   */
  occasionNote?: string;
  lookCount: number;
  /**
   * Style chat → `styleChat`; Style my closet → `closetFirst`; Style a new outfit → `storeFirst`;
   * How to style it → `styleThisPiece`. Required on new packets.
   * Stylist soft-defaults `storeFirst` if missing on old packets.
   */
  generateMode: StylistGenerateModeV1;
  /**
   * Required on `styleChat` (and allowed on other 4-look modes). Stylist emits matching `look.source`.
   * Look 1 mostly closet; 2–3 mix; 4 store-only (no closet).
   */
  lookMix?: StylistLookMixSlotV1[];
  /** Required when `generateMode` is `styleThisPiece` — that closet piece must appear in every look. */
  closetPieceId?: string;
  catalogVersion?: string;
  catalog?: {
    version: string;
    items: MvpCatalogItem[];
  };
  /** Present only when the client closet has ≥1 piece. */
  closet?: StylistClosetPieceV1[];
  /** Colors they like to wear. Not a flattering-near-the-face palette. */
  favColors?: StylistSwatchV1[];
  lookAge?: "younger" | "mid" | "mature" | "mixed";
  /** Editable appearance tags so fittings honor hair / eyes / skin tone. */
  appearance?: {
    hairColor?: string;
    hairLength?: string;
    eyes?: string;
    skinToneBand?: string;
  };
  /** First unpaid board. Stylist gens 3 fittings; look 4 stays shoppable. */
  freeFirstBoard?: boolean;
  /** `free` = 3 fittings; `premium` = 4. */
  tier?: "free" | "premium";
  /** How many worn fittings to render. Always `lookCount` looks. */
  fittingCount?: number;
  /** Soft location for locale-aware seasonality (Stylist). */
  locale?: {
    city?: string;
    region?: string;
    country?: string;
    timezone?: string;
    lat?: number;
    lng?: number;
  };
  /** Outerwear / climate weight for current month. */
  climateBand?: "hot" | "warm" | "mild" | "cool" | "cold";
};

export type StylistPieceRoleV1 =
  | "outerwear"
  | "knit"
  | "sweater"
  | "cardigan"
  | "shirt"
  | "tee"
  | "top"
  | "trousers"
  | "shorts"
  | "bottom"
  | "dress"
  | "shoes"
  | "accessory"
  | "bag"
  | "other";

export type StylistPieceV1 = {
  id: string;
  role: StylistPieceRoleV1;
  brand: string;
  name: string;
  price: number;
  currency: "USD";
  image: string;
  shopUrl: string;
};

export type StylistLookTotalV1 = {
  amount: number;
  currency: string;
};

export type StylistLookV1 = {
  id: string;
  title: string;
  hook: string;
  why: string;
  /** Worn fitting URL. Optional on free look 4. */
  heroImage: string;
  /** Alias for the worn fitting. Same URL as heroImage when present. */
  fittingImage?: string;
  /** True on free look 4 — tiles/shop/recipe still required. */
  fittingLocked?: boolean;
  pieces: StylistPieceV1[];
  formula?: string;
  whyFit?: string;
  whyColor?: string;
  whyVibe?: string;
  capsuleNote?: string;
  lookTotal?: StylistLookTotalV1;
  levelUp?: StylistPieceV1[];
  /** Missing/undefined → magazine board. */
  layout?: "board" | "ltk-row";
  /** Stylist mix label. UI may show later. */
  source?: StylistLookSourceV1;
  [extra: string]: unknown;
};

export type StylistResponseV1 = {
  kind: typeof STYLIST_RESPONSE_KIND;
  requestId: string;
  looks: StylistLookV1[];
  [extra: string]: unknown;
};

function cm(value?: number): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function newRequestId(seed: number): string {
  const rand = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : String(seed);
  return `srq_${seed.toString(36)}_${rand}`;
}

export function likedAestheticsFromSession(session: ProfileSession): string[] {
  return likedAestheticsFromIds(session.likedStyleIds);
}

export function dislikedAestheticsFromSession(session: ProfileSession): string[] {
  return dislikedAestheticsFromIds(session.likedStyleIds, session.dislikedStyleIds ?? []);
}

export function dislikedSilhouettesFromSession(session: ProfileSession): string[] {
  return dislikedSilhouettesFromIds(session.likedStyleIds, session.dislikedStyleIds ?? []);
}

export function styleSignalsFromSession(session: ProfileSession): StylistStyleSignalsV1 {
  const likedIds = session.likedStyleIds ?? [];
  const dislikedIds = session.dislikedStyleIds ?? [];
  const shown = session.styleDeckIds?.length ?? likedIds.length + dislikedIds.length;
  const lookVotes = (session.lookFeedback ?? []).map((vote) => ({
    lookId: vote.lookId,
    vote: vote.vote,
    reasons: vote.reasons,
    look: vote.look,
  }));
  // Rebuild from lookFeedback so per-user avoid.pieceIds / feedback always reach Stylist.
  if (lookVotes.length || likedIds.length || dislikedIds.length || session.styleSignals) {
    const rebuilt = rebuildStyleSignals({
      likedIds,
      dislikedIds,
      shown,
      lookVotes,
    });
    const stored = parseStyleSignals(session.styleSignals);
    const merged: StyleSignalsV1 = {
      ...rebuilt,
      avoid: {
        pieceIds: [
          ...new Set([...(rebuilt.avoid?.pieceIds ?? []), ...(stored?.avoid?.pieceIds ?? [])]),
        ].slice(0, 40),
        classes: [
          ...new Set([...(rebuilt.avoid?.classes ?? []), ...(stored?.avoid?.classes ?? [])]),
        ].slice(0, 24),
        lookIds: [
          ...new Set([...(rebuilt.avoid?.lookIds ?? []), ...(stored?.avoid?.lookIds ?? [])]),
        ].slice(0, 40),
      },
      feedback: rebuilt.feedback?.lookVotes
        ? rebuilt.feedback
        : stored?.feedback ?? rebuilt.feedback,
      recentServedCoreHashes: [
        ...new Set([
          ...(rebuilt.recentServedCoreHashes ?? []),
          ...(stored?.recentServedCoreHashes ?? []),
        ]),
      ].slice(-24),
      budgetBias: rebuilt.budgetBias ?? stored?.budgetBias,
    };
    return ensurePacketStyleSignals(merged);
  }
  return ensurePacketStyleSignals(undefined);
}


export function colorPayloadFromSession(session: ProfileSession): StylistColorV1 {
  const season = session.season ?? null;
  const guide = season ? SEASON_GUIDES.find((item) => item.id === season) : undefined;
  const mapped = season ? seasonMappedAspects(season) : null;
  const userSwatches = (session.colorSwatches ?? [])
    .filter((swatch) => swatch.name && swatch.hex)
    .slice(0, 4)
    .map((swatch) => ({ name: swatch.name, hex: swatch.hex }));
  const guideSwatches = (guide?.colors ?? []).map((swatch) => ({ name: swatch.name, hex: swatch.hex }));
  const skipAspects = session.path === "deep" && session.colorSource === "season" && Boolean(season);

  return {
    season,
    undertone: skipAspects ? null : session.undertone ?? mapped?.undertone ?? null,
    value: skipAspects ? null : packetValue(session.value ?? mapped?.value ?? null),
    chroma: skipAspects ? null : session.chroma ?? mapped?.chroma ?? null,
    swatches: userSwatches.length ? userSwatches : guideSwatches,
    metal: session.metalPreference ?? null,
  };
}

export function catalogSliceForSession(session: ProfileSession): {
  version: string;
  items: MvpCatalogItem[];
} {
  const { catalogVersion, items } = loadMvpCatalog();
  return {
    version: catalogVersion,
    items: filterMvpItems(items, {
      dislikedSilhouettes: dislikedSilhouettesFromSession(session),
      gender: FRIEND_GENDER,
    }),
  };
}

export function parseGenerateMode(raw: unknown): StylistGenerateModeV1 {
  if (raw === "styleChat" || raw === "closetFirst" || raw === "storeFirst" || raw === "styleThisPiece") {
    return raw;
  }
  // Stylist soft-defaults storeFirst if missing on old packets — Atelier matches that.
  return "storeFirst";
}

export function parseClosetPieceId(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const id = raw.trim();
  return id ? id : undefined;
}

export function buildStylistRequest(
  session: ProfileSession,
  options?: {
    requestId?: string;
    lookCount?: number;
    closet?: StylistClosetPieceV1[];
    tier?: "free" | "premium";
    freeFirstBoard?: boolean;
    generateMode?: StylistGenerateModeV1;
    closetPieceId?: string;
    occasions?: OccasionId[];
    occasionNote?: string;
    lookMix?: StylistLookMixSlotV1[];
  }
): StylistRequestV1 {
  const generateMode = parseGenerateMode(options?.generateMode);
  const styleThisPiece = generateMode === "styleThisPiece";
  const styleChat = generateMode === "styleChat";
  const closetPieceId = parseClosetPieceId(options?.closetPieceId);
  // How to style it: 2–3 tiles-only boards (prefer 3). Never fittings on this path.
  // Style chat: exactly 4 looks (closet mix recipe).
  const lookCount =
    options?.lookCount ?? (styleThisPiece ? STYLIST_STYLE_THIS_PIECE_LOOK_COUNT : STYLIST_LOOK_COUNT);
  const catalog = catalogSliceForSession(session);
  const styleSignals = styleSignalsFromSession(session);
  const closet = options?.closet?.length ? options.closet.slice(0, 10) : undefined;
  const tier = options?.tier ?? (session.hasPremium ? "premium" : "free");
  // Fittings parked: never claim free fittings board; all modes tiles-only (fittingCount 0).
  // styleThisPiece never claimed the free fittings board either — distinct tiles path.
  const freeFirstBoard = FITTINGS_PARKED || styleThisPiece
    ? false
    : options?.freeFirstBoard ?? (tier === "free" && !session.hasUsedFreeBoard);
  // Parked → 0 always (incl. premium / former freeFirst). Else premium→4, freeFirst→3, else 0.
  const fittingCount = FITTINGS_PARKED || styleThisPiece
    ? 0
    : tier === "premium"
      ? STYLIST_LOOK_COUNT
      : freeFirstBoard
        ? STYLIST_FREE_FITTING_COUNT
        : 0;
  return {
    kind: STYLIST_REQUEST_KIND,
    requestId: options?.requestId ?? session.stylistRequestId ?? newRequestId(session.seed || Date.now()),
    gender: FRIEND_GENDER,
    path: session.path,
    size: session.size?.trim() ? session.size : null,
    shape: session.shape ?? null,
    torso: session.torso ?? null,
    measurements: {
      heightCm: cm(session.heightCm),
      chestCm: cm(session.chestCm),
      waistCm: cm(session.waistCm),
      hipsCm: cm(session.hipsCm),
      inseamCm: cm(session.inseamCm),
      shoulderCm: cm(session.shoulderCm),
      neckCm: cm(session.neckCm),
    },
    color: colorPayloadFromSession(session),
    priorities: session.priorities ?? [],
    likedAesthetics: likedAestheticsFromSession(session),
    dislikedAesthetics: dislikedAestheticsFromSession(session),
    dislikedSilhouettes: dislikedSilhouettesFromSession(session) ?? [],
    styleSignals,
    ...(styleSignals.recentServedCoreHashes?.length
      ? { recentServedCoreHashes: styleSignals.recentServedCoreHashes }
      : {}),
    budget: {
      min: session.budgetMin,
      max: session.budgetMax,
      currency: "USD",
    },
    occasions: options?.occasions?.length
      ? options.occasions
      : session.occasions.length
        ? session.occasions
        : ["weekend"],
    lookCount,
    generateMode,
    ...(styleThisPiece && closetPieceId ? { closetPieceId } : {}),
    ...(styleChat || options?.lookMix
      ? { lookMix: options?.lookMix ?? STYLE_CHAT_LOOK_MIX }
      : {}),
    ...(() => {
      const note = (options?.occasionNote ?? session.styleBrief)?.trim().slice(0, 280);
      return note ? { occasionNote: note } : {};
    })(),
    freeFirstBoard,
    tier,
    fittingCount,
    catalogVersion: catalog.version,
    catalog,
    ...(closet ? { closet } : {}),
    ...(session.favColors?.length
      ? { favColors: session.favColors.filter((item) => item.name && item.hex).slice(0, 6) }
      : {}),
    ...(session.lookAge ? { lookAge: session.lookAge } : {}),
    ...(session.appearance && Object.values(session.appearance).some(Boolean)
      ? { appearance: session.appearance }
      : {}),
    ...(() => {
      const { locale, climateBand } = resolveLocaleAndClimate({
        locale: session.locale,
        climateBand: session.climateBand,
        timezone: session.locale?.timezone,
      });
      return { locale, climateBand };
    })(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Closet-owned pieces in looks may omit retailer shopUrl. */
export const STYLIST_CLOSET_SHOP = "https://atelier-theta-one.vercel.app/closet";

export type ParseStylistResponseOptions = {
  /** styleThisPiece / fittingCount 0 — heroes optional; looks marked fittingLocked. */
  tilesOnly?: boolean;
};

function isClosetOwnedPiece(value: Record<string, unknown>): boolean {
  const id = typeof value.id === "string" ? value.id : "";
  if (id.startsWith("photo-") || id.startsWith("closet-")) return true;
  const source = value.source;
  return source === "closet" || source === "photo" || source === "manual" || source === "video";
}

function coercePiece(value: unknown): StylistPieceV1 | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || !value.id.trim()) return null;
  if (typeof value.role !== "string" || !value.role.trim()) return null;

  const closet = isClosetOwnedPiece(value);
  let brand = typeof value.brand === "string" ? value.brand : "";
  let name = typeof value.name === "string" ? value.name : "";
  let image = typeof value.image === "string" ? value.image : "";
  let shopUrl = typeof value.shopUrl === "string" ? value.shopUrl : "";
  let currency = typeof value.currency === "string" && value.currency ? value.currency : "USD";
  let price =
    typeof value.price === "number" && Number.isFinite(value.price) ? value.price : Number.NaN;

  if (closet) {
    if (!brand.trim()) brand = "Closet";
    if (!shopUrl.trim()) shopUrl = STYLIST_CLOSET_SHOP;
    if (!Number.isFinite(price)) price = 0;
    if (!name.trim()) name = value.id.trim();
    // image may be empty string for closet tiles when cutout not yet ready
    if (typeof value.image !== "string") image = "";
  } else {
    if (typeof value.brand !== "string" || typeof value.name !== "string") return null;
    if (typeof value.price !== "number" || !Number.isFinite(value.price)) return null;
    if (typeof value.image !== "string" || typeof value.shopUrl !== "string") return null;
    if (typeof value.currency !== "string") return null;
    brand = value.brand;
    name = value.name;
    image = value.image;
    shopUrl = value.shopUrl;
    currency = value.currency;
    price = value.price;
  }

  if (!brand || !name || !Number.isFinite(price)) return null;

  return {
    ...(value as StylistPieceV1),
    id: value.id.trim(),
    role: value.role as StylistPieceRoleV1,
    brand,
    name,
    price,
    currency: currency as "USD",
    image,
    shopUrl,
  };
}

function isPiece(value: unknown): value is StylistPieceV1 {
  return coercePiece(value) != null;
}

function lookCopy(value: Record<string, unknown>): string {
  const parts = [value.why, value.whyFit, value.whyColor, value.whyVibe, value.formula]
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim());
  return parts[0] ?? "";
}

function lookFittingField(value: Record<string, unknown>): string {
  if (typeof value.fittingImage === "string" && value.fittingImage.trim()) return value.fittingImage.trim();
  if (typeof value.heroImage === "string" && value.heroImage.trim()) return value.heroImage.trim();
  return "";
}

function coerceLookTitle(value: Record<string, unknown>): string {
  if (typeof value.title === "string" && value.title.trim()) return value.title.trim();
  // missing / null / blank → formula, then id
  if (typeof value.formula === "string" && value.formula.trim()) return value.formula.trim();
  if (typeof value.id === "string" && value.id.trim()) return value.id.trim();
  return "";
}

function isLook(value: unknown): value is StylistLookV1 {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "string" || !value.id) return false;
  if (!coerceLookTitle(value)) return false;
  // pieces coerced via isPiece/coercePiece (closet may omit shopUrl).
  if (!Array.isArray(value.pieces) || value.pieces.length === 0 || !value.pieces.every(isPiece)) return false;
  if (value.levelUp != null && (!Array.isArray(value.levelUp) || !value.levelUp.every(isPiece))) return false;
  // heroImage / fittingImage optional when fittingLocked or tiles-only context (normalizeLook).
  // Non-locked looks may still parse with empty heroes; assertFittingHeroesLive enforces live URLs on ingest.
  return lookCopy(value).length > 0;
}

export function parseStylistResponse(
  value: unknown,
  options?: ParseStylistResponseOptions
): StylistResponseV1 | null {
  const raw = isRecord(value) && isRecord(value.response) ? value.response : value;
  if (!isRecord(raw)) return null;
  if (raw.kind !== STYLIST_RESPONSE_KIND) return null;
  if (typeof raw.requestId !== "string" || !raw.requestId) return null;
  if (!Array.isArray(raw.looks) || raw.looks.length === 0) return null;
  const tilesOnly = options?.tilesOnly === true;
  const looks = raw.looks
    .map((look) => normalizeLook(look, tilesOnly))
    .filter((look): look is StylistLookV1 => Boolean(look));
  if (looks.length !== raw.looks.length) return null;
  return {
    ...raw,
    kind: STYLIST_RESPONSE_KIND,
    requestId: raw.requestId,
    looks,
  };
}

function normalizeLook(value: unknown, tilesOnly = false): StylistLookV1 | null {
  if (!isLook(value)) return null;
  const record = value as Record<string, unknown> & StylistLookV1;
  const title = coerceLookTitle(record);
  const pieces = record.pieces.map((piece) => coercePiece(piece)).filter((piece): piece is StylistPieceV1 => Boolean(piece));
  if (pieces.length !== record.pieces.length) return null;
  const levelUp = Array.isArray(record.levelUp)
    ? record.levelUp.map((piece) => coercePiece(piece)).filter((piece): piece is StylistPieceV1 => Boolean(piece))
    : undefined;
  if (record.levelUp != null && (!levelUp || levelUp.length !== record.levelUp.length)) return null;
  const why = (typeof record.why === "string" && record.why.trim()) || synthesizeWhy(record);
  const fittingLocked = record.fittingLocked === true || tilesOnly;
  const fitting = lookFittingField(record);
  // fittingLocked / tiles-only: empty hero OK. Otherwise keep whatever was sent (hero-ready enforces live URLs).
  return {
    ...record,
    title,
    hook: typeof record.hook === "string" ? record.hook.trim() : "",
    why,
    heroImage: fitting,
    fittingImage: fitting || undefined,
    fittingLocked,
    pieces,
    levelUp,
  };
}

export function synthesizeWhy(look: Pick<StylistLookV1, "why" | "whyFit" | "whyColor" | "whyVibe" | "formula">): string {
  if (look.why?.trim()) return look.why.trim();
  const parts = [look.whyFit, look.whyColor, look.whyVibe].filter((item): item is string => Boolean(item?.trim()));
  if (parts.length) return parts.join(" ");
  return look.formula?.trim() ?? "";
}

export function lookWhyParts(look: StylistLookV1): { fit: string; color: string; vibe: string } {
  if (look.whyFit || look.whyColor || look.whyVibe) {
    return {
      fit: look.whyFit?.trim() ?? "",
      color: look.whyColor?.trim() ?? "",
      vibe: look.whyVibe?.trim() ?? "",
    };
  }
  const sentences = synthesizeWhy(look)
    .split(/(?<=\.)\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (sentences.length >= 3) {
    return { fit: sentences[0], color: sentences[1], vibe: sentences.slice(2).join(" ") };
  }
  if (sentences.length === 2) return { fit: sentences[0], color: sentences[1], vibe: "" };
  return { fit: sentences[0] ?? "", color: "", vibe: "" };
}

export function lookLayout(look: StylistLookV1): "board" | "ltk-row" {
  return look.layout === "ltk-row" ? "ltk-row" : "board";
}

export function lookBoardHeadline(look: StylistLookV1): string {
  const raw = (typeof look.formula === "string" && look.formula.trim()) || look.title.trim();
  return raw.replace(/^[-–—\s]+|[-–—\s]+$/g, "").toUpperCase();
}

export function lookCardLine(look: StylistLookV1, max = 92): string {
  if (look.formula?.trim()) return shortLookWhy(look.formula, max);
  const parts = lookWhyParts(look);
  return shortLookWhy(parts.fit || parts.color || parts.vibe || synthesizeWhy(look), max);
}

/** True when caption lists SKUs / piece stacks instead of an editorial name. */
function looksLikeInventoryCaption(value: string): boolean {
  const s = value.trim();
  if (!s) return true;
  if ((s.match(/ \+ /g) ?? []).length >= 1) return true;
  if (/^[A-Za-z][A-Za-z\s]{0,24}\s*[—–-]\s*.+/u.test(s) && /\+/u.test(s)) return true;
  // ALL-CAPS product stacks
  if (s === s.toUpperCase() && s.includes("+")) return true;
  return false;
}

/** Casual occasion voice — not Title-Case fashion formulas like "Midnight Column". */
function looksPlayfulOccasionTitle(value: string): boolean {
  const s = value.trim();
  if (!s || looksLikeInventoryCaption(s)) return false;
  // Title Case editorial ("Midnight Column", "Navy Smoke")
  if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4}$/u.test(s)) return false;
  // ALL-CAPS formula headlines
  if (s === s.toUpperCase() && /[A-Z]/.test(s) && s.length > 3) return false;
  return true;
}

const PLAYFUL_OCCASION_FALLBACKS: Record<string, string> = {
  work: "best dressed at the office",
  office: "best dressed at the office",
  weekend: "brunch called",
  brunch: "brunch called",
  errands: "errands in style",
  night: "out after dark",
  evening: "out after dark",
  travel: "wheels up, looks down",
  event: "rsvp looks like this",
  date: "dinner plans sorted",
};

function playfulOccasionFallback(occasion: string): string {
  const raw = occasion.trim().toLowerCase();
  if (!raw) return "styled for the day";
  if (PLAYFUL_OCCASION_FALLBACKS[raw]) return PLAYFUL_OCCASION_FALLBACKS[raw];
  for (const [key, phrase] of Object.entries(PLAYFUL_OCCASION_FALLBACKS)) {
    if (raw.includes(key)) return phrase;
  }
  // Already casual lowercase phrase — keep it
  if (/[a-z]/.test(occasion) && occasion === occasion.toLowerCase()) return occasion.trim();
  return "styled for the day";
}

/**
 * Lookbook card name: prefer Stylist look.title when it is a short name (Stylist owns voice);
 * never invent inventory titles from piece lists. Inventory strip → playful occasion vibe
 * ("brunch called", "errands in style") — not fashion-formula leftovers.
 */
export function lookbookCardTitle(
  look: Pick<StylistLookV1, "title" | "formula"> & { occasion?: string },
  max = 36
): string {
  const title = (look.title ?? "").trim();
  // Prefer Stylist title when it is not an inventory stack — do not invent over a good title.
  if (title && !looksLikeInventoryCaption(title)) {
    return shortLookWhy(title, max).replace(/…$/u, "").trim();
  }

  const formula = (look.formula ?? "").trim();
  // Only keep formula when it already speaks playful occasion voice (not Midnight Column).
  if (formula && looksPlayfulOccasionTitle(formula)) {
    return shortLookWhy(formula, max).replace(/…$/u, "").trim();
  }

  const occasion =
    (typeof look.occasion === "string" && look.occasion.trim()) ||
    (title.match(/^([A-Za-z][A-Za-z\s]{0,24})\s*[—–-]/u) || [])[1]?.trim() ||
    "";

  if (occasion) {
    return shortLookWhy(playfulOccasionFallback(occasion), max).replace(/…$/u, "").trim();
  }

  return "styled for the day";
}

/** First sentence (or a tight clip) for lookbook grid cards. */
export function shortLookWhy(why: string, max = 92): string {
  const text = why.trim();
  const sentence = text.split(/(?<=\.)\s/)[0] || text;
  if (sentence.length <= max) return sentence;
  const clipped = sentence.slice(0, max - 1);
  const breakAt = clipped.lastIndexOf(" ");
  return `${(breakAt > 40 ? clipped.slice(0, breakAt) : clipped).trimEnd()}…`;
}

export function compactStylistResponse(response: StylistResponseV1): StylistResponseV1 {
  const short = (url: string) => {
    try {
      const parsed = new URL(url);
      if (parsed.hostname === "images.unsplash.com") return `${parsed.origin}${parsed.pathname}`;
    } catch {
      /* keep */
    }
    return url;
  };
  return {
    ...response,
    looks: response.looks.map((look) => ({
      ...look,
      heroImage: look.heroImage ? short(look.heroImage) : "",
      fittingImage: look.fittingImage ? short(look.fittingImage) : look.fittingImage,
      pieces: look.pieces.map((piece) => ({ ...piece, image: short(piece.image) })),
      levelUp: look.levelUp?.map((piece) => ({ ...piece, image: short(piece.image) })),
    })),
  };
}

export function lookTotal(look: StylistLookV1): number {
  const stated = look.lookTotal;
  if (stated && typeof stated === "object" && typeof stated.amount === "number" && Number.isFinite(stated.amount)) {
    return stated.amount;
  }
  return look.pieces.reduce((sum, piece) => sum + (typeof piece.price === "number" ? piece.price : 0), 0);
}

function moneyAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (!value || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  if (typeof rec.amount === "number" && Number.isFinite(rec.amount)) return rec.amount;
  if (typeof rec.total === "number" && Number.isFinite(rec.total)) return rec.total;
  if (typeof rec.lookTotal === "number" && Number.isFinite(rec.lookTotal)) return rec.lookTotal;
  if (rec.lookTotal && typeof rec.lookTotal === "object") {
    const nested = moneyAmount(rec.lookTotal);
    if (nested != null) return nested;
  }
  return null;
}

export function lookCoreTotal(look: StylistLookV1): number | null {
  const rec = look as Record<string, unknown>;
  return moneyAmount(rec.coreTotal) ?? moneyAmount(rec.core);
}

export function lookElevateTotal(look: StylistLookV1): number | null {
  const rec = look as Record<string, unknown>;
  return moneyAmount(rec.elevateTotal) ?? moneyAmount(rec.elevate);
}

/** Core / Elevate / Total when the look states those splits. Skip if absent. */
export function lookSplitTotals(look: StylistLookV1): { core: number; elevate: number; total: number } | null {
  const core = lookCoreTotal(look);
  const elevate = lookElevateTotal(look);
  if (core == null || elevate == null) return null;
  return { core, elevate, total: lookTotal(look) };
}

export function lookCurrency(look: StylistLookV1): string {
  if (look.lookTotal && typeof look.lookTotal.currency === "string" && look.lookTotal.currency) {
    return look.lookTotal.currency;
  }
  return look.pieces[0]?.currency ?? "USD";
}

export function stylistMode(): "local" | "ingest" {
  return process.env.STYLIST_MODE === "local" ? "local" : "ingest";
}
