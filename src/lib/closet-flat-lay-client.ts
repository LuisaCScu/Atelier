/**
 * Browser client for POST /api/closet/flat-lay + GET budget.
 * Confirm path requires polish success — do NOT fall back to rembg as the piece preview.
 */
import type { ClosetFlatLayStatus, ClosetRole, ColorId } from "./types";

export type FlatLayClientOk = {
  ok: true;
  polishedDataUrl: string;
  model?: string;
  provider?: string;
  flatLayStatus: "ready";
};

export type FlatLayClientFail = {
  ok: false;
  status: number;
  code?: string;
  error?: string;
  /** skipped = budget/provider soft skip; failed = polish error */
  flatLayStatus: Extract<ClosetFlatLayStatus, "skipped" | "failed">;
};

export type ClosetFlatLayBudgetClient = {
  ok: boolean;
  providerAvailable: boolean;
  polish: { used: number; limit: number; remaining: number; exhausted: boolean };
  day?: string;
  estCostUsdPerCall?: number;
  identity?: string;
};

export const POLISH_BUDGET_EXHAUSTED_MSG =
  "Daily closet polish budget reached — generative flat tiles pause until tomorrow.";

export async function fetchClosetFlatLayBudget(
  signal?: AbortSignal
): Promise<ClosetFlatLayBudgetClient> {
  try {
    const res = await fetch("/api/closet/flat-lay/budget", {
      method: "GET",
      credentials: "same-origin",
      signal,
    });
    const body = (await res.json().catch(() => ({}))) as Partial<ClosetFlatLayBudgetClient> & {
      polish?: ClosetFlatLayBudgetClient["polish"];
    };
    const polish = body.polish ?? { used: 0, limit: 10, remaining: 10, exhausted: false };
    return {
      ok: Boolean(body.ok ?? res.ok),
      providerAvailable: Boolean(body.providerAvailable),
      polish: {
        used: Number(polish.used) || 0,
        limit: Number(polish.limit) || 10,
        remaining: Math.max(0, Number(polish.remaining) || 0),
        exhausted: Boolean(polish.exhausted) || (Number(polish.remaining) || 0) <= 0,
      },
      day: body.day,
      estCostUsdPerCall: body.estCostUsdPerCall,
      identity: body.identity,
    };
  } catch {
    return {
      ok: false,
      providerAvailable: false,
      polish: { used: 0, limit: 10, remaining: 0, exhausted: true },
    };
  }
}

export async function requestClosetFlatLayPolish(params: {
  imageDataUrl: string;
  roleHint?: ClosetRole | string | null;
  colorHint?: ColorId | "other" | string | null;
  labelHint?: string | null;
  signal?: AbortSignal;
}): Promise<FlatLayClientOk | FlatLayClientFail> {
  const imageDataUrl = params.imageDataUrl?.trim() || "";
  if (!imageDataUrl.startsWith("data:image/")) {
    return { ok: false, status: 0, code: "invalid_image", flatLayStatus: "failed", error: "Expected image data URL" };
  }

  let res: Response;
  try {
    res = await fetch("/api/closet/flat-lay", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        imageDataUrl,
        roleHint: params.roleHint ?? undefined,
        colorHint: params.colorHint ?? undefined,
        labelHint: params.labelHint ?? undefined,
      }),
      signal: params.signal,
    });
  } catch (err) {
    return {
      ok: false,
      status: 0,
      code: "network",
      flatLayStatus: "failed",
      error: err instanceof Error ? err.message : "Network error",
    };
  }

  let body: {
    ok?: boolean;
    polishedDataUrl?: string;
    model?: string;
    provider?: string;
    code?: string;
    error?: string;
  } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    /* ignore */
  }

  if (res.ok && body.ok && typeof body.polishedDataUrl === "string" && body.polishedDataUrl.startsWith("data:image/")) {
    return {
      ok: true,
      polishedDataUrl: body.polishedDataUrl,
      model: body.model,
      provider: body.provider,
      flatLayStatus: "ready",
    };
  }

  // 429 budget / 503 no provider → skipped. Other → failed.
  const flatLayStatus: "skipped" | "failed" =
    res.status === 429 || res.status === 503 || body.code === "budget_exhausted" || body.code === "no_image_provider"
      ? "skipped"
      : "failed";

  return {
    ok: false,
    status: res.status,
    code: body.code,
    error:
      body.code === "budget_exhausted" || res.status === 429
        ? POLISH_BUDGET_EXHAUSTED_MSG
        : body.error,
    flatLayStatus,
  };
}

export type FlatLaySheetTile = {
  polishedDataUrl: string;
  role: ClosetRole | string;
  label: string;
  colorHint: ColorId | "other" | string;
  index: number;
};

export type FlatLaySheetClientOk = {
  ok: true;
  mode: "sheet";
  sheetDataUrl?: string;
  tiles: FlatLaySheetTile[];
  model?: string;
  provider?: string;
  flatLayStatus: "ready";
};

/** ONE multi-item sheet polish (1 budget unit) → sliced tiles. Primary outfit path. */
export async function requestClosetFlatLaySheet(params: {
  imageDataUrl: string;
  items: { role: ClosetRole | string; label: string; colorHint?: ColorId | "other" | string | null }[];
  signal?: AbortSignal;
}): Promise<FlatLaySheetClientOk | FlatLayClientFail> {
  const imageDataUrl = params.imageDataUrl?.trim() || "";
  if (!imageDataUrl.startsWith("data:image/")) {
    return {
      ok: false,
      status: 0,
      code: "invalid_image",
      flatLayStatus: "failed",
      error: "Expected image data URL",
    };
  }
  if (!Array.isArray(params.items) || params.items.length < 2) {
    return {
      ok: false,
      status: 0,
      code: "invalid_body",
      flatLayStatus: "failed",
      error: "Sheet polish needs ≥2 items",
    };
  }

  let res: Response;
  try {
    res = await fetch("/api/closet/flat-lay", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: "sheet",
        imageDataUrl,
        items: params.items.map((it) => ({
          role: it.role,
          label: it.label,
          colorHint: it.colorHint ?? undefined,
        })),
      }),
      signal: params.signal,
    });
  } catch (err) {
    return {
      ok: false,
      status: 0,
      code: "network",
      flatLayStatus: "failed",
      error: err instanceof Error ? err.message : "Network error",
    };
  }

  let body: {
    ok?: boolean;
    mode?: string;
    sheetDataUrl?: string;
    tiles?: FlatLaySheetTile[];
    model?: string;
    provider?: string;
    code?: string;
    error?: string;
  } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    /* ignore */
  }

  const tiles = Array.isArray(body.tiles)
    ? body.tiles.filter(
        (t) =>
          t &&
          typeof t.polishedDataUrl === "string" &&
          t.polishedDataUrl.startsWith("data:image/")
      )
    : [];

  if (res.ok && body.ok && tiles.length >= 2) {
    return {
      ok: true,
      mode: "sheet",
      sheetDataUrl: typeof body.sheetDataUrl === "string" ? body.sheetDataUrl : undefined,
      tiles,
      model: body.model,
      provider: body.provider,
      flatLayStatus: "ready",
    };
  }

  const flatLayStatus: "skipped" | "failed" =
    res.status === 429 ||
    res.status === 503 ||
    body.code === "budget_exhausted" ||
    body.code === "no_image_provider"
      ? "skipped"
      : "failed";

  return {
    ok: false,
    status: res.status,
    code: body.code,
    error:
      body.code === "budget_exhausted" || res.status === 429
        ? POLISH_BUDGET_EXHAUSTED_MSG
        : body.error || (tiles.length < 2 ? "Sheet returned too few tiles" : undefined),
    flatLayStatus,
  };
}
