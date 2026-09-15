/**
 * Outfit photo → per-garment crops (vision boxes via Gateway).
 * Client helpers for Photo-add cutout queue.
 * Soft-fail to whole-image rembg ONLY when detect is unavailable or returns <2 garments
 * (single product shots). When detect returns ≥2 items, never ship whole-person rembg.
 */
import type { ClosetRole, ColorId } from "./types";

export type GarmentBox = { x: number; y: number; w: number; h: number };

export type DetectedGarmentPiece = {
  role: ClosetRole;
  label: string;
  colorHint: ColorId | "other";
  box: GarmentBox;
};

export type DetectGarmentsOk = {
  ok: true;
  onBody: boolean;
  garments: DetectedGarmentPiece[];
  model?: string;
};

export type DetectGarmentsFail = {
  ok: false;
  status: number;
  code?: string;
  error?: string;
  garments: [];
  onBody: false;
};

const ROLE_SET = new Set<string>([
  "top",
  "bottom",
  "dress",
  "outerwear",
  "sweater",
  "cardigan",
  "knit",
  "shirt",
  "tee",
  "trousers",
  "shorts",
  "shoes",
  "bag",
  "accessory",
  "other",
]);

function asRole(value: unknown): ClosetRole {
  return typeof value === "string" && ROLE_SET.has(value) ? (value as ClosetRole) : "other";
}

function asColor(value: unknown): ColorId | "other" {
  if (typeof value !== "string") return "other";
  const ok = [
    "navy",
    "black",
    "white",
    "grey",
    "camel",
    "cream",
    "chocolate",
    "olive",
    "stone",
    "sand",
    "charcoal",
    "red",
    "pink",
    "peach",
    "burgundy",
    "blue",
    "green",
    "multi",
  ];
  return ok.includes(value) ? (value as ColorId) : "other";
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function sanitizeBox(raw: unknown): GarmentBox | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const x = clamp01(Number(rec.x));
  const y = clamp01(Number(rec.y));
  let w = clamp01(Number(rec.w));
  let h = clamp01(Number(rec.h));
  if (w < 0.04 || h < 0.04) return null;
  if (x + w > 1) w = Math.max(0.04, 1 - x);
  if (y + h > 1) h = Math.max(0.04, 1 - y);
  return { x, y, w, h };
}

/** Downscale before vision upload so Gateway payloads stay small. */
export async function blobToDetectDataUrl(blob: Blob, maxEdge = 1024): Promise<string> {
  const bitmap = await createImageBitmap(blob);
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.drawImage(bitmap, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    bitmap.close();
  }
}

/**
 * Crop a normalized box from the source photo (with padding).
 * Returns a JPEG blob suitable for rembg.
 */
export async function cropGarmentBlob(
  source: Blob,
  box: GarmentBox,
  padFrac = 0.06
): Promise<Blob> {
  const bitmap = await createImageBitmap(source);
  try {
    const padX = box.w * padFrac;
    const padY = box.h * padFrac;
    const x0 = Math.max(0, (box.x - padX) * bitmap.width);
    const y0 = Math.max(0, (box.y - padY) * bitmap.height);
    const x1 = Math.min(bitmap.width, (box.x + box.w + padX) * bitmap.width);
    const y1 = Math.min(bitmap.height, (box.y + box.h + padY) * bitmap.height);
    const width = Math.max(8, Math.round(x1 - x0));
    const height = Math.max(8, Math.round(y1 - y0));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.drawImage(bitmap, x0, y0, width, height, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error("Crop failed"))),
        "image/jpeg",
        0.92
      );
    });
    return blob;
  } finally {
    bitmap.close();
  }
}

export async function requestDetectGarments(
  image: Blob | string,
  signal?: AbortSignal
): Promise<DetectGarmentsOk | DetectGarmentsFail> {
  let dataUrl: string;
  try {
    dataUrl = typeof image === "string" ? image : await blobToDetectDataUrl(image);
  } catch (err) {
    return {
      ok: false,
      status: 0,
      code: "invalid_image",
      error: err instanceof Error ? err.message : "Could not read image",
      garments: [],
      onBody: false,
    };
  }
  if (!dataUrl.startsWith("data:image/")) {
    return {
      ok: false,
      status: 0,
      code: "invalid_image",
      error: "Expected image data URL",
      garments: [],
      onBody: false,
    };
  }

  let res: Response;
  try {
    res = await fetch("/api/closet/detect-garments", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dataUrl }),
      signal,
    });
  } catch (err) {
    return {
      ok: false,
      status: 0,
      code: "network",
      error: err instanceof Error ? err.message : "Network error",
      garments: [],
      onBody: false,
    };
  }

  let body: {
    ok?: boolean;
    onBody?: boolean;
    garments?: unknown[];
    model?: string;
    code?: string;
    error?: string;
  } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    /* ignore */
  }

  if (!res.ok || !body.ok || !Array.isArray(body.garments)) {
    return {
      ok: false,
      status: res.status,
      code: body.code,
      error: body.error,
      garments: [],
      onBody: false,
    };
  }

  const garments: DetectedGarmentPiece[] = [];
  for (const raw of body.garments) {
    if (!raw || typeof raw !== "object") continue;
    const rec = raw as Record<string, unknown>;
    const box = sanitizeBox(rec.box);
    if (!box) continue;
    const label =
      typeof rec.label === "string" && rec.label.trim() ? rec.label.trim().slice(0, 64) : "";
    garments.push({
      role: asRole(rec.role),
      label: label || asRole(rec.role),
      colorHint: asColor(rec.colorHint),
      box,
    });
  }

  return {
    ok: true,
    onBody: Boolean(body.onBody),
    garments: filterOutfitClutter(carveOverlappingAccessories(garments)),
    model: body.model,
  };
}


/** When a belt/accessory sits inside a dress/top box, shrink the apparel box off the accessory. */
export function carveOverlappingAccessories(garments: DetectedGarmentPiece[]): DetectedGarmentPiece[] {
  const accessories = garments.filter(
    (g) =>
      g.role === "accessory" ||
      g.role === "bag" ||
      /belt|hat|scrunchie|jewel/i.test(g.label || "")
  );
  if (!accessories.length) return garments;
  return garments.map((g) => {
    if (!(g.role === "dress" || g.role === "top" || g.role === "outerwear" || g.role === "sweater")) {
      return g;
    }
    let box = { ...g.box };
    for (const acc of accessories) {
      const a = acc.box;
      const overlapX = Math.min(box.x + box.w, a.x + a.w) - Math.max(box.x, a.x);
      const overlapY = Math.min(box.y + box.h, a.y + a.h) - Math.max(box.y, a.y);
      if (overlapX <= 0 || overlapY <= 0) continue;
      // Belt across mid torso: pull dress bottom up OR top down away from belt band.
      const beltLike = /belt/i.test(acc.label || "") || (a.h > 0 && a.h < box.h * 0.25 && a.w > box.w * 0.35);
      if (beltLike) {
        const beltMid = a.y + a.h / 2;
        const dressMid = box.y + box.h / 2;
        if (beltMid < dressMid) {
          // Belt in upper half — keep dress from belt bottom downward? Prefer exclude belt: end dress above belt.
          // Actually dress includes below belt — carve by removing belt vertical band from consideration:
          // shrink height so top stays, bottom stays, but we can't punch a hole — instead nudge top below belt
          // only when belt is near top. For waist belts, leave dress and rely on polish "omit belt".
          continue;
        }
      }
      // Hat / floor accessory near bottom of box: trim dress/bottom of box above accessory.
      if (a.y > box.y + box.h * 0.55) {
        const newBottom = Math.min(box.y + box.h, a.y - 0.01);
        if (newBottom - box.y >= 0.12) box = { ...box, h: newBottom - box.y };
      }
    }
    return { ...g, box };
  });
}


/** Drop background floor clutter when primary boots already detected (flip-flops/slides). */
export function filterOutfitClutter(garments: DetectedGarmentPiece[]): DetectedGarmentPiece[] {
  const hasBoots = garments.some(
    (g) => g.role === "shoes" && /boot/i.test(`${g.label || ""} ${g.role}`)
  );
  return garments.filter((g) => {
    if (!hasBoots || g.role !== "shoes") return true;
    const l = `${g.label || ""}`.toLowerCase();
    if (/boot/i.test(l)) return true;
    if (/flip|slide|slipper|thong|sandal/i.test(l)) return false;
    return true;
  });
}

/** True when vision found multiple distinct pieces that must become separate closet items. */
export function shouldSplitOutfit(result: DetectGarmentsOk | DetectGarmentsFail): result is DetectGarmentsOk & {
  garments: [DetectedGarmentPiece, DetectedGarmentPiece, ...DetectedGarmentPiece[]];
} {
  return result.ok && result.garments.length >= 2;
}
