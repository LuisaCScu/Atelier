import {
  filterMvpItems,
  isIsolatedImage,
  loadLookPacks,
  loadMvpCatalog,
  mvpItemById,
  normalizeCatalogItem,
  type MvpCatalogItem,
  type MvpLookPack,
} from "./mvp-catalog";
import { FRIEND_GENDER } from "./friend";
import { dislikedSilhouettesFromSession } from "./stylist-contract";
import type { OccasionId, ProfileSession } from "./types";

export type MvpGeneratedLook = {
  id: string;
  title: string;
  hook: string;
  formula: string;
  why: string;
  occasion: OccasionId | string;
  heroImage: string;
  pieces: MvpCatalogItem[];
};

function packPieces(pack: MvpLookPack, allowed: Map<string, MvpCatalogItem>): MvpCatalogItem[] | null {
  const pieces: MvpCatalogItem[] = [];
  for (const id of pack.pieceIds) {
    const item = allowed.get(id);
    if (!item) return null;
    pieces.push(item);
  }
  return pieces;
}

function packInBudget(pieces: MvpCatalogItem[], max: number): boolean {
  const total = pieces.reduce((sum, item) => sum + item.price, 0);
  return total <= max + 20;
}

function occasionRank(pack: MvpLookPack, occasions: string[]): number {
  if (!occasions.length) return 0;
  return occasions.includes(pack.occasion) ? 2 : 0;
}

function composeFromRoles(
  items: MvpCatalogItem[],
  occasion: string,
  used: Set<string>,
  index: number
): MvpCatalogItem[] | null {
  const byRole = (role: string) =>
    items.filter((item) => item.role === role && !used.has(item.id) && (!item.occasions?.length || item.occasions.includes(occasion)));
  const preferIsolated = (pool: MvpCatalogItem[]) => {
    const isolated = pool.filter(isIsolatedImage);
    return isolated.length ? isolated : pool;
  };

  const top = preferIsolated([...byRole("top"), ...byRole("shirt"), ...byRole("tee"), ...byRole("knit"), ...byRole("sweater"), ...byRole("cardigan")]);
  const bottom = preferIsolated([...byRole("bottom"), ...byRole("trousers"), ...byRole("shorts")]);
  const shoes = preferIsolated(byRole("shoes"));
  const outer = preferIsolated(byRole("outerwear"));

  if (!top.length || !bottom.length || !shoes.length) return null;
  const pick = (pool: MvpCatalogItem[], offset: number) => pool[offset % pool.length];
  const pieces = [pick(top, index), pick(bottom, index), pick(shoes, index)];
  if (occasion === "travel" && outer.length) pieces.unshift(pick(outer, index));
  return pieces;
}

export function generateMvpLooks(session: ProfileSession, lookCount = 4): MvpGeneratedLook[] {
  const { items } = loadMvpCatalog();
  const allowedList = filterMvpItems(items, {
    dislikedSilhouettes: dislikedSilhouettesFromSession(session),
    gender: FRIEND_GENDER,
  });
  const allowed = new Map(allowedList.map((item) => [item.id, item]));
  const occasions = session.occasions.length ? session.occasions : (["weekend"] as OccasionId[]);
  const looks: MvpGeneratedLook[] = [];
  const usedPacks = new Set<string>();
  const usedPieces = new Set<string>();

  const packs = loadLookPacks()
    .map((pack) => ({ pack, pieces: packPieces(pack, allowed) }))
    .filter((row): row is { pack: MvpLookPack; pieces: MvpCatalogItem[] } => Boolean(row.pieces))
    .filter((row) => packInBudget(row.pieces, session.budgetMax))
    .sort((a, b) => occasionRank(b.pack, occasions) - occasionRank(a.pack, occasions));

  for (const { pack, pieces } of packs) {
    if (looks.length >= lookCount) break;
    if (usedPacks.has(pack.id)) continue;
    usedPacks.add(pack.id);
    pieces.forEach((piece) => usedPieces.add(piece.id));
    looks.push({
      id: pack.id,
      title: pack.title,
      hook: pack.hook,
      formula: pack.formula,
      why: `${pack.hook}. Pieces from the Store MVP catalog (${loadMvpCatalog().catalogVersion}).`,
      occasion: pack.occasion,
      heroImage: pack.heroImage,
      pieces: pieces.map(normalizeCatalogItem),
    });
  }

  let slot = 0;
  for (const occasion of occasions) {
    if (looks.length >= lookCount) break;
    const composed = composeFromRoles(allowedList, occasion, usedPieces, slot);
    slot += 1;
    if (!composed) continue;
    composed.forEach((piece) => usedPieces.add(piece.id));
    looks.push({
      id: `mvp-${occasion}-${slot}`,
      title: occasion[0].toUpperCase() + occasion.slice(1),
      hook: composed.map((piece) => piece.name).slice(0, 3).join(", "),
      formula: composed.map((piece) => piece.name.toLowerCase()).join(" + "),
      why: `Catalog look for ${occasion}. Isolated tiles preferred.`,
      occasion,
      heroImage: composed.find(isIsolatedImage)?.image ?? composed[0].image,
      pieces: composed.map(normalizeCatalogItem),
    });
  }

  return looks.slice(0, lookCount);
}

export function mvpPieceOrThrow(id: string): MvpCatalogItem | undefined {
  return mvpItemById(id);
}
