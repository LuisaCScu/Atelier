import type { ClosetFlatLayStatus, ClosetItem, ClosetRole, ColorId, ItemCategory } from "./types";

export const CLOSET_ROLES: { id: ClosetRole; label: string }[] = [
  { id: "top", label: "Top" },
  { id: "sweater", label: "Sweater" },
  { id: "cardigan", label: "Cardigan" },
  { id: "bottom", label: "Bottom" },
  { id: "dress", label: "Dress" },
  { id: "outerwear", label: "Outerwear" },
  { id: "shoes", label: "Shoes" },
  { id: "bag", label: "Bag" },
  { id: "accessory", label: "Accessory" },
  { id: "other", label: "Other" },
];

/** Filled Closet grid section order — hide empty buckets in UI. */
export const CLOSET_ROLE_BUCKETS: { id: string; label: string; roles: ClosetRole[] }[] = [
  { id: "dresses", label: "Dresses", roles: ["dress"] },
  { id: "tops", label: "Tops", roles: ["top", "knit", "shirt", "tee"] },
  { id: "sweaters", label: "Sweaters", roles: ["sweater"] },
  { id: "cardigans", label: "Cardigans", roles: ["cardigan"] },
  { id: "bottoms", label: "Bottoms", roles: ["bottom", "trousers", "shorts"] },
  { id: "outerwear", label: "Outerwear", roles: ["outerwear"] },
  { id: "shoes", label: "Shoes", roles: ["shoes"] },
  { id: "bags", label: "Bags", roles: ["bag"] },
  { id: "accessories", label: "Accessories", roles: ["accessory"] },
  { id: "other", label: "Other", roles: ["other"] },
];

/** Fashion-specific words for piece names (chocolate/cream, not brown/beige). */
export const COLOR_LABELS: Record<ColorId, string> = {
  navy: "Navy",
  black: "Black",
  white: "White",
  grey: "Grey",
  camel: "Camel",
  cream: "Cream",
  chocolate: "Chocolate",
  olive: "Olive",
  stone: "Stone",
  sand: "Sand",
  charcoal: "Charcoal",
  red: "Red",
  pink: "Pink",
  peach: "Peach",
  burgundy: "Burgundy",
  blue: "Blue",
  green: "Green",
  multi: "Multicolor",
};

/** Short chip aria only — Beige/Brown stay for swatch a11y; names use COLOR_LABELS. */
export const COLOR_CHIP_ARIA: Partial<Record<ColorId, string>> = {
  cream: "Beige",
  chocolate: "Brown",
};

const ROLE_IDS = new Set<string>([
  "top",
  "bottom",
  "dress",
  "outerwear",
  "sweater",
  "cardigan",
  "knit",
  "shirt",
  "tee",
  "trousers",
  "shorts",
  "shoes",
  "bag",
  "accessory",
  "other",
]);

const LEGACY_CATEGORY_TO_ROLE: Record<string, ClosetRole> = {
  outerwear: "outerwear",
  knit: "top",
  sweater: "sweater",
  cardigan: "cardigan",
  shirt: "top",
  tee: "top",
  trousers: "bottom",
  shorts: "bottom",
  shoes: "shoes",
  accessory: "accessory",
  other: "other",
  top: "top",
  bottom: "bottom",
  dress: "dress",
  bag: "bag",
};

const ROLE_TO_CATEGORY: Record<ClosetRole, ItemCategory | "other"> = {
  top: "tee",
  bottom: "trousers",
  dress: "other",
  outerwear: "outerwear",
  sweater: "knit",
  cardigan: "knit",
  knit: "knit",
  shirt: "shirt",
  tee: "tee",
  trousers: "trousers",
  shorts: "shorts",
  shoes: "shoes",
  bag: "accessory",
  accessory: "accessory",
  other: "other",
};

/** Extra display labels for legacy roles not shown as chips. */
const LEGACY_ROLE_LABELS: Partial<Record<ClosetRole, string>> = {
  knit: "Knit",
  shirt: "Shirt",
  tee: "Tee",
  trousers: "Trousers",
  shorts: "Shorts",
};

export const CLOSET_COLORS = new Set<ColorId>([
  "navy",
  "black",
  "white",
  "grey",
  "camel",
  "cream",
  "chocolate",
  "olive",
  "stone",
  "sand",
  "charcoal",
  "red",
  "pink",
  "peach",
  "burgundy",
  "blue",
  "green",
  "multi",
]);

/** Confirm / note / edit chips — curated order; hides stone/sand/camel/charcoal. */
export const CLOSET_COLOR_CHIPS: ColorId[] = [
  "white",
  "cream",
  "grey",
  "black",
  "navy",
  "blue",
  "green",
  "olive",
  "chocolate",
  "red",
  "peach",
  "pink",
  "burgundy",
  "multi",
];

export function isClosetRole(value: unknown): value is ClosetRole {
  return typeof value === "string" && ROLE_IDS.has(value);
}

export function roleFromCategory(category?: string | null): ClosetRole {
  if (!category) return "other";
  return LEGACY_CATEGORY_TO_ROLE[category] ?? "other";
}

export function categoryFromRole(role: ClosetRole): ItemCategory | "other" {
  return ROLE_TO_CATEGORY[role] ?? "other";
}

export function parseClosetColor(value: unknown): ColorId | "other" {
  return typeof value === "string" && CLOSET_COLORS.has(value as ColorId) ? (value as ColorId) : "other";
}

export function closetRoleLabel(role: ClosetRole): string {
  return CLOSET_ROLES.find((item) => item.id === role)?.label ?? LEGACY_ROLE_LABELS[role] ?? role;
}

export function closetColorLabel(color: ColorId | "other"): string {
  if (color === "other") return "";
  return COLOR_LABELS[color] ?? color;
}

/** Chip swatch aria — may use Beige/Brown; piece names use closetColorLabel. */
export function closetChipAriaLabel(color: ColorId): string {
  return COLOR_CHIP_ARIA[color] ?? COLOR_LABELS[color] ?? color;
}

/**
 * Auto-name = `{color} {role}` (e.g. "chocolate cardigan", "peach top", "cream sweater").
 * Coerces role `other` → `top` so names never stay color-only.
 */
export function suggestedClosetName(color: ColorId | "other", role: ClosetRole): string {
  const effectiveRole: ClosetRole = role === "other" ? "top" : role;
  const colorPart = closetColorLabel(color).toLowerCase();
  const rolePart = closetRoleLabel(effectiveRole).toLowerCase();
  if (colorPart && rolePart) return `${colorPart} ${rolePart}`;
  if (colorPart) return colorPart;
  if (rolePart) return rolePart;
  return "";
}

export function bucketForRole(role: ClosetRole): (typeof CLOSET_ROLE_BUCKETS)[number] {
  return (
    CLOSET_ROLE_BUCKETS.find((bucket) => bucket.roles.includes(role)) ??
    CLOSET_ROLE_BUCKETS[CLOSET_ROLE_BUCKETS.length - 1]
  );
}


/** Map filename / typed name hints onto a closet role when still top/other. */
export function roleFromNameHint(name: string, role: ClosetRole): ClosetRole {
  if (role !== "top" && role !== "other") return role;
  if (/cardigan/i.test(name)) return "cardigan";
  if (/sweater|jumper|knit/i.test(name)) return "sweater";
  if (/coat|jacket|blazer|outerwear|trench/i.test(name)) return "outerwear";
  if (/dress|gown/i.test(name)) return "dress";
  if (/shoe|boot|sandal|sneaker|heel|loafer/i.test(name)) return "shoes";
  if (/bag|purse|tote|clutch|handbag/i.test(name)) return "bag";
  if (/hat|cap|scarf|belt|accessory/i.test(name)) return "accessory";
  if (/\btee\b|t-shirt|tshirt/i.test(name)) return "top";
  if (/\btop\b|blouse|shirt/i.test(name)) return "top";
  if (/trouser|pants|jean|skirt|short/i.test(name)) return "bottom";
  return role;
}

export type CutoutSilhouetteHint = "bottom" | "dress" | "unknown";

/**
 * Aspect-only role from a trimmed cutout. Not garment vision.
 *
 * Wide-leg pants are often tall after rembg (legs + leftover torso) — a raw
 * h/w > 1.38 used to call them a dress. Prefer:
 *   very tall skinny (single column) → dress
 *   tall with moderate / flared width (two-leg mass) → bottom
 */
export function aspectRoleFromSize(width: number, height: number): ClosetRole | null {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const wide = w / h;
  const tall = h / w;
  if (wide > 1.35) return "shoes";
  // Very tall skinny column — slip / column dress, not flared pants.
  if (tall >= 1.92 && wide <= 0.5) return "dress";
  if (tall >= 1.7 && wide <= 0.44) return "dress";
  // Tall + moderate width (wide-leg, leftover person, two-leg bbox).
  if (tall >= 1.22 && wide >= 0.48) return "bottom";
  if (tall >= 1.32 && wide >= 0.42) return "bottom";
  // Remaining quite-tall skinny.
  if (tall >= 1.55) return "dress";
  return null;
}

/**
 * After cutout: file hint first, then mask silhouette, then aspect on trimmed
 * bitmap, else soft `top` default (apparel photos — easier than leaving `other`).
 * Heuristic only — coats without name hints can still land dress/bottom until
 * classifyCutoutVision exists.
 */
export function roleFromCutoutHints(
  fileHint: string,
  width: number,
  height: number,
  current: ClosetRole = "other",
  silhouette: CutoutSilhouetteHint = "unknown"
): ClosetRole {
  if (current !== "other") return current;
  const fromName = roleFromNameHint(fileHint || "", "other");
  if (fromName !== "other") return fromName;
  if (silhouette === "bottom") return "bottom";
  if (silhouette === "dress") return "dress";
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  if (w / h > 1.35) {
    if (/bag|purse|tote|clutch|handbag/i.test(fileHint)) return "bag";
    if (/hat|cap|scarf|belt/i.test(fileHint)) return "accessory";
    return "shoes";
  }
  return aspectRoleFromSize(w, h) ?? "top";
}

export function normalizeClosetItem(raw: unknown): ClosetItem | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const id = typeof rec.id === "string" && rec.id.trim() ? rec.id.trim() : "";
  if (!id) return null;
  const rawRole = isClosetRole(rec.role)
    ? rec.role
    : roleFromCategory(typeof rec.category === "string" ? rec.category : null);
  const name = typeof rec.name === "string" && rec.name.trim() ? rec.name.trim() : "Untitled piece";
  const role = roleFromNameHint(name, rawRole);
  const source =
    rec.source === "photo" || rec.source === "video" || rec.source === "manual" ? rec.source : "manual";
  const cutout =
    (typeof rec.cutoutUrl === "string" && rec.cutoutUrl) ||
    (typeof rec.imageDataUrl === "string" && rec.imageDataUrl) ||
    (typeof rec.image === "string" && rec.image) ||
    undefined;
  const rawCutout =
    typeof rec.rawCutoutUrl === "string" && rec.rawCutoutUrl ? rec.rawCutoutUrl : undefined;
  const flatLayRaw = rec.flatLayStatus;
  const flatLayStatus: ClosetFlatLayStatus | undefined =
    flatLayRaw === "pending" ||
    flatLayRaw === "ready" ||
    flatLayRaw === "skipped" ||
    flatLayRaw === "failed"
      ? flatLayRaw
      : undefined;
  return {
    id,
    name,
    role,
    category: categoryFromRole(role),
    color: parseClosetColor(rec.color),
    colorNote: typeof rec.colorNote === "string" && rec.colorNote.trim() ? rec.colorNote.trim() : undefined,
    cutoutUrl: cutout,
    imageDataUrl: cutout,
    rawCutoutUrl: rawCutout,
    flatLayStatus,
    source,
    gender: "female",
  };
}

export function slimClosetItem(
  item: ClosetItem
): Omit<ClosetItem, "cutoutUrl" | "imageDataUrl" | "rawCutoutUrl"> {
  return {
    id: item.id,
    name: item.name,
    role: item.role,
    category: item.category,
    color: item.color,
    colorNote: item.colorNote,
    flatLayStatus: item.flatLayStatus,
    source: item.source,
    gender: "female",
  };
}
