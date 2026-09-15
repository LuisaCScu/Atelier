import { corsJson, stylistOptions } from "@/lib/stylist-cors";
import { FRIEND_GENDER } from "@/lib/friend";
import { filterMvpItems, loadMvpCatalog } from "@/lib/mvp-catalog";

export function OPTIONS() {
  return stylistOptions();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const isolated = url.searchParams.get("imageKind") === "isolated";
  const avoids = url.searchParams.get("avoid")?.split(",").map((item) => item.trim()).filter(Boolean) ?? [];
  const { catalogVersion, items } = loadMvpCatalog();
  const filtered = filterMvpItems(items, {
    dislikedSilhouettes: avoids,
    gender: FRIEND_GENDER,
    isolatedOnly: isolated,
  });
  return corsJson({
    catalogVersion,
    count: filtered.length,
    items: filtered,
  });
}
