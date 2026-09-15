import { AESTHETIC_LABELS, LOCKED_AESTHETICS, normalizeAestheticId, styleCardById, type StyleCardV1 } from "./style-cards";

export type SignalPiece = {
  id?: string;
  role?: string;
  name?: string;
  price?: number;
  color?: string;
};

export type LookSignalInput = {
  title?: string;
  hook?: string;
  formula?: string;
  why?: string;
  pieces?: SignalPiece[];
  levelUp?: SignalPiece[];
  aesthetics?: string[];
  vibe?: string;
  lookTotal?: { amount?: number } | number;
};

export type StyleSignalsAvoidV1 = {
  pieceIds: string[];
  classes: string[];
  /** Look ids the user voted No on — Stylist may soft-avoid near-dup boards. */
  lookIds?: string[];
};

export type DislikeReasonOption = { id: string; label: string };

export const STYLE_SIGNALS_KIND = "atelier.styleSignals.v1" as const;

export const LEAN_AXES = [
  "colorIntensity",
  "fit",
  "accessories",
  "accessoryScale",
  "jewelryAmount",
  "structureVsDrape",
  "coverage",
  "patternVsSolid",
  "footwear",
  "formality",
  "statementLevel",
] as const;

export type LeanAxis = (typeof LEAN_AXES)[number];
export type LeanMap = Partial<Record<LeanAxis, number>>;

export type ColorIntensityTag = "muted" | "mixed" | "bright";
export type FitTag = "fitted" | "relaxed" | "oversized";
export type AccessoriesTag = "minimal" | "moderate" | "statement";
export type AccessoryScaleTag = "small" | "medium" | "big";
export type JewelryAmountTag = "minimal" | "layered" | "stack";
export type StructureTag = "structured" | "mixed" | "drapey";
export type CoverageTag = "open" | "balanced" | "covered";
export type PatternTag = "solid" | "textured" | "printed";
export type FootwearTag = "heels" | "flats" | "boots" | "bare/sandal";
export type FormalityTag = "casual" | "smart-casual" | "polished";
export type StatementTag = "quiet" | "balanced" | "bold";

export type CardSignals = {
  colorIntensity: ColorIntensityTag;
  fit: FitTag;
  accessories: AccessoriesTag;
  accessoryScale: AccessoryScaleTag;
  jewelryAmount: JewelryAmountTag;
  structureVsDrape: StructureTag;
  coverage: CoverageTag;
  patternVsSolid: PatternTag;
  footwear: FootwearTag;
  formality: FormalityTag;
  statementLevel: StatementTag;
  signalTags: string[];
};

export type StyleSignalsV1 = {
  kind: typeof STYLE_SIGNALS_KIND;
  source: "swipe-quiz" | "swipe-quiz+look-feedback";
  swipe: { shown: number; liked: number; disliked: number };
  lean: LeanMap;
  leanScale: Record<LeanAxis, string>;
  tags: { liked: string[]; disliked: string[] };
  feedback?: {
    lookVotes: number;
    lastLookId?: string;
    lastVote?: "like" | "dislike" | "skip";
    lastReasons?: string[];
  };
  avoid?: StyleSignalsAvoidV1;
  /** -1 spend OK … +1 prefer cheaper (from too-expensive / over-budget). */
  budgetBias?: number;
  /** Short hashes of prior board piece-id cores (sorted ids) so Stylist hard-bans near-dups. */
  recentServedCoreHashes?: string[];
};

export const LEAN_SCALE: Record<LeanAxis, string> = {
  colorIntensity: "soft(-1) … bold(+1)",
  fit: "fitted(-1) … loose(+1)",
  accessories: "minimal(-1) … finished(+1)",
  accessoryScale: "small(-1) … big(+1)",
  jewelryAmount: "small(-1) … big(+1)",
  structureVsDrape: "structure(-1) … drape(+1)",
  coverage: "covered(-1) … open(+1)",
  patternVsSolid: "solid(-1) … pattern(+1)",
  footwear: "flat/loafer(-1) … heel(+1)",
  formality: "casual(-1) … polished(+1)",
  statementLevel: "quiet(-1) … statement(+1)",
};

const POLARITY: {
  [K in LeanAxis]: Record<string, number>;
} = {
  colorIntensity: { muted: -1, mixed: 0, bright: 1 },
  fit: { fitted: -1, relaxed: 0, oversized: 1 },
  accessories: { minimal: -1, moderate: 0, statement: 1 },
  accessoryScale: { small: -1, medium: 0, big: 1 },
  jewelryAmount: { minimal: -1, layered: 0.75, stack: 1 },
  structureVsDrape: { structured: -1, mixed: 0, drapey: 1 },
  coverage: { covered: -1, balanced: 0, open: 1 },
  patternVsSolid: { solid: -1, textured: 0, printed: 1 },
  footwear: { flats: -1, "bare/sandal": -0.4, boots: -0.15, heels: 1 },
  formality: { casual: -1, "smart-casual": 0, polished: 1 },
  statementLevel: { quiet: -1, balanced: 0, bold: 1 },
};

export const LOOK_VOTE_NUDGE = 0.1;
export const LOOK_VOTE_WEIGHT = 0.25;
export const LOOK_VOTE_CATCHUP = 8;
export const QUIZ_PRIOR_WEIGHT = 1;

/** Per-look mix toward inferred axes. Quiz stays weight 1.0; look is 0.25 until ~8 votes, then 0.12 catch-up. */
export function lookVoteMix(priorLookVotes: number): number {
  const lookWeight = priorLookVotes >= LOOK_VOTE_CATCHUP ? QUIZ_PRIOR_WEIGHT : LOOK_VOTE_WEIGHT;
  const raw = lookWeight / (QUIZ_PRIOR_WEIGHT + lookWeight);
  const cap = priorLookVotes >= LOOK_VOTE_CATCHUP ? 0.12 : 0.1;
  return clampLean(Math.min(cap, raw));
}

export function clampLean(value: number): number {
  if (value > 1) return 1;
  if (value < -1) return -1;
  return Math.round(value * 1000) / 1000;
}

export function cardPolarity(card: Pick<StyleCardV1, LeanAxis | "signalTags"> | CardSignals): LeanMap {
  const lean: LeanMap = {};
  for (const axis of LEAN_AXES) {
    const raw = card[axis];
    if (!raw) continue;
    const value = POLARITY[axis][raw];
    if (typeof value === "number") lean[axis] = value;
  }
  return lean;
}

function addToken(list: string[], token: string) {
  const value = token.trim().toLowerCase();
  if (!value || list.includes(value)) return;
  list.push(value);
}

function mergeTokens(base: string[], extra: string[], limit = 16): string[] {
  const next = [...base];
  for (const token of extra) addToken(next, token);
  return next.slice(0, limit);
}

export function aggregateStyleSignalsFromVotes(input: {
  likedIds: string[];
  dislikedIds: string[];
  shown?: number;
}): StyleSignalsV1 {
  const sums: Record<LeanAxis, { total: number; n: number }> = {
    colorIntensity: { total: 0, n: 0 },
    fit: { total: 0, n: 0 },
    accessories: { total: 0, n: 0 },
    accessoryScale: { total: 0, n: 0 },
    jewelryAmount: { total: 0, n: 0 },
    structureVsDrape: { total: 0, n: 0 },
    coverage: { total: 0, n: 0 },
    patternVsSolid: { total: 0, n: 0 },
    footwear: { total: 0, n: 0 },
    formality: { total: 0, n: 0 },
    statementLevel: { total: 0, n: 0 },
  };
  const likedTags: string[] = [];
  const dislikedTags: string[] = [];

  function apply(id: string, direction: 1 | -1) {
    const card = styleCardById(id);
    if (!card) return;
    const polar = cardPolarity(card);
    for (const axis of LEAN_AXES) {
      const value = polar[axis];
      if (typeof value !== "number") continue;
      sums[axis].total += value * direction;
      sums[axis].n += 1;
    }
    for (const tag of card.signalTags ?? []) {
      addToken(direction === 1 ? likedTags : dislikedTags, tag);
    }
  }

  for (const id of input.likedIds) apply(id, 1);
  for (const id of input.dislikedIds) apply(id, -1);

  const lean: LeanMap = {};
  for (const axis of LEAN_AXES) {
    // Omit an axis with no votes. Keep 0 when votes cancelled — that is a signal.
    if (!sums[axis].n) continue;
    lean[axis] = clampLean(sums[axis].total / sums[axis].n);
  }

  return {
    kind: STYLE_SIGNALS_KIND,
    source: "swipe-quiz",
    swipe: {
      shown: input.shown ?? input.likedIds.length + input.dislikedIds.length,
      liked: input.likedIds.length,
      disliked: input.dislikedIds.length,
    },
    lean,
    leanScale: { ...LEAN_SCALE },
    tags: {
      liked: likedTags.slice(0, 16),
      disliked: dislikedTags.filter((tag) => !likedTags.includes(tag)).slice(0, 16),
    },
  };
}

/** Locked packet field for `atelier.stylistRequest.v1`. No cardVotes[]. */
export type StyleSignalsFeedbackV1 = {
  lookVotes: number;
  lastLookId?: string;
  lastVote?: "like" | "dislike" | "skip";
  lastReasons?: string[];
};

export type StylistStyleSignalsV1 = {
  kind: typeof STYLE_SIGNALS_KIND;
  source: "swipe-quiz";
  swipe: { shown: number; liked: number; disliked: number };
  lean: LeanMap;
  leanScale: Record<LeanAxis, string>;
  tags: { liked: string[]; disliked: string[] };
  feedback?: StyleSignalsFeedbackV1;
  avoid?: StyleSignalsAvoidV1;
  budgetBias?: number;
  recentServedCoreHashes?: string[];
};

export function toStylistStyleSignals(raw: StyleSignalsV1 | undefined): StylistStyleSignalsV1 | undefined {
  const value = raw ? parseStyleSignals(raw) : undefined;
  if (!value) return undefined;
  const hasVotes = value.swipe.shown > 0 || value.swipe.liked > 0 || value.swipe.disliked > 0;
  const hasLean = LEAN_AXES.some((axis) => typeof value.lean[axis] === "number");
  const hasLookVotes = (value.feedback?.lookVotes ?? 0) > 0;
  const hasAvoid = Boolean(
    value.avoid?.pieceIds?.length || value.avoid?.classes?.length || value.avoid?.lookIds?.length
  );
  const hasBudget = typeof value.budgetBias === "number" && value.budgetBias !== 0;
  const hashes = (value.recentServedCoreHashes ?? []).map(String).filter(Boolean).slice(0, 24);
  const hasHashes = hashes.length > 0;
  if (!hasVotes && !hasLean && !hasLookVotes && !hasAvoid && !hasBudget && !hasHashes) return undefined;

  const lean: LeanMap = {};
  for (const axis of LEAN_AXES) {
    const n = value.lean[axis];
    if (typeof n !== "number" || Number.isNaN(n)) continue;
    lean[axis] = clampLean(n);
  }

  return {
    kind: STYLE_SIGNALS_KIND,
    source: "swipe-quiz",
    swipe: {
      shown: value.swipe.shown,
      liked: value.swipe.liked,
      disliked: value.swipe.disliked,
    },
    lean,
    leanScale: { ...LEAN_SCALE },
    tags: {
      liked: value.tags.liked,
      disliked: value.tags.disliked.filter((tag) => !value.tags.liked.includes(tag)),
    },
    // Always include feedback + avoid shells once any look vote / avoid / hashes exist so Stylist can hard-ban.
    ...(hasLookVotes || hasAvoid || hasHashes
      ? {
          feedback: {
            lookVotes: value.feedback?.lookVotes ?? 0,
            lastLookId: value.feedback?.lastLookId,
            lastVote: value.feedback?.lastVote,
            lastReasons: (value.feedback?.lastReasons ?? []).filter((id) => Boolean(normalizeLockedReasonId(id))),
          },
          avoid: {
            pieceIds: (value.avoid?.pieceIds ?? []).map(String).filter(Boolean).slice(0, 40),
            classes: (value.avoid?.classes ?? []).map(String).filter(Boolean).slice(0, 24),
            lookIds: (value.avoid?.lookIds ?? []).map(String).filter(Boolean).slice(0, 40),
          },
        }
      : value.feedback?.lookVotes
        ? {
            feedback: {
              lookVotes: value.feedback.lookVotes,
              lastLookId: value.feedback.lastLookId,
              lastVote: value.feedback.lastVote,
              lastReasons: (value.feedback.lastReasons ?? []).filter((id) => Boolean(normalizeLockedReasonId(id))),
            },
          }
        : {}),
    ...(hasBudget ? { budgetBias: clampLean(value.budgetBias as number) } : {}),
    ...(hasHashes ? { recentServedCoreHashes: hashes } : {}),
  };
}

/** Stable short hash of a look's core piece ids (sorted) for near-dup bans. */
export function coreHashFromPieceIds(ids: Array<string | undefined | null>): string {
  const key = [...new Set(ids.map((id) => (id ?? "").trim()).filter(Boolean))].sort().join("|");
  if (!key) return "";
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** Packet-ready styleSignals: always carries avoid.pieceIds + feedback.lastReasons/lastLookId. */
export function ensurePacketStyleSignals(raw: StyleSignalsV1 | undefined): StylistStyleSignalsV1 {
  const base = toStylistStyleSignals(raw) ?? {
    kind: STYLE_SIGNALS_KIND,
    source: "swipe-quiz" as const,
    swipe: { shown: 0, liked: 0, disliked: 0 },
    lean: {},
    leanScale: { ...LEAN_SCALE },
    tags: { liked: [], disliked: [] },
  };
  return {
    ...base,
    feedback: {
      lookVotes: base.feedback?.lookVotes ?? 0,
      lastLookId: base.feedback?.lastLookId,
      lastVote: base.feedback?.lastVote,
      lastReasons: base.feedback?.lastReasons ?? [],
    },
    avoid: {
      pieceIds: base.avoid?.pieceIds ?? [],
      classes: base.avoid?.classes ?? [],
      lookIds: base.avoid?.lookIds ?? [],
    },
    ...(base.recentServedCoreHashes?.length ? { recentServedCoreHashes: base.recentServedCoreHashes } : {}),
  };
}

export function lookText(look: LookSignalInput): string {
  return [look.title, look.hook, look.formula, look.why, look.vibe, ...(look.aesthetics ?? []), ...(look.pieces ?? []).map((piece) => `${piece.role} ${piece.name}`)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** Locked aesthetic names mentioned on the look — used when “not my vibe” is chosen. */
export function inferLookAesthetics(look: LookSignalInput): string[] {
  const text = lookText(look);
  const named = (look.aesthetics ?? [])
    .map((name) => normalizeAestheticId(name))
    .filter((name): name is (typeof LOCKED_AESTHETICS)[number] => Boolean(name));
  const hits = LOCKED_AESTHETICS.filter((id) => {
    const label = AESTHETIC_LABELS[id].toLowerCase();
    return text.includes(id) || text.includes(label);
  });
  return [...named, ...hits].filter((name, index, all) => all.indexOf(name) === index);
}

export function inferLookLean(look: LookSignalInput): { lean: LeanMap; tags: string[] } {
  const text = lookText(look);
  const lean: LeanMap = {};
  const tags: string[] = [];

  const hit = (re: RegExp) => re.test(text);

  if (hit(/bright|colorful|vivid|red|cobalt/)) lean.colorIntensity = 0.7;
  else if (hit(/muted|camel|navy|cream|stone|grey|gray|olive/)) lean.colorIntensity = -0.5;

  if (hit(/oversized|slouch|baggy|wide[- ]leg/)) lean.fit = 0.6;
  else if (hit(/fitted|slim|tailored|cigarette/)) lean.fit = -0.6;

  if (hit(/scarf|belt|tote|clutch|statement/)) lean.accessories = 0.5;
  else if (hit(/bare|minimal/)) lean.accessories = -0.4;

  if (hit(/drape|slip|fluid|soft knit/)) lean.structureVsDrape = 0.5;
  else if (hit(/blazer|structured|tailor|coat/)) lean.structureVsDrape = -0.5;

  if (hit(/crop|mini|low[- ]cut|one[- ]shoulder|tank/)) {
    lean.coverage = 0.6;
    addToken(tags, "crop");
  } else if (hit(/turtleneck|covered|midi|maxi|high[- ]neck/)) lean.coverage = -0.5;

  if (hit(/print|floral|stripe|houndstooth|leopard|pinstripe/)) {
    lean.patternVsSolid = 0.7;
    addToken(tags, "print");
  } else if (hit(/solid|monochrome|tonal/)) {
    lean.patternVsSolid = -0.5;
    addToken(tags, "monochrome");
  }

  if (hit(/heel|pump|slingback/)) {
    lean.footwear = 0.8;
    addToken(tags, "heel");
  } else if (hit(/boot/)) {
    lean.footwear = -0.15;
    addToken(tags, "boot");
  } else if (hit(/loafer|flat|sneaker/)) {
    lean.footwear = -0.8;
    addToken(tags, hit(/sneaker/) ? "chunky-sneaker" : "loafer");
  }

  if (hit(/evening|polish|work|blazer|pump/)) lean.formality = 0.5;
  else if (hit(/weekend|casual|denim|tee/)) lean.formality = -0.5;

  if (hit(/bold|statement|loud/)) lean.statementLevel = 0.6;
  else if (hit(/quiet|minimal|simple/)) lean.statementLevel = -0.5;

  if (hit(/belt/)) addToken(tags, "belt");
  if (hit(/drape/)) addToken(tags, "drape");
  if (hit(/mini/)) addToken(tags, "mini");

  if (hit(/no[- ]jewelry|bare neck|unadorned/)) {
    lean.jewelryAmount = -1;
    addToken(tags, "no-jewelry");
  } else if (hit(/stack(ed)? (bracelet|ring)|many bracelet|bracelet stack|ring stack/)) {
    lean.jewelryAmount = 1;
    addToken(tags, "jewelry-stack");
  } else if (hit(/layered necklace|layer(ed)? (gold |silver )?necklace|necklace stack/)) {
    lean.jewelryAmount = 0.75;
    addToken(tags, "jewelry-layered");
  } else if (hit(/necklace|bracelet|ring|earring|jewelry/)) {
    lean.jewelryAmount = -0.35;
    addToken(tags, "jewelry-minimal");
  }

  return { lean, tags };
}

const DISLIKE_REASON_LEAN: Record<string, LeanMap> = {
  "too-dark": { colorIntensity: -0.5, coverage: -0.5 },
  "too-colorful": { colorIntensity: -0.6, patternVsSolid: -0.4 },
  "too-revealing": { coverage: -0.6 },
  "too-simple": { statementLevel: 0.5, accessories: 0.4 },
  "too-fitted": { fit: 0.5 },
  "too-loose": { fit: -0.5 },
  "too-dressy": { formality: -0.5 },
  "too-casual": { formality: 0.5 },
  "wrong-shoes": {},
  "too-many-accessories": { accessories: -0.5, accessoryScale: -0.3 },
  "not-enough-finish": { accessories: 0.5 },
  "accessories-too-big": { accessoryScale: -0.7 },
  "accessories-too-small": { accessoryScale: 0.7 },
  "jewelry-too-much": { jewelryAmount: -0.7 },
  "jewelry-too-little": { jewelryAmount: 0.7 },
  "no-jewelry": { jewelryAmount: -1 },
  "print-too-loud": { patternVsSolid: -0.6, statementLevel: -0.4 },
  "not-my-vibe": {},
  "too-stiff": { structureVsDrape: 0.5 },
  "wrong-footwear": {},
  "too-beige": { colorIntensity: 0.4 },
  "prefer-less-beige": { colorIntensity: 0.4 },
  "too-expensive": {},
  "over-budget": {},
  "wont-wear-again": {},
  skip: {},
};

const DISLIKE_REASON_TAGS: Record<string, string[]> = {
  "too-colorful": ["loud-color", "busy-print"],
  "too-simple": ["bare", "unfinished"],
  "too-fitted": ["too-fitted"],
  "too-loose": ["too-loose"],
  "too-dressy": ["too-dressy"],
  "too-casual": ["too-casual"],
  "wrong-shoes": ["wrong-shoes"],
  "too-many-accessories": ["too-many-accessories"],
  "not-enough-finish": ["not-enough-finish"],
  "jewelry-too-much": ["jewelry-too-much"],
  "jewelry-too-little": ["jewelry-too-little"],
  "no-jewelry": ["no-jewelry"],
  "print-too-loud": ["print-too-loud"],
  "not-my-vibe": ["not-my-vibe"],
  "too-stiff": ["too-stiff"],
  "wrong-footwear": ["wrong-shoes"],
  "too-beige": ["avoid-beige", "too-neutral"],
  "prefer-less-beige": ["avoid-beige", "too-neutral"],
  "too-expensive": ["price-sensitive"],
  "over-budget": ["price-sensitive"],
  "wont-wear-again": ["wont-wear-again"],
};

function dislikeReasonTags(reason: string, look: LookSignalInput): string[] {
  if (reason === "skip") return [];
  if (reason === "too-revealing") {
    const text = lookText(look);
    const tags: string[] = [];
    if (/crop|midriff/.test(text)) tags.push("crop");
    if (/low[- ]cut|plunge|cleavage/.test(text)) tags.push("low-cut");
    if (/\bmini\b/.test(text)) tags.push("mini");
    return tags;
  }
  if (reason === "too-dark") return [];
  return DISLIKE_REASON_TAGS[reason] ?? [reason];
}

export const CORE_DISLIKE_REASONS = [
  { id: "too-dark", label: "Too dark" },
  { id: "too-colorful", label: "Too colorful / too bright" },
  { id: "too-revealing", label: "Too revealing" },
  { id: "too-simple", label: "Too simple / too plain" },
] as const;

export const LOCKED_DISLIKE_REASONS: readonly DislikeReasonOption[] = [
  { id: "too-dark", label: "Too dark" },
  { id: "too-colorful", label: "Too colorful / too bright" },
  { id: "too-revealing", label: "Too revealing" },
  { id: "too-simple", label: "Too simple / too plain" },
  { id: "too-beige", label: "Too beige / too muted" },
  { id: "too-expensive", label: "Too expensive" },
  { id: "wont-wear-again", label: "Won’t wear again" },
  { id: "too-fitted", label: "Too fitted" },
  { id: "too-loose", label: "Too loose" },
  { id: "too-dressy", label: "Too dressy" },
  { id: "too-casual", label: "Too casual" },
  { id: "wrong-shoes", label: "Wrong footwear" },
  { id: "too-many-accessories", label: "Too many accessories" },
  { id: "not-enough-finish", label: "Not enough finish" },
  { id: "accessories-too-big", label: "Accessories too big" },
  { id: "accessories-too-small", label: "Accessories too small" },
  { id: "jewelry-too-much", label: "Too much jewelry" },
  { id: "jewelry-too-little", label: "Not enough jewelry" },
  { id: "no-jewelry", label: "No jewelry" },
  { id: "print-too-loud", label: "Print too loud" },
  { id: "not-my-vibe", label: "Not my vibe" },
  { id: "too-stiff", label: "Too stiff" },
] as const;

const LOCKED_REASON_IDS = new Set(LOCKED_DISLIKE_REASONS.map((item) => item.id));

/** Accept aliases; never persist an LLM label as the durable key. */
export const REASON_ID_ALIASES: Record<string, string> = {
  "prefer-less-beige": "too-beige",
  "over-budget": "too-expensive",
  "wrong-footwear": "wrong-shoes",
};

export function normalizeLockedReasonId(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const id = String(raw).trim().toLowerCase();
  if (!id) return undefined;
  if (id === "skip") return "skip";
  const mapped = REASON_ID_ALIASES[id] ?? id;
  return LOCKED_REASON_IDS.has(mapped) ? mapped : undefined;
}

export function dislikeReasonLabel(id: string): string {
  const locked = normalizeLockedReasonId(id);
  if (!locked || locked === "skip") return "Skip";
  return LOCKED_DISLIKE_REASONS.find((item) => item.id === locked)?.label ?? locked;
}

const CORE_ROLES = new Set([
  "outerwear",
  "knit",
  "sweater",
  "cardigan",
  "shirt",
  "tee",
  "top",
  "trousers",
  "shorts",
  "bottom",
  "dress",
]);

const BEIGE_RE = /\bbeige\b|\bcamel\b|\bcream\b|\bstone\b|\bsand\b|\btaupe\b|\becru\b|\bivory\b|\boatmeal\b|\bkhaki\b|\bwheat\b|\bchampagne\b/;
const COLORFUL_RE = /\bbright\b|\bcolorful\b|\bvivid\b|\bcobalt\b|\bfuchsia\b|\bmagenta\b|\bneon\b|\bscarlet\b|\bemerald\b|\braspberry\b/;
const DARK_RE = /\bblack\b|\bcharcoal\b|\bnavy\b|\bindigo\b|\bespresso\b|\bdark\b/;
const REVEAL_RE = /\bcrop\b|\bmidriff\b|\bmini\b|\blow[- ]cut\b|\bplunge\b|\bcleavage\b|\bone[- ]shoulder\b/;
const COVER_RE = /\bturtleneck\b|\bcovered\b|\bmidi\b|\bmaxi\b|\bhigh[- ]neck\b|\blong[- ]sleeve\b|\bfull coverage\b/;
const SIMPLE_RE = /\bsimple\b|\bplain\b|\bbare\b|\bminimal\b|\bquiet\b|\bunfinished\b/;

export function lookIsBeigeNeutral(look: LookSignalInput): boolean {
  const text = lookText(look);
  if (COLORFUL_RE.test(text)) return false;
  return BEIGE_RE.test(text) || (/\bmuted\b|\bneutral\b/.test(text) && !DARK_RE.test(text));
}

export function lookIsFullyCovered(look: LookSignalInput): boolean {
  const text = lookText(look);
  if (REVEAL_RE.test(text)) return false;
  const { lean } = inferLookLean(look);
  return COVER_RE.test(text) || (typeof lean.coverage === "number" && lean.coverage < 0);
}

export function lookIsExpensive(look: LookSignalInput, budgetMax?: number): boolean {
  if (!budgetMax || budgetMax <= 0) return false;
  const pieces = look.pieces ?? [];
  const core = pieces.filter((piece) => piece.role && CORE_ROLES.has(piece.role));
  const pool = core.length ? core : pieces.filter((piece) => piece.role !== "accessory" && piece.role !== "bag");
  if (pool.some((piece) => typeof piece.price === "number" && piece.price > budgetMax * 0.6)) return true;
  const stated =
    typeof look.lookTotal === "number"
      ? look.lookTotal
      : look.lookTotal && typeof look.lookTotal === "object"
        ? look.lookTotal.amount
        : undefined;
  const total =
    typeof stated === "number" && Number.isFinite(stated)
      ? stated
      : pieces.reduce((sum, piece) => sum + (typeof piece.price === "number" ? piece.price : 0), 0);
  return total > budgetMax;
}

function lookHasSpecificPieces(look: LookSignalInput): boolean {
  return (look.pieces ?? []).some((piece) => Boolean(piece.id));
}

function lookColorToken(piece: SignalPiece, text: string): string | undefined {
  const blob = `${piece.color ?? ""} ${piece.name ?? ""} ${text}`.toLowerCase();
  if (BEIGE_RE.test(blob)) return "beige";
  if (/\bblack\b/.test(blob)) return "black";
  if (/\bnavy\b/.test(blob)) return "navy";
  if (/\bcream\b|\bivory\b/.test(blob)) return "cream";
  if (/\bcrop\b/.test(blob)) return "crop";
  return undefined;
}

function inferAvoidClasses(look: LookSignalInput): string[] {
  const text = lookText(look);
  const classes: string[] = [];
  for (const piece of look.pieces ?? []) {
    const role = (piece.role ?? "").trim().toLowerCase().replace(/\s+/g, "-");
    if (!role) continue;
    const color = lookColorToken(piece, text);
    if (color) addToken(classes, `${color}-${role}`);
    if (/\bcrop\b/.test(`${piece.name ?? ""} ${text}`) && (role === "top" || role === "tee" || role === "knit")) {
      addToken(classes, "crop-top");
    }
  }
  if (BEIGE_RE.test(text) && /\bknit\b|\bsweater\b/.test(text)) addToken(classes, "beige-knit-top");
  if (/\bcrop\b/.test(text)) addToken(classes, "crop-top");
  return classes;
}

export function lookAwareDislikeReasons(
  look: LookSignalInput,
  opts?: { budgetMax?: number }
): DislikeReasonOption[] {
  const { lean } = inferLookLean(look);
  const roles = new Set((look.pieces ?? []).map((piece) => piece.role));
  const extras: DislikeReasonOption[] = [];
  const add = (id: string) => {
    if (extras.some((item) => item.id === id)) return;
    extras.push({ id, label: dislikeReasonLabel(id) });
  };

  if (lookIsBeigeNeutral(look)) add("too-beige");
  if (lookIsExpensive(look, opts?.budgetMax)) add("too-expensive");
  if (lookHasSpecificPieces(look)) add("wont-wear-again");

  if (typeof lean.fit === "number") {
    if (lean.fit < 0) add("too-fitted");
    else if (lean.fit > 0) add("too-loose");
    else {
      add("too-fitted");
      add("too-loose");
    }
  }
  if (typeof lean.formality === "number") {
    if (lean.formality > 0) add("too-dressy");
    else if (lean.formality < 0) add("too-casual");
    else {
      add("too-dressy");
      add("too-casual");
    }
  }
  if (typeof lean.footwear === "number" || roles.has("shoes")) add("wrong-shoes");
  const accessoryCount = (look.pieces ?? []).filter((piece) => piece.role === "accessory" || piece.role === "bag").length;
  if (accessoryCount >= 2 || (lean.accessories ?? 0) > 0.2) add("too-many-accessories");
  else if (typeof lean.accessories === "number" || roles.has("accessory") || roles.has("bag")) {
    add("not-enough-finish");
  }
  if ((lean.accessoryScale ?? 0) > 0.3) add("accessories-too-big");
  if ((lean.accessoryScale ?? 0) < -0.3) add("accessories-too-small");
  const jewelryText = lookText(look);
  const hasJewelry = /necklace|bracelet|ring|earring|jewelry|hoop/.test(jewelryText);
  if (hasJewelry || typeof lean.jewelryAmount === "number") {
    if ((lean.jewelryAmount ?? 0) > 0.25) add("jewelry-too-much");
    else if ((lean.jewelryAmount ?? 0) < -0.25) {
      add("jewelry-too-little");
      add("no-jewelry");
    } else {
      add("jewelry-too-much");
      add("jewelry-too-little");
    }
  }
  if ((lean.patternVsSolid ?? 0) > 0.2) add("print-too-loud");
  if ((lean.structureVsDrape ?? 0) < 0) add("too-stiff");
  if (inferLookAesthetics(look).length) add("not-my-vibe");
  return extras;
}

/** Deterministic top 4 look-specific reasons. Persist reasonId only. */
export function pickLookDislikeReasons(
  look: LookSignalInput,
  opts?: { budgetMax?: number }
): DislikeReasonOption[] {
  const text = lookText(look);
  const { lean } = inferLookLean(look);
  const extras = lookAwareDislikeReasons(look, opts);
  const extraIds = new Set(extras.map((item) => item.id));
  const beige = lookIsBeigeNeutral(look);
  const covered = lookIsFullyCovered(look);
  const colorful = COLORFUL_RE.test(text) || (lean.colorIntensity ?? 0) > 0.25;
  const dark = DARK_RE.test(text);
  const revealing = REVEAL_RE.test(text) || (lean.coverage ?? 0) > 0.2;
  const simple = SIMPLE_RE.test(text) || (lean.statementLevel ?? 0) < -0.2 || (lean.accessories ?? 0) < -0.2;

  const ranked: Array<{ id: string; score: number }> = [];
  const add = (id: string, score: number) => {
    const locked = normalizeLockedReasonId(id);
    if (!locked || locked === "skip") return;
    if (ranked.some((item) => item.id === locked)) return;
    ranked.push({ id: locked, score });
  };

  if (beige) add("too-beige", 100);
  if (extraIds.has("too-expensive")) add("too-expensive", 95);
  if (revealing && !covered) add("too-revealing", 90);
  if (simple) add("too-simple", 86);
  if (colorful && !beige) add("too-colorful", 82);
  if (dark && !beige) add("too-dark", 78);
  if (extraIds.has("too-many-accessories")) add("too-many-accessories", 72);
  if (extraIds.has("print-too-loud")) add("print-too-loud", 68);
  if (extraIds.has("too-fitted")) add("too-fitted", 62);
  if (extraIds.has("too-loose")) add("too-loose", 61);
  if (extraIds.has("too-dressy")) add("too-dressy", 56);
  if (extraIds.has("too-casual")) add("too-casual", 55);
  if (extraIds.has("wrong-shoes")) add("wrong-shoes", 50);
  if (extraIds.has("wont-wear-again")) add("wont-wear-again", 48);
  if (extraIds.has("too-stiff")) add("too-stiff", 40);
  if (extraIds.has("accessories-too-big")) add("accessories-too-big", 38);
  if (extraIds.has("jewelry-too-much")) add("jewelry-too-much", 36);
  if (extraIds.has("jewelry-too-little")) add("jewelry-too-little", 35);
  if (extraIds.has("no-jewelry")) add("no-jewelry", 34);
  if (extraIds.has("not-my-vibe")) add("not-my-vibe", 30);

  // CORE four when the look actually supports them.
  if (!beige && !colorful && dark) add("too-dark", 28);
  if (!simple && extras.length < 2) add("too-simple", 22);
  if (lookHasSpecificPieces(look)) add("wont-wear-again", 18);

  const fallback = ["too-simple", "wont-wear-again", beige ? "too-beige" : "too-dark", "not-my-vibe"];
  for (const id of fallback) {
    if (id === "too-revealing" && covered) continue;
    if (id === "too-colorful" && beige) continue;
    if (id === "wont-wear-again" && !lookHasSpecificPieces(look)) continue;
    add(id, 8);
  }

  ranked.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const picked = ranked.slice(0, 4).map((item) => ({ id: item.id, label: dislikeReasonLabel(item.id) }));
  if (picked.length < 4) {
    for (const option of LOCKED_DISLIKE_REASONS) {
      if (picked.length >= 4) break;
      if (option.id === "too-revealing" && covered) continue;
      if (option.id === "too-colorful" && beige) continue;
      if (picked.some((item) => item.id === option.id)) continue;
      picked.push({ id: option.id, label: option.label });
    }
  }
  return picked.slice(0, 4);
}

/** Quiz lean is the prior. Each look vote nudges ~0.08–0.12, stronger after ~8 votes. */
export function applyLookFeedback(
  current: StyleSignalsV1 | undefined,
  input: {
    vote: "like" | "dislike" | "skip";
    lookId: string;
    reasons?: string[];
    look: LookSignalInput;
  }
): StyleSignalsV1 {
  const base: StyleSignalsV1 = current ?? {
    kind: STYLE_SIGNALS_KIND,
    source: "swipe-quiz",
    swipe: { shown: 0, liked: 0, disliked: 0 },
    lean: {},
    leanScale: { ...LEAN_SCALE },
    tags: { liked: [], disliked: [] },
  };
  if (input.vote === "skip") {
    return {
      ...base,
      source: "swipe-quiz+look-feedback",
      leanScale: { ...LEAN_SCALE },
      avoid: base.avoid,
      budgetBias: base.budgetBias,
      feedback: {
        lookVotes: (base.feedback?.lookVotes ?? 0) + 1,
        lastLookId: input.lookId,
        lastVote: "skip",
        lastReasons: [],
      },
    };
  }

  const inferred = inferLookLean(input.look);
  const votes = base.feedback?.lookVotes ?? 0;
  const step = lookVoteMix(votes);
  const lean: LeanMap = { ...base.lean };
  const direction = input.vote === "like" ? 1 : -1;

  for (const axis of LEAN_AXES) {
    const polar = inferred.lean[axis];
    if (typeof polar !== "number") continue;
    lean[axis] = clampLean((lean[axis] ?? 0) + polar * direction * step);
  }

  let liked = [...(base.tags.liked ?? [])];
  let disliked = [...(base.tags.disliked ?? [])];
  let budgetBias = base.budgetBias;
  let avoid: StyleSignalsAvoidV1 | undefined = base.avoid
    ? {
        pieceIds: [...base.avoid.pieceIds],
        classes: [...base.avoid.classes],
        lookIds: [...(base.avoid.lookIds ?? [])],
      }
    : undefined;

  if (input.vote === "like") {
    liked = mergeTokens(liked, inferred.tags);
  } else {
    disliked = mergeTokens(disliked, inferred.tags);
    // Hard-ban voted-no pieces for Stylist (esp. shoes) — every dislike, not only wont-wear-again.
    const lookPieces = [...(input.look.pieces ?? []), ...(input.look.levelUp ?? [])];
    const allPieceIds = lookPieces.map((piece) => piece.id).filter((id): id is string => Boolean(id));
    const shoeIds = lookPieces
      .filter((piece) => {
        const role = (piece.role ?? "").toLowerCase();
        const name = piece.name ?? "";
        return role === "shoes" || role === "shoe" || /shoe|loafer|boot|heel|sandal|sneaker|mule|clog/i.test(name);
      })
      .map((piece) => piece.id)
      .filter((id): id is string => Boolean(id));
    const reasonIds = (input.reasons ?? [])
      .map((raw) => normalizeLockedReasonId(raw))
      .filter((id): id is string => Boolean(id));
    const banShoesFirst = reasonIds.includes("wrong-shoes") && shoeIds.length > 0;
    const banIds = banShoesFirst ? mergeTokens(shoeIds, allPieceIds, 40) : allPieceIds;
    if (banIds.length || input.lookId) {
      avoid = {
        pieceIds: mergeTokens(avoid?.pieceIds ?? [], banIds, 40),
        classes: mergeTokens(avoid?.classes ?? [], inferAvoidClasses(input.look), 24),
        lookIds: mergeTokens(avoid?.lookIds ?? [], input.lookId ? [input.lookId] : [], 40),
      };
    }
    for (const raw of input.reasons ?? []) {
      const reason = normalizeLockedReasonId(raw);
      if (!reason || reason === "skip") continue;
      const extra: LeanMap = { ...(DISLIKE_REASON_LEAN[reason] ?? DISLIKE_REASON_LEAN[raw] ?? {}) };
      if (reason === "wrong-shoes") {
        if (typeof inferred.lean.footwear === "number") {
          extra.footwear = inferred.lean.footwear === 0 ? -0.4 : -Math.sign(inferred.lean.footwear);
        }
      }
      for (const axis of LEAN_AXES) {
        const delta = extra[axis];
        if (typeof delta !== "number") continue;
        lean[axis] = clampLean((lean[axis] ?? 0) + delta * step);
      }
      disliked = mergeTokens(disliked, dislikeReasonTags(reason, input.look));
      if (reason === "not-my-vibe") {
        disliked = mergeTokens(
          disliked,
          inferLookAesthetics(input.look).map((name) => name.toLowerCase().replace(/\s+/g, "-"))
        );
      }
      if (reason === "too-expensive") {
        budgetBias = clampLean((budgetBias ?? 0) + 0.35);
      }
    }
  }

  const lastReasons =
    input.vote === "dislike"
      ? (input.reasons ?? [])
          .map((item) => normalizeLockedReasonId(item))
          .filter((id): id is string => Boolean(id))
      : [];

  return {
    ...base,
    kind: STYLE_SIGNALS_KIND,
    source: "swipe-quiz+look-feedback",
    lean,
    leanScale: { ...LEAN_SCALE },
    tags: {
      liked,
      disliked: disliked.filter((tag) => !liked.includes(tag)),
    },
    feedback: {
      lookVotes: votes + 1,
      lastLookId: input.lookId,
      lastVote: input.vote,
      lastReasons,
    },
    ...(input.vote === "dislike"
      ? {
          ...(typeof budgetBias === "number" ? { budgetBias } : {}),
          ...(avoid?.pieceIds.length || avoid?.classes.length || avoid?.lookIds?.length ? { avoid } : {}),
        }
      : {
          ...(typeof base.budgetBias === "number" ? { budgetBias: base.budgetBias } : {}),
          ...(base.avoid ? { avoid: base.avoid } : {}),
        }),
  };
}

export function parseStyleSignals(raw: unknown): StyleSignalsV1 | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const value = raw as Partial<StyleSignalsV1>;
  if (value.kind !== STYLE_SIGNALS_KIND) return undefined;
  return {
    kind: STYLE_SIGNALS_KIND,
    source: value.source === "swipe-quiz+look-feedback" ? "swipe-quiz+look-feedback" : "swipe-quiz",
    swipe: {
      shown: Number(value.swipe?.shown) || 0,
      liked: Number(value.swipe?.liked) || 0,
      disliked: Number(value.swipe?.disliked) || 0,
    },
    lean: value.lean ?? {},
    leanScale: { ...LEAN_SCALE },
    tags: {
      liked: Array.isArray(value.tags?.liked) ? value.tags.liked.map(String) : [],
      disliked: Array.isArray(value.tags?.disliked) ? value.tags.disliked.map(String) : [],
    },
    feedback: value.feedback,
    avoid:
      value.avoid && typeof value.avoid === "object"
        ? {
            pieceIds: Array.isArray(value.avoid.pieceIds) ? value.avoid.pieceIds.map(String).filter(Boolean).slice(0, 40) : [],
            classes: Array.isArray(value.avoid.classes) ? value.avoid.classes.map(String).filter(Boolean).slice(0, 24) : [],
            lookIds: Array.isArray(value.avoid.lookIds) ? value.avoid.lookIds.map(String).filter(Boolean).slice(0, 40) : [],
          }
        : undefined,
    budgetBias: typeof value.budgetBias === "number" && Number.isFinite(value.budgetBias) ? clampLean(value.budgetBias) : undefined,
    recentServedCoreHashes: Array.isArray(value.recentServedCoreHashes)
      ? value.recentServedCoreHashes.map(String).filter(Boolean).slice(0, 24)
      : undefined,
  };
}

export function emptyStyleSignals(): StyleSignalsV1 {
  return {
    kind: STYLE_SIGNALS_KIND,
    source: "swipe-quiz",
    swipe: { shown: 0, liked: 0, disliked: 0 },
    lean: {},
    leanScale: { ...LEAN_SCALE },
    tags: { liked: [], disliked: [] },
  };
}

export type LookVoteReplay = {
  lookId: string;
  vote: "like" | "dislike" | "skip";
  reasons?: string[];
  look?: LookSignalInput;
};

/** Quiz prior, then replay look votes so a changed vote does not double-nudge. */
export function rebuildStyleSignals(input: {
  likedIds: string[];
  dislikedIds: string[];
  shown?: number;
  lookVotes?: LookVoteReplay[];
}): StyleSignalsV1 {
  let signals = aggregateStyleSignalsFromVotes({
    likedIds: input.likedIds,
    dislikedIds: input.dislikedIds,
    shown: input.shown,
  });
  for (const vote of input.lookVotes ?? []) {
    signals = applyLookFeedback(signals, {
      vote: vote.vote,
      lookId: vote.lookId,
      reasons: vote.reasons,
      look: vote.look ?? {},
    });
  }
  const hashes: string[] = [];
  for (const vote of input.lookVotes ?? []) {
    const ids = [...(vote.look?.pieces ?? []), ...(vote.look?.levelUp ?? [])].map((p) => p.id);
    const hash = coreHashFromPieceIds(ids);
    if (hash && !hashes.includes(hash)) hashes.push(hash);
  }
  if (hashes.length) {
    signals = { ...signals, recentServedCoreHashes: hashes.slice(-24) };
  }
  return signals;
}
