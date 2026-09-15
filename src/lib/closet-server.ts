import { cookies } from "next/headers";
import { categoryFromRole, isClosetRole, normalizeClosetItem, parseClosetColor, roleFromCategory, slimClosetItem } from "./closet-roles";
import { CLOSET_COOKIE, CLOSET_FREE_CAP, type ClosetItem, type ClosetRole } from "./types";

export { CLOSET_FREE_CAP };

export function parseCloset(raw: string | undefined): ClosetItem[] {
  if (!raw) return [];
  const tryParse = (value: string) => {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeClosetItem).filter((item): item is ClosetItem => Boolean(item));
  };
  try {
    return tryParse(decodeURIComponent(raw));
  } catch {
    try {
      return tryParse(raw);
    } catch {
      return [];
    }
  }
}

export async function readCloset(): Promise<ClosetItem[]> {
  const jar = await cookies();
  return parseCloset(jar.get(CLOSET_COOKIE)?.value);
}

export async function writeCloset(items: ClosetItem[]) {
  const slim = items.map((item) => slimClosetItem(normalizeClosetItem(item) ?? item));
  const jar = await cookies();
  jar.set(CLOSET_COOKIE, JSON.stringify(slim), {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function closetWouldExceedCap(current: ClosetItem[], adding: number): boolean {
  return current.length + adding > CLOSET_FREE_CAP;
}

export function closetItemFromForm(data: FormData): ClosetItem | null {
  const name = String(data.get("name") ?? "").trim() || "Untitled piece";
  const roleRaw = String(data.get("role") ?? data.get("category") ?? "other");
  const role: ClosetRole = isClosetRole(roleRaw) ? roleRaw : roleFromCategory(roleRaw);
  const color = parseClosetColor(data.get("color"));
  const sourceRaw = String(data.get("source") ?? "manual");
  const source = sourceRaw === "photo" || sourceRaw === "video" ? sourceRaw : "manual";
  const cutout = String(data.get("cutoutUrl") ?? data.get("imageDataUrl") ?? "").trim() || undefined;
  return {
    id: `${source}-${Date.now()}`,
    name,
    role,
    category: categoryFromRole(role),
    color,
    source,
    cutoutUrl: cutout,
    imageDataUrl: cutout,
    gender: "female",
  };
}
