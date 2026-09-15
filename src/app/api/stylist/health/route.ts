import { corsJson, stylistOptions } from "@/lib/stylist-cors";
import { HERO_CACHE_NAMESPACE } from "@/lib/hero-cache";
import { readStylistBudget } from "@/lib/stylist-budget";
import { redisConfigured, stylistStoreDriver } from "@/lib/stylist-inbox";

export function OPTIONS() {
  return stylistOptions();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const driver = stylistStoreDriver();
  const budget = await readStylistBudget({
    userKey: url.searchParams.get("userKey"),
    requestId: url.searchParams.get("requestId"),
  });
  return corsJson({
    ok: true,
    driver,
    durable: driver === "redis",
    hint:
      driver === "redis"
        ? "Upstash Redis — ingest is shared across instances and redeploys."
        : "Filesystem inbox (local/dev). Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN on Vercel.",
    globalDaily: budget.globalDaily,
    userGenerate: budget.userGenerate,
    exhausted: {
      globalDaily: budget.globalDaily.exhausted,
      userGenerate: budget.userGenerate ? budget.userGenerate.exhausted : null,
    },
    heroCache: {
      namespace: HERO_CACHE_NAMESPACE,
      driver,
      durable: redisConfigured(),
      path: "/api/looks/hero-cache",
    },
  });
}
