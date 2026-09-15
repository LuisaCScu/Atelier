import catalogJson from "../../data/mvp-catalog.json";
import packsJson from "../../data/look-packs-beta.json";
import { ATELIER_PUBLIC_ORIGIN } from "./contact";
import { catalogItemIsWomens } from "./friend";
import type { GenderId, OccasionId } from "./types";

export const MVP_CATALOG_VERSION = catalogJson.catalogVersion;

export const ACTIVE_STATUSES = new Set(["active", "available", "in-stock", "live"]);

export type MvpImageKind = "isolated" | "pack" | "worn" | "hero";

export type MvpCatalogItem = {
  id: string;
  brand: string;
  name: string;
  role: string;
  price: number;
  currency: string;
  shopUrl: string;
  status: string;
  imageKind: MvpImageKind | string;
  image: string;
  imageBg?: string | null;
  /** true alpha PNG vs white-plate JPG still (Store audit). */
  imageAlpha?: "transparent" | "white-plate" | "opaque-other" | string;
  imageAlphaUrl?: string | null;
  imageTile?: string | null;
  /** false = soft-quarantine lifestyle; never collage */
  collageEligible?: boolean;
  imageHero?: string | null;
  retailerImage?: string | null;
  silhouetteTags: string[];
  gender?: GenderId | "unisex" | string;
  occasions?: string[];
};

export type MvpLookPack = {
  id: string;
  title: string;
  hook: string;
  formula: string;
  occasion: OccasionId | string;
  pieceIds: string[];
  heroImage: string;
};

export function loadMvpCatalog(): { catalogVersion: string; items: MvpCatalogItem[] } {
  return {
    catalogVersion: catalogJson.catalogVersion,
    items: catalogJson.items as MvpCatalogItem[],
  };
}

export function loadLookPacks(): MvpLookPack[] {
  return (packsJson.packs ?? []) as MvpLookPack[];
}

export function isActiveStatus(status?: string | null): boolean {
  if (!status) return false;
  return ACTIVE_STATUSES.has(status.trim().toLowerCase());
}

export function isLiveShopUrl(url?: string | null): boolean {
  if (!url) return false;
  const value = url.trim();
  if (!value || value.startsWith("#")) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function isIsolatedImage(item: MvpCatalogItem): boolean {
  return item.imageKind === "isolated";
}

function firstPartyUrl(url: string): string {
  if (url.startsWith("/")) return `${ATELIER_PUBLIC_ORIGIN}${url}`;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.endsWith("atelier-assets.vercel.app") || parsed.hostname.endsWith("atelier-theta-one.vercel.app")) {
      parsed.protocol = "https:";
      parsed.host = new URL(ATELIER_PUBLIC_ORIGIN).host;
      return parsed.toString();
    }
  } catch {
    /* keep */
  }
  return url;
}

export function normalizeCatalogItem(item: MvpCatalogItem): MvpCatalogItem {
  return {
    ...item,
    image: firstPartyUrl(item.image),
    shopUrl: item.shopUrl.trim(),
  };
}

export type MvpFilterInput = {
  dislikedSilhouettes?: string[];
  gender?: GenderId | null;
  isolatedOnly?: boolean;
  occasions?: string[];
};

/** Soft-avoid: drop items whose silhouette tags intersect the pack/user avoids. */
export function itemHitsSilhouetteAvoid(item: MvpCatalogItem, avoids: string[]): boolean {
  if (!avoids.length) return false;
  const tags = new Set((item.silhouetteTags ?? []).map((tag) => tag.toLowerCase()));
  return avoids.some((avoid) => tags.has(avoid.toLowerCase()));
}

export function filterMvpItems(items: MvpCatalogItem[], input: MvpFilterInput = {}): MvpCatalogItem[] {
  const avoids = input.dislikedSilhouettes ?? [];
  const active = items
    .filter((item) => isActiveStatus(item.status))
    .filter((item) => isLiveShopUrl(item.shopUrl))
    .filter((item) => catalogItemIsWomens(item))
    .filter((item) => !itemHitsSilhouetteAvoid(item, avoids));
  return active
    .filter((item) => (input.isolatedOnly ? isIsolatedImage(item) : true))
    .map(normalizeCatalogItem);
}

export function pieceImageForTile(item: MvpCatalogItem): string {
  const normalized = normalizeCatalogItem(item);
  return normalized.image;
}

/**
 * Collage hard-gate (Luisa 2026-09-11): isolated single-garment tiles only.
 * Prefer transparent + imageAlphaUrl; else white isolated plate.
 * Never full-body / worn / hero / pack / opaque lifestyle — returns null.
 */
export function pieceIsCollageSafe(item: MvpCatalogItem | undefined): boolean {
  return pieceCollageImage(item) != null;
}

export function pieceCollageImage(item: MvpCatalogItem | undefined, _fallback?: string): string | null {
  if (!item || !isIsolatedImage(item)) return null;
  if (item.collageEligible === false) return null;
  if (item.imageAlpha === "opaque-other") return null;
  // Never use imageHero / lifestyle fallbacks in collage.
  if (item.imageAlpha === "transparent" && item.imageAlphaUrl) {
    return firstPartyUrl(item.imageAlphaUrl);
  }
  // white-plate OK; also isolated + white bg without opaque tag
  if (item.imageAlpha === "white-plate" || item.imageBg === "white") {
    const url = (item.imageTile || item.image || "").trim();
    return url ? firstPartyUrl(url) : null;
  }
  return null;
}

export function pieceImageAlpha(item: MvpCatalogItem | undefined): "transparent" | "white-plate" | "opaque-other" | "unknown" {
  const v = item?.imageAlpha;
  if (v === "transparent" || v === "white-plate" || v === "opaque-other") return v;
  return "unknown";
}

export function mvpItemById(id: string, items?: MvpCatalogItem[]): MvpCatalogItem | undefined {
  const pool = items ?? loadMvpCatalog().items;
  return pool.find((item) => item.id === id);
}
