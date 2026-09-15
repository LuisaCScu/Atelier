import { CATALOG } from "./catalog";
import type { CatalogItem, ClosetItem } from "./types";

export interface ElevateIdea {
  id: string;
  catalogItem: CatalogItem;
  headline: string;
  reason: string;
  worksWith: ClosetItem[];
  unlocks: number;
}

const SUGGEST_IDS = ["kn-cream-crew", "sh-leather-loafer", "ow-navy-coat", "sh-white-poplin", "kn-grey-merino"];

function itemById(id: string): CatalogItem | undefined {
  return CATALOG.find((entry) => entry.id === id);
}

function complements(closet: ClosetItem[], item: CatalogItem): ClosetItem[] {
  return closet.filter((owned) => {
    if (owned.category === item.category) return false;
    const layer =
      owned.category === "trousers" ||
      owned.category === "shirt" ||
      owned.category === "tee" ||
      owned.category === "outerwear";
    if (layer) return true;
    if (item.category === "shoes") return true;
    return owned.color !== item.color;
  });
}

export function elevateIdeas(closet: ClosetItem[], focusId?: string | null): ElevateIdea[] {
  if (closet.length === 0) return [];
  const focus = closet.find((item) => item.id === focusId) ?? null;
  const base = focus ? [focus, ...closet.filter((item) => item.id !== focus.id)] : closet;

  const ideas: ElevateIdea[] = [];
  for (const id of SUGGEST_IDS) {
    const catalogItem = itemById(id);
    if (!catalogItem) continue;
    const already = closet.some(
      (owned) => owned.name.toLowerCase() === catalogItem.name.en.toLowerCase()
    );
    if (already) continue;
    const worksWith = complements(base, catalogItem).slice(0, 4);
    if (worksWith.length === 0 && base[0]) worksWith.push(base[0]);
    const unlocks = Math.max(2, worksWith.length);
    ideas.push({
      id: catalogItem.id,
      catalogItem,
      headline: `Add ${ideas.length + 1} — ${catalogItem.name.en}`,
      reason:
        worksWith.length >= 1
          ? `Works with ${worksWith.length} piece${worksWith.length === 1 ? "" : "s"} you own.`
          : `Unlocks ${unlocks} new outfits.`,
      worksWith,
      unlocks,
    });
    if (ideas.length >= 2) break;
  }
  return ideas;
}
