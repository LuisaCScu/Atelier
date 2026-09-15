import type { GenderId } from "./types";

/** Friend lock: Atelier is women-only. Stylist packets still send `female`. */
export const FRIEND_GENDER: GenderId = "female";

const MENS_TAGS = new Set(["male", "men", "man", "mens", "men's"]);
const WOMENS_TAGS = new Set(["female", "women", "woman", "womens", "women's", "unisex"]);

export function friendGender(_raw?: string | null): GenderId {
  return FRIEND_GENDER;
}

export function isMensGenderTag(value?: string | null): boolean {
  if (!value) return false;
  return MENS_TAGS.has(value.trim().toLowerCase());
}

function mensRetailPath(url?: string | null): boolean {
  if (!url) return false;
  try {
    const path = new URL(url).pathname.toLowerCase();
    return (
      path.includes("/man/") ||
      path.includes("/men/") ||
      path.includes("/mens/") ||
      path.includes("/mens-") ||
      path.includes("/male/")
    );
  } catch {
    const lower = url.toLowerCase();
    return lower.includes("/man/") || lower.includes("/men/") || lower.includes("/mens");
  }
}

/** Women's / unisex / untagged Store MVP pieces. Never men's SKUs. */
export function catalogItemIsWomens(item: {
  gender?: string | null;
  shopUrl?: string | null;
}): boolean {
  if (isMensGenderTag(item.gender)) return false;
  if (mensRetailPath(item.shopUrl)) return false;
  if (item.gender && !WOMENS_TAGS.has(item.gender.trim().toLowerCase())) return false;
  return true;
}
