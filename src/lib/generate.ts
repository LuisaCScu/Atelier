import { FRIEND_GENDER } from "./friend";
import { generateMvpLooks } from "./mvp-generate";
import type { CatalogItem, ItemCategory, Look, ProfileSession } from "./types";

export const LOOK_COUNT = 4;

const ROLE_TO_CATEGORY: Record<string, ItemCategory> = {
  outerwear: "outerwear",
  knit: "knit",
  shirt: "shirt",
  tee: "tee",
  top: "shirt",
  trousers: "trousers",
  shorts: "shorts",
  bottom: "trousers",
  shoes: "shoes",
  accessory: "accessory",
  bag: "accessory",
};

export function generateLooks(profile: ProfileSession): Look[] {
  return generateMvpLooks(profile, LOOK_COUNT).map((look, index) => {
    const items: CatalogItem[] = look.pieces.map((piece) => ({
      id: piece.id,
      name: { en: piece.name, pt: piece.name },
      category: ROLE_TO_CATEGORY[piece.role] ?? "accessory",
      priceEur: piece.price,
      color: "navy",
      vibeTags: ["weekend"],
      brand: piece.brand,
      imageUrl: piece.image,
    }));
    return {
      id: look.id,
      number: index + 1,
      title: look.title,
      why: look.why,
      occasion: (look.occasion as Look["occasion"]) || "weekend",
      items,
      total: items.reduce((sum, item) => sum + item.priceEur, 0),
      imageUrl: look.heroImage,
    };
  });
}

export function defaultSession(partial?: Partial<ProfileSession>): ProfileSession {
  return {
    name: "Alex",
    path: "quick",
    size: "M",
    occasions: ["weekend"],
    colors: ["navy", "cream", "grey"],
    vibes: ["minimal"],
    priorities: [],
    hardNos: [],
    notes: "",
    budgetMin: 80,
    budgetMax: 250,
    likedStyleIds: [],
    dislikedStyleIds: [],
    styleCardShownAt: {},
    deepDone: {
      photos: false,
      measurements: false,
      color: false,
      styles: false,
      prefs: false,
      budget: false,
    },
    seed: Date.now(),
    generated: false,
    hasUsedFreeBoard: false,
    hasPremium: false,
    ...partial,
    gender: FRIEND_GENDER,
  };
}

export function displayName(session: ProfileSession): string {
  const trimmed = session.name.trim();
  return trimmed.split(/\s+/)[0] || "Alex";
}
