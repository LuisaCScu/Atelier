export type PathKind = "quick" | "deep";

export type GenderId = "female" | "male";

export type ShapeId = "balanced" | "soft-middle" | "broad-shoulder" | "long-line" | "hourglass";

export type TorsoId = "long" | "medium" | "short";

export type UndertoneId = "warm" | "cool" | "neutral";

/** Packet + UI use `deep`. `dark` is accepted as an alias. */
export type ValueId = "light" | "medium" | "dark" | "deep";

export type ColorSourceId = "photo" | "season" | "aspects";

export type MetalPreferenceId = "gold" | "silver" | "both";

export type ColorSwatch = {
  name: string;
  hex: string;
};

export type ChromaId = "bright" | "muted";

export type OccasionId = "work" | "weekend" | "night" | "travel" | "event";

export type ItemCategory =
  | "outerwear"
  | "knit"
  | "shirt"
  | "tee"
  | "trousers"
  | "shorts"
  | "shoes"
  | "accessory";

export type ColorId =
  | "navy"
  | "black"
  | "white"
  | "grey"
  | "camel"
  | "cream"
  | "chocolate"
  | "olive"
  | "stone"
  | "sand"
  | "charcoal"
  | "red"
  | "pink"
  | "peach"
  | "burgundy"
  | "blue"
  | "green"
  | "multi";

export type SeasonId =
  | "light-spring"
  | "true-spring"
  | "bright-spring"
  | "light-summer"
  | "true-summer"
  | "soft-summer"
  | "soft-autumn"
  | "true-autumn"
  | "dark-autumn"
  | "dark-winter"
  | "true-winter"
  | "bright-winter";

export type VibeId = "minimal" | "classic" | "street" | "soft";

export type HardNoId = "logos" | "neon" | "ultra-baggy" | "heels";

export type PriorityId =
  | "comfort"
  | "fit"
  | "fabric"
  | "ease"
  | "versatility"
  | "polish"
  | "stretch";

export interface Localized {
  en: string;
  pt: string;
}

export interface CatalogItem {
  id: string;
  name: Localized;
  category: ItemCategory;
  priceEur: number;
  color: ColorId;
  vibeTags: Array<"work" | "weekend" | "date" | "travel" | "smart-casual" | "evening">;
  brand?: string;
  imageUrl?: string;
}

export interface LookTemplate {
  id: string;
  title: string;
  why: string;
  occasion: OccasionId;
  colors: ColorId[];
  imageUrl: string;
  slots: ItemCategory[];
  cluster: string;
  itemIds: string[];
  gender: GenderId;
}

export interface Look {
  id: string;
  number: number;
  title: string;
  why: string;
  occasion: OccasionId;
  items: CatalogItem[];
  total: number;
  imageUrl: string;
}

export interface ProfileSession {
  name: string;
  path: PathKind;
  gender?: GenderId;
  shape?: ShapeId;
  torso?: TorsoId;
  undertone?: UndertoneId;
  value?: ValueId;
  chroma?: ChromaId;
  heightCm?: number;
  chestCm?: number;
  waistCm?: number;
  hipsCm?: number;
  inseamCm?: number;
  shoulderCm?: number;
  neckCm?: number;
  size: string;
  occasions: OccasionId[];
  /** Last Style-chat details ("dinner, keep it easy") — sent as `occasionNote` on the packet. */
  styleBrief?: string;
  /** UTC YYYY-MM-DD of the last free 4-look generate (1/day cap). */
  lastFreeGenerateDay?: string;
  colors: ColorId[];
  vibes: VibeId[];
  priorities: PriorityId[];
  hardNos: HardNoId[];
  notes: string;
  budgetMin: number;
  budgetMax: number;
  season?: SeasonId;
  seasonSecondary?: SeasonId;
  colorNote?: string;
  colorSource?: ColorSourceId;
  hasFacePhoto?: boolean;
  metalPreference?: MetalPreferenceId;
  colorSwatches?: ColorSwatch[];
  likedStyleIds: string[];
  dislikedStyleIds: string[];
  /** Colors they like to wear — not “flattering near the face.” */
  favColors?: ColorSwatch[];
  lookAge?: LookAgeId;
  appearance?: AppearanceTags;
  styleCursor?: number;
  styleDeckIds?: string[];
  styleCardShownAt?: Record<string, number>;
  /** Aggregated swipe + look-feedback axes for Stylist. */
  styleSignals?: import("./style-signals").StyleSignalsV1;
  /** Per-look votes; replayed on top of the swipe quiz prior. */
  lookFeedback?: LookFeedbackVote[];
  deepDone: Partial<Record<DeepStep, boolean>>;
  seed: number;
  generated?: boolean;
  stylistRequestId?: string;
  /** Recent request ids so lookbook can poll an older ingest if the cookie moved on. */
  stylistRequestIds?: string[];
  /** Used to ignore double-submit Generate within a few seconds. */
  stylistRequestedAt?: number;
  /** Stable daily generate-budget identity (not the Stylist request id). */
  generateUserKey?: string;
  /** First unpaid Generate already used — later boards are Premium. */
  hasUsedFreeBoard?: boolean;
  /** Local mock Premium unlock. No Stripe. */
  hasPremium?: boolean;
  /** Soft location for Stylist seasonality (city/region/country/timezone). */
  locale?: {
    city?: string;
    region?: string;
    country?: string;
    timezone?: string;
    lat?: number;
    lng?: number;
  };
  /** Outerwear band for current month: hot|warm|mild|cool|cold. */
  climateBand?: "hot" | "warm" | "mild" | "cool" | "cold";
}

export type LookFeedbackVote = {
  requestId: string;
  lookId: string;
  vote: "like" | "dislike" | "skip";
  reasons?: string[];
  at: string;
  look?: {
    title?: string;
    hook?: string;
    formula?: string;
    why?: string;
    pieces?: Array<{
      id?: string;
      role?: string;
      name?: string;
      brand?: string;
      price?: number;
      currency?: string;
      image?: string;
      shopUrl?: string;
    }>;
    heroImage?: string;
    fittingUrl?: string;
    aesthetics?: string[];
    vibe?: string;
  };
};

export type LookAgeId = "younger" | "mid" | "mature" | "mixed";

export type HairColorId = "black" | "brunette" | "auburn" | "blonde" | "red" | "gray";
export type HairLengthId = "short" | "medium" | "long";
export type EyeColorId = "brown" | "hazel" | "green" | "blue" | "gray";
export type SkinToneBandId = "fair" | "light" | "medium" | "medium-deep" | "deep" | "deep-rich";

/** Editable guesses for fittings — not a paid vision product. */
export type AppearanceTags = {
  hairColor?: HairColorId;
  hairLength?: HairLengthId;
  eyes?: EyeColorId;
  skinToneBand?: SkinToneBandId;
};

export type DeepStep =
  | "photos"
  | "measurements"
  | "color"
  | "styles"
  | "prefs"
  | "budget";

/** Apparel role for closet tiles + Stylist mix. Female apparel only. */
export type ClosetRole =
  | "top"
  | "bottom"
  | "dress"
  | "outerwear"
  | "sweater"
  | "cardigan"
  | "knit"
  | "shirt"
  | "tee"
  | "trousers"
  | "shorts"
  | "shoes"
  | "bag"
  | "accessory"
  | "other";

export type ClosetFlatLayStatus = "pending" | "ready" | "skipped" | "failed";

export interface ClosetItem {
  id: string;
  name: string;
  role: ClosetRole;
  /** Legacy field — kept so older cookies and Elevate still parse. */
  category: ItemCategory | "other";
  color: ColorId | "other";
  colorNote?: string;
  /** Durable cutout (data URL or hosted). Same spirit as Store collage tiles. */
  cutoutUrl?: string;
  imageDataUrl?: string;
  /** rembg / quick cutout kept when polish replaces cutoutUrl. */
  rawCutoutUrl?: string;
  /** Flat-lay polish lifecycle — hang-rack prefers polished cutoutUrl when ready. */
  flatLayStatus?: ClosetFlatLayStatus;
  source: "photo" | "video" | "manual";
  gender: "female";
}

export const CLOSET_FREE_CAP = 10; // freemium: 10 closet items on free (see src/lib/freemium.ts)
export const CLOSET_INVITE_KEY = "atelier.closetInvite.v1";

export interface StyleCard {
  id: string;
  gender: GenderId;
  cluster: string;
  label: string;
  hook?: string;
  imageUrl: string;
}

export const SESSION_COOKIE = "atelier.v2";
export const CLOSET_COOKIE = "atelier.closet.v2";
export const CLOSET_KEY = "atelier.closet.v2";
export const MEDIA_KEY = "atelier.media.v2";
export const LIKED_LOOKS_KEY = "atelier.likedLooks.v1";

/** Legacy home tour key — kept so existing installs stay marked done. */
export const NAV_TOUR_KEY = "atelier.navTour.v1";
/** One-time post-profile Style · Lookbook · Closet · Profile demo (after budget). */
export const POST_PROFILE_DEMO_KEY = "atelier.postProfileDemo.v1";
/** Guards first-board auto storeFirst so landing Style never double-fires. */
export const FIRST_BOARD_AUTO_KEY = "atelier.firstBoardAuto.v1";
