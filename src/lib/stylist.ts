import raw from "./catalog.json";
export type Piece = {
  id: string;
  role: string;
  name: string;
  brand: string;
  price: number;
  color: string;
  image: string;
  shopUrl: string;
  vibeTags?: string[] | null;
  owned?: boolean;
};
export type Profile = {
  likedLookIds?: string[]; outfitBrief?: string; likedPieces?: string[]; dislikedPieces?: string[];
  lookAge?:string; size?:string; height?:string; heightUnit?:"cm"|"ft"; shape?:string; torso?:string; priority?:string;
  name: string;
  season: string;
  vibes: string[];
  budget: number;
  occasions: string[];
};
export type Look = {
  id: string;
  title: string;
  occasion: string;
  pieces: Piece[];
  why: string;
};
export const catalog = raw as Piece[];
export const palettes: Record<string, string[]> = {
  "Light Spring": ["#f5dfb2", "#e9a5a0", "#b9c9a4", "#a9c7ce", "#e5ba85"],
  "Warm Spring": ["#e8b967", "#e98166", "#96ab74", "#73b8ae", "#e2bc98"],
  "Bright Spring": ["#ee8462", "#dccc56", "#71b69a", "#5291ac", "#f4debd"],
  "Light Summer": ["#d1c5dc", "#c7d9df", "#d9afbb", "#aab8c4", "#e4e0d9"],
  "Cool Summer": ["#ab9fbc", "#7f9aa9", "#ae788e", "#8f94ae", "#d2d8d8"],
  "Soft Summer": ["#a7a699", "#b39ca5", "#8e9da4", "#aab4aa", "#cdc5c0"],
  "Soft Autumn": ["#b29c80", "#999c7b", "#c3917f", "#877869", "#e4d3b6"],
  "Warm Autumn": ["#a96540", "#b49450", "#697456", "#8f4d37", "#d2b990"],
  "Deep Autumn": ["#684738", "#77454a", "#485849", "#96733c", "#bca585"],
  "Deep Winter": ["#303e55", "#5f344d", "#36594d", "#544b62", "#e0ded8"],
  "Cool Winter": ["#496079", "#953d60", "#59687b", "#46415f", "#d9dce2"],
  "Bright Winter": ["#b72a54", "#267c79", "#364da0", "#703b78", "#ece9e4"],
};
export const defaultProfile: Profile = {
  name: "",
  season: "Soft Autumn",
  vibes: ["Everyday ease"],
  budget: 300,
  occasions: ["Everyday"],
};
export const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n % 1 ? 2 : 0,
  }).format(n);
export const total = (look: Look) =>
  Math.round(
    look.pieces.reduce((s, p) => s + (p.owned ? 0 : p.price), 0) * 100,
  ) / 100;
function score(p: Piece, profile: Profile, occasion: string) {
  const text = (
    p.name +
    " " +
    p.color +
    " " +
    (p.vibeTags || []).join(" ")
  ).toLowerCase();
  let n = 0;
  if (
    /Autumn|Spring/.test(profile.season) &&
    /camel|beige|brown|ecru|cream|khaki|olive|rust|burgundy/.test(text)
  )
    n += 4;
  if (
    /Summer|Winter/.test(profile.season) &&
    /navy|blue|grey|gray|black|white|purple/.test(text)
  )
    n += 4;
  if (
    (occasion === "Work" || profile.vibes.includes("Polished & classic")) &&
    /tailor|trouser|loafer|shirt|blazer/.test(text)
  )
    n += 3;
  if (
    (occasion === "Weekend" || profile.vibes.includes("Everyday ease")) &&
    /knit|jean|cotton|flat|sneaker/.test(text)
  )
    n += 3;
  if (
    profile.vibes.includes("Soft & romantic") &&
    /drape|floral|lace|satin|skirt|dress/.test(text)
  )
    n += 3;
  if (
    profile.vibes.includes("A little edge") &&
    /leather|denim|black|boot/.test(text)
  )
    n += 3;
  if (occasion === "Dinner" && /satin|silk|pump|heel|lace|drape/.test(text))
    n += 4;
  if (occasion === "Travel") {
    if (/cotton|relaxed|knit|flat|sneaker|loafer/.test(text)) n += 5;
    if (/high.heel|pump|mini skirt/.test(text)) n -= 8;
  }
  if (profile.likedPieces?.includes(p.id)) n += 12;
  if (profile.dislikedPieces?.includes(p.id)) n -= 18;
  const words = (profile.outfitBrief || '').toLowerCase().match(/[a-z]{4,}/g) || [];
  for (const word of words) if(text.includes(word)) n += 6;
  return n;
}
export function lookKey(look: Pick<Look,"pieces">){return look.pieces.map(p=>p.id).sort().join("|");}
export function buildLooks(
  profile: Profile,
  occasion: string,
  seed = 0,
  closet: Piece[] = [],
  closetFirst = false,
  excluded: string[] = [],
): Look[] {
  const brief = (profile.outfitBrief || '').toLowerCase();
  const eligible = (p: Piece) => {
    const name = p.name.toLowerCase();
    if (/modest/.test(brief) && /mini|one.shoulder|tank|low.back/.test(name)) return false;
    if (/skirt/.test(brief) && p.role === 'bottom' && !/skirt/.test(name)) return false;
    if (/gown/.test(brief) && p.role === 'dress' && !/gown/.test(name)) return false;
    if (/sleeveless/.test(brief) && ['top','dress'].includes(p.role) && !/sleeveless|tank/.test(name)) return false;
    if (/low.back/.test(brief) && p.role === 'dress' && !/low.back|backless/.test(name)) return false;
    return true;
  };
  const inventory = catalog.filter(eligible);
  const seen = new Set(excluded);
  const result: Look[] = [];
  const used = new Set<string>();
  for (let i = 0; i < 160 && result.length < 4; i++) {
    let remaining = profile.budget;
    const pieces: Piece[] = [];
    const roles = /gown|\bdress\b/.test(brief) ? ["dress", "shoes"] : ["top", "bottom", "shoes"];
    const owned = closetFirst
      ? closet.filter(eligible).filter((p) =>
          [
            "top",
            "bottom",
            "shoes",
            "dress",
            "outerwear",
            "bag",
            "accessory",
          ].includes(p.role),
        )
      : [];
    if (owned.length) {
      const first = owned[(seed + i) % owned.length];
      pieces.push({ ...first, owned: true });
      if (first.role === "dress") { for(const role of ["top","bottom","dress"]) {const index=roles.indexOf(role);if(index>=0)roles.splice(index,1);} }
      else if (roles.includes(first.role))
        roles.splice(roles.indexOf(first.role), 1);
    }
    let valid = true;
    for (let r = 0; r < roles.length; r++) {
      const role = roles[r];
      const ownedForRole = owned.find(
        (p) => p.role === role && !pieces.some((x) => x.id === p.id),
      );
      if (ownedForRole) {
        pieces.push({ ...ownedForRole, owned: true });
        continue;
      }
      const futureCost = roles
        .slice(r + 1)
        .reduce(
          (s, next) =>
            s +
            (owned.some((p) => p.role === next)
              ? 0
              : Math.min(
                  ...inventory.filter((p) => p.role === next).map((p) => p.price),
                )),
          0,
        );
      const pool = inventory
        .filter(
          (p) => p.role === role && p.price <= remaining - futureCost + 0.001,
        )
        .sort(
          (a, b) =>
            score(b, profile, occasion) -
              (used.has(b.id) ? 4 : 0) -
              (score(a, profile, occasion) - (used.has(a.id) ? 4 : 0)) ||
            a.price - b.price,
        );
      if (!pool.length) {
        valid = false;
        break;
      }
      const p = pool[(seed + i) % Math.min(pool.length, 5)];
      pieces.push(p);
      remaining -= p.price;
      used.add(p.id);
    }
    if (!valid) continue;
    for (const role of ["bag", "accessory"]) {
      if (pieces.some((p) => p.role === role)) continue;
      const pool = inventory
        .filter((p) => p.role === role && p.price <= remaining)
        .sort(
          (a, b) =>
            score(b, profile, occasion) - score(a, profile, occasion) ||
            a.price - b.price,
        );
      if (pool.length) {
        const p = pool[(seed + i) % Math.min(pool.length, 4)];
        pieces.push(p);
        remaining -= p.price;
      }
    }
    const key=lookKey({pieces});
    if(seen.has(key))continue;
    seen.add(key);
    const ownedCount = pieces.filter((p) => p.owned).length;
    const titles = [
      "The easy morning",
      "A little more polished",
      "Your kind of understated",
      "Out the door, beautifully",
    ];
    result.push({
      id: `look-${key}`,
      title: titles[result.length],
      occasion,
      pieces,
      why: `${/Autumn|Spring/.test(profile.season) ? "Warm, earthy" : "Cool, balanced"} color preferences guide this ${occasion.toLowerCase()} edit. ${ownedCount ? `${ownedCount} ${ownedCount === 1 ? "piece comes" : "pieces come"} from your closet. ` : ""}The new pieces stay within your ${money(profile.budget)} budget.`,
    });
  }
  return result;
}
