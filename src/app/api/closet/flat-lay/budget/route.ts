/**
 * GET /api/closet/flat-lay/budget — optional UI remaining polish count.
 * Separate from GET /api/stylist/budget (never reads userGenerate).
 * Does NOT mint a device cookie — only POST /flat-lay creates identity.
 */
import { cookies } from "next/headers";
import {
  CLOSET_DEVICE_COOKIE,
  CLOSET_FLATLAY_EST_COST_USD,
  readClosetFlatLayBudget,
} from "@/lib/closet-flat-lay-budget";
import { hasFlatLayImageProvider } from "@/lib/closet-flat-lay";
import { readSession } from "@/lib/session";

export const runtime = "nodejs";

async function resolveKey(): Promise<string> {
  const session = await readSession();
  const fromSession = session?.generateUserKey?.trim();
  if (fromSession) return fromSession;

  const jar = await cookies();
  const existing = jar.get(CLOSET_DEVICE_COOKIE)?.value?.trim();
  if (existing) return existing;

  // No identity yet — report empty usage without creating a key (avoids GET vs POST mismatch on smoke).
  return "anon";
}

export async function GET() {
  const key = await resolveKey();
  const snapshot = await readClosetFlatLayBudget(key);
  return new Response(
    JSON.stringify({
      ok: true,
      providerAvailable: hasFlatLayImageProvider(),
      polish: snapshot.polish,
      day: snapshot.day,
      estCostUsdPerCall: snapshot.estCostUsdPerCall,
      identity: key === "anon" ? "none" : "bound",
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json",
        "X-Closet-FlatLay-Est-Cost-Usd": String(CLOSET_FLATLAY_EST_COST_USD),
      },
    }
  );
}
