/**
 * POST /api/closet/flat-lay
 * Body (tile — legacy/single): { imageDataUrl, roleHint?, colorHint?, labelHint? }
 * Body (sheet — architecture lock): { mode: "sheet", imageDataUrl, items: [{role,label,colorHint?}] }
 *
 * Sheet path: ONE gpt-image multi-item flat-lay → slice tiles (1 polish budget unit).
 * NEVER imports or calls incrementGenerateBudget / stylist generate budget.
 */
import { cookies } from "next/headers";
import {
  CLOSET_DEVICE_COOKIE,
  CLOSET_FLATLAY_EST_COST_USD,
  decrementClosetFlatLayBudget,
  incrementClosetFlatLayBudget,
  newClosetDeviceKey,
  readClosetFlatLayBudget,
} from "@/lib/closet-flat-lay-budget";
import { hasFlatLayImageProvider, polishCutoutToFlatLay } from "@/lib/closet-flat-lay";
import { polishOutfitToFlatLaySheet, type SheetItemHint } from "@/lib/closet-flat-lay-sheet";
import { readSession } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 90;

type Body = {
  mode?: string;
  imageDataUrl?: string;
  roleHint?: string;
  colorHint?: string;
  labelHint?: string;
  items?: SheetItemHint[];
};

async function resolvePolishUserKey(): Promise<{ key: string; setDeviceCookie?: string }> {
  const session = await readSession();
  const fromSession = session?.generateUserKey?.trim();
  if (fromSession) return { key: fromSession };

  const jar = await cookies();
  const existing = jar.get(CLOSET_DEVICE_COOKIE)?.value?.trim();
  if (existing) return { key: existing };

  const created = newClosetDeviceKey();
  return { key: created, setDeviceCookie: created };
}

function json(
  body: unknown,
  status = 200,
  extraHeaders?: Record<string, string>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...extraHeaders,
    },
  });
}

function attachDeviceCookie(
  headers: Record<string, string>,
  setDeviceCookie?: string
) {
  if (!setDeviceCookie) return;
  headers["Set-Cookie"] =
    `${CLOSET_DEVICE_COOKIE}=${encodeURIComponent(setDeviceCookie)}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax${
      process.env.VERCEL ? "; Secure" : ""
    }`;
}

export async function POST(request: Request) {
  if (!hasFlatLayImageProvider()) {
    return json({ ok: false, code: "no_image_provider" }, 503);
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return json({ ok: false, code: "invalid_body", error: "Expected JSON body" }, 400);
  }

  const imageDataUrl = typeof body.imageDataUrl === "string" ? body.imageDataUrl.trim() : "";
  if (!imageDataUrl.startsWith("data:image/")) {
    return json({ ok: false, code: "invalid_image", error: "imageDataUrl must be a data:image URL" }, 400);
  }
  if (imageDataUrl.length > 8_000_000) {
    return json({ ok: false, code: "invalid_image", error: "Image too large" }, 413);
  }

  const sheetMode = String(body.mode || "").toLowerCase() === "sheet";

  const { key, setDeviceCookie } = await resolvePolishUserKey();
  const before = await readClosetFlatLayBudget(key);
  if (before.polish.exhausted) {
    const headers: Record<string, string> = {
      "X-Closet-FlatLay-Est-Cost-Usd": String(CLOSET_FLATLAY_EST_COST_USD),
      "X-Closet-FlatLay-Budget-Remaining": "0",
    };
    attachDeviceCookie(headers, setDeviceCookie);
    return json(
      {
        ok: false,
        code: "budget_exhausted",
        polish: before.polish,
        error: "Daily closet polish budget reached — generative flat tiles pause until tomorrow.",
      },
      429,
      headers
    );
  }

  // Reserve budget before the model call so concurrent posts don't overrun.
  // Sheet mode still costs ONE polish unit for the whole multi-item sheet.
  const afterReserve = await incrementClosetFlatLayBudget(key);

  const headers: Record<string, string> = {
    "X-Closet-FlatLay-Est-Cost-Usd": String(CLOSET_FLATLAY_EST_COST_USD),
    "X-Closet-FlatLay-Budget-Remaining": String(afterReserve.polish.remaining),
    "X-Closet-FlatLay-Model": "",
  };
  attachDeviceCookie(headers, setDeviceCookie);

  if (sheetMode) {
    const rawItems = Array.isArray(body.items) ? body.items : [];
    const items: SheetItemHint[] = rawItems
      .filter((it) => it && typeof it === "object")
      .map((it) => ({
        role: typeof it.role === "string" ? it.role : "other",
        label: typeof it.label === "string" ? it.label.trim().slice(0, 64) : "",
        colorHint: typeof it.colorHint === "string" ? it.colorHint : "other",
      }))
      .filter((it) => it.label || it.role);

    if (items.length < 2) {
      const after = await decrementClosetFlatLayBudget(key);
      headers["X-Closet-FlatLay-Budget-Remaining"] = String(after.polish.remaining);
      return json(
        {
          ok: false,
          code: "invalid_body",
          error: "Sheet mode requires items[] with ≥2 entries",
          polish: after.polish,
        },
        400,
        headers
      );
    }

    const result = await polishOutfitToFlatLaySheet({
      imageDataUrl,
      items,
      estCostUsd: CLOSET_FLATLAY_EST_COST_USD,
    });

    if (!result.ok) {
      const after = await decrementClosetFlatLayBudget(key);
      headers["X-Closet-FlatLay-Budget-Remaining"] = String(after.polish.remaining);
      return json(
        {
          ok: false,
          code: result.code,
          error: result.error,
          polish: after.polish,
        },
        result.code === "no_image_provider" ? 503 : 502,
        headers
      );
    }

    headers["X-Closet-FlatLay-Model"] = result.model;
    return json(
      {
        ok: true,
        mode: "sheet",
        sheetDataUrl: result.sheetDataUrl,
        tiles: result.tiles,
        model: result.model,
        provider: result.provider,
        estCostUsd: result.estCostUsd,
        polish: afterReserve.polish,
      },
      200,
      headers
    );
  }

  const labelHint = typeof body.labelHint === "string" ? body.labelHint.trim().slice(0, 64) : undefined;
  const result = await polishCutoutToFlatLay({
    imageDataUrl,
    roleHint: body.roleHint,
    colorHint: body.colorHint,
    labelHint,
    estCostUsd: CLOSET_FLATLAY_EST_COST_USD,
  });

  headers["X-Closet-FlatLay-Model"] = result.ok ? result.model : "";

  if (!result.ok) {
    // Soft-fail: client keeps rembg. Refund reserve on model/config failures so billing
    // blockers (e.g. Gateway needs card) do not burn the daily polish cap.
    const after = await decrementClosetFlatLayBudget(key);
    headers["X-Closet-FlatLay-Budget-Remaining"] = String(after.polish.remaining);
    return json(
      {
        ok: false,
        code: result.code,
        error: result.error,
        polish: after.polish,
      },
      result.code === "no_image_provider" ? 503 : 502,
      headers
    );
  }

  return json(
    {
      ok: true,
      mode: "tile",
      polishedDataUrl: result.polishedDataUrl,
      model: result.model,
      provider: result.provider,
      estCostUsd: result.estCostUsd,
      polish: afterReserve.polish,
    },
    200,
    headers
  );
}
