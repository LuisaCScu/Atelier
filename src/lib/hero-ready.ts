import { FITTINGS_PARKED, type StylistResponseV1 } from "@/lib/stylist-contract";

export type MissingHero = {
  lookId: string;
  title: string;
  url: string;
  status: number | null;
};

export type HeroReadyResult =
  | { ok: true }
  | { ok: false; missing: MissingHero[] };

/** True when this board must never wait on worn heroes (parked / tiles-only / all locked). */
export function isTilesOnlyHeroSkip(response: StylistResponseV1, opts?: { tilesOnly?: boolean }): boolean {
  if (FITTINGS_PARKED) return true;
  if (opts?.tilesOnly) return true;
  if (!response.looks.length) return true;
  return response.looks.every((look) => look.fittingLocked === true);
}

/** Required fittings must already return HTTP 200 before looks go ready (no ready+404). */
export function requiredFittingUrls(response: StylistResponseV1): { lookId: string; title: string; url: string }[] {
  // Parked / tiles-only / all fittingLocked: never gate POST looks on worn heroes.
  if (isTilesOnlyHeroSkip(response)) return [];
  const out: { lookId: string; title: string; url: string }[] = [];
  response.looks.forEach((look, index) => {
    if (look.fittingLocked === true) return;
    const url = (look.heroImage || look.fittingImage || "").trim();
    // Free look 4 may omit fitting; core looks 1–3 (and premium 4) need a live URL.
    if (!url) {
      if (index < 3) out.push({ lookId: look.id, title: look.title, url: "" });
      return;
    }
    out.push({ lookId: look.id, title: look.title, url });
  });
  return out;
}

async function probe(url: string): Promise<number | null> {
  if (!url) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const head = await fetch(url, { method: "HEAD", redirect: "follow", signal: controller.signal, cache: "no-store" });
    if (head.status === 200 || head.status === 204) return head.status;
    // Some CDNs dislike HEAD — fall through to a tiny GET.
    const get = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      cache: "no-store",
      headers: { Range: "bytes=0-0" },
    });
    return get.status;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function assertFittingHeroesLive(
  response: StylistResponseV1,
  opts?: { tilesOnly?: boolean }
): Promise<HeroReadyResult> {
  if (isTilesOnlyHeroSkip(response, opts)) return { ok: true };
  const required = requiredFittingUrls(response);
  const missing: MissingHero[] = [];
  await Promise.all(
    required.map(async (item) => {
      const status = item.url ? await probe(item.url) : null;
      const ok = status === 200 || status === 206 || status === 204;
      if (!ok) missing.push({ ...item, status });
    })
  );
  if (missing.length) return { ok: false, missing };
  return { ok: true };
}
