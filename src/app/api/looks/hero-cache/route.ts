import { stylistKeyAuthorized, unauthorizedStylist } from "@/lib/stylist-auth";
import { corsJson, stylistOptions } from "@/lib/stylist-cors";
import {
  heroCacheDriver,
  parseHeroCacheKey,
  parseHeroImageUrl,
  readHeroCache,
  writeHeroCache,
} from "@/lib/hero-cache";
import { redisConfigured } from "@/lib/stylist-inbox";

export function OPTIONS() {
  return stylistOptions();
}

/**
 * Stylist COGS stub: Cold ≤ $0.80 / Cached ≤ $0.15.
 * GET ?key=appearanceFingerprint__sortedPieceIds
 */
export async function GET(request: Request) {
  if (!stylistKeyAuthorized(request)) return unauthorizedStylist();
  const url = new URL(request.url);
  const key = parseHeroCacheKey(url.searchParams.get("key"));
  if (!key) {
    return corsJson({ error: "Missing or invalid key. Use appearanceFingerprint__sortedPieceIds." }, 400);
  }
  const record = await readHeroCache(key);
  return corsJson({
    hit: Boolean(record?.heroImageUrl),
    heroImageUrl: record?.heroImageUrl ?? null,
    driver: heroCacheDriver(),
    durable: redisConfigured(),
  });
}

export async function PUT(request: Request) {
  if (!stylistKeyAuthorized(request)) return unauthorizedStylist();
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const key = parseHeroCacheKey(body?.key);
  const heroImageUrl = parseHeroImageUrl(body?.heroImageUrl);
  if (!key) {
    return corsJson({ error: "Missing or invalid key. Use appearanceFingerprint__sortedPieceIds." }, 400);
  }
  if (!heroImageUrl) {
    return corsJson(
      {
        error:
          "heroImageUrl must be lasting https on atelier-assets.vercel.app or atelier-theta-one.vercel.app. Do not send PNG bytes.",
      },
      400
    );
  }
  const requestId = typeof body?.requestId === "string" && body.requestId.trim() ? body.requestId.trim() : undefined;
  const lookId = typeof body?.lookId === "string" && body.lookId.trim() ? body.lookId.trim() : undefined;
  const stored = await writeHeroCache({ key, heroImageUrl, requestId, lookId });
  return corsJson({
    ok: true,
    key: stored.key,
    heroImageUrl: stored.heroImageUrl,
  });
}
