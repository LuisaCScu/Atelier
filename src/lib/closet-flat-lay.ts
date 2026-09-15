/**
 * Closet flat-lay polish pipeline (rembg cutout → catalog tile).
 *
 * Provider calls live in closet-flat-lay-adapter.ts (AI Gateway lock).
 * This module owns PNG plate prep + prompt — never stylist budgets.
 *
 * rembg tips: PNG only; don't re-encode JPEG or white-balance garment RGB —
 * only replace transparent bg pixels (twin alpha + white/cream plate).
 */
import sharp from "sharp";
import type { ClosetRole, ColorId } from "./types";
import {
  hasFlatLayImageProvider,
  runFlatLayImagePolish,
  type FlatLayProviderKind,
  closetFlatLayModel,
  detectFlatLayProvider,
} from "./closet-flat-lay-adapter";

export {
  hasFlatLayImageProvider,
  closetFlatLayModel,
  detectFlatLayProvider,
  CLOSET_FLATLAY_MODEL_DEFAULT,
} from "./closet-flat-lay-adapter";
export type { FlatLayProviderKind };

/** Cream plate matching hang-rack CUTOUT_PLATE (#FFFAF5). */
export const FLATLAY_PLATE_RGB = { r: 255, g: 250, b: 245 };

/**
 * Decode a data URL to PNG Buffer. No JPEG re-encode of garment pixels;
 * sharp → PNG with alpha preserved.
 */
export async function dataUrlToPngBuffer(dataUrl: string): Promise<Buffer> {
  const trimmed = dataUrl.trim();
  if (!trimmed.startsWith("data:")) throw new Error("Expected image data URL");
  const comma = trimmed.indexOf(",");
  if (comma < 0) throw new Error("Expected image data URL");
  const meta = trimmed.slice(5, comma); // between data: and first comma
  const payload = trimmed.slice(comma + 1);
  const isB64 = /;base64$/i.test(meta) || /;base64;/i.test(meta);
  const mimePart = meta.split(";")[0] || "application/octet-stream";
  const mime = mimePart.toLowerCase();
  if (!mime.startsWith("image/")) throw new Error("Expected image data URL");
  const raw = isB64
    ? Buffer.from(payload, "base64")
    : Buffer.from(decodeURIComponent(payload), "utf8");
  return sharp(raw).ensureAlpha().png().toBuffer();
}

/**
 * Twin plate: garment RGB untouched; transparent → cream.
 * Opaque PNG for gpt-image (models dislike bare alpha).
 */
export async function alphaToWhitePlatePng(alphaPng: Buffer): Promise<Buffer> {
  const meta = await sharp(alphaPng).metadata();
  const width = meta.width || 512;
  const height = meta.height || 512;
  const plate = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: FLATLAY_PLATE_RGB,
    },
  })
    .png()
    .toBuffer();

  return sharp(plate)
    .composite([{ input: alphaPng, blend: "over" }])
    .png()
    .toBuffer();
}

export function buildFlatLayPrompt(opts: {
  roleHint?: ClosetRole | string | null;
  colorHint?: ColorId | "other" | string | null;
  labelHint?: string | null;
}): string {
  const label = (opts.labelHint || "").trim().slice(0, 64);
  const role = opts.roleHint && opts.roleHint !== "other" ? String(opts.roleHint) : "garment";
  const color =
    opts.colorHint && opts.colorHint !== "other" ? `${opts.colorHint} ` : "";
  const named = label || `${color}${role}`.trim();
  const pairNote =
    role === "shoes" || /shoe|boot|sandal|sneaker|sock|glove|earring|pair/i.test(role)
      ? " If this is a paired item (shoes, boots, sandals, sneakers, socks, gloves, earrings, etc.), keep BOTH sides together as ONE tile for the pair — never left/right split."
      : " If the reference shows a paired item (shoes/socks/gloves/earrings/etc.), keep the pair as ONE tile — never split left/right.";
  const roleIsolate =
    role === "dress"
      ? " Extract the DRESS only — omit any belt, bag, jewelry, or shoes that may appear in the crop (those are separate tiles)."
      : role === "accessory" || /belt|hat|scrunchie|jewelry/i.test(role)
        ? " Extract ONLY this accessory as itself (e.g. a belt stays a flat belt — never invent a bag; a hat/fedora stays a hat — never invent a sweater/cardigan). Preserve buckle/hardware/brim exactly."
        : role === "shoes" || /boot|shoe|sandal|sneaker/i.test(role)
          ? " Preserve the exact boot/shoe color from the reference (chocolate/brown suede stays brown — do not turn brown into black)."
          : " Extract ONLY this one item; omit other garments that leak into the crop.";
  return [
    "PROMPT LOCK — Closet flat-lay tile:",
    "Find the garment/accessory in the reference (even if worn on a person or cropped from an outfit selfie); extract ONLY that item and lay it flat as a catalog flat-lay; no background (isolated cream/white); one item per tile;",
    "ANY paired item = one tile for the pair (shoes, socks, gloves, earrings, etc.) — never left/right split.",
    `Catalog-style flat-lay product photo of a single women's ${named} isolated on a plain cream white background.`,
    label
      ? `The item is specifically: "${label}" — do NOT substitute a different garment type (boots stay boots, hats stay hats, belts stay belts, dresses stay dresses).`
      : `Stay faithful to the reference item type (${role}).`,
    "Preserve the exact color, pattern, fabric texture, hardware, and silhouette from the reference.",
    "Off-model product shot only — NOT worn on a person. Reconstruct a clean flat-lay as ChatGPT image edit would.",
    "NO face, NO body, NO mannequin, NO likeness, NO hanger, NO clips, NO hands, NO floor, NO furniture.",
    "Single garment/accessory only (or one intact pair), centered, soft even studio lighting, no cast shadow drama.",
    "Clean e-commerce tile suitable for a digital closet hang-rack." + pairNote + roleIsolate,
  ].join(" ");
}

export type FlatLayPolishResult = {
  ok: true;
  polishedDataUrl: string;
  model: string;
  provider: FlatLayProviderKind;
  estCostUsd: number;
};

export type FlatLayPolishFailure = {
  ok: false;
  code: "no_image_provider" | "polish_failed" | "invalid_image";
  error: string;
};

/**
 * rembg cutout → gpt-image catalog flat-lay via Gateway adapter.
 * Caller owns polish budget INCR.
 */
export async function polishCutoutToFlatLay(params: {
  imageDataUrl: string;
  roleHint?: ClosetRole | string | null;
  colorHint?: ColorId | "other" | string | null;
  labelHint?: string | null;
  estCostUsd?: number;
}): Promise<FlatLayPolishResult | FlatLayPolishFailure> {
  if (!hasFlatLayImageProvider()) {
    return { ok: false, code: "no_image_provider", error: "No AI Gateway provider configured" };
  }

  let alphaPng: Buffer;
  let platePng: Buffer;
  try {
    alphaPng = await dataUrlToPngBuffer(params.imageDataUrl);
    platePng = await alphaToWhitePlatePng(alphaPng);
  } catch (err) {
    return {
      ok: false,
      code: "invalid_image",
      error: err instanceof Error ? err.message : "Invalid image",
    };
  }

  const prompt = buildFlatLayPrompt({
    roleHint: params.roleHint,
    colorHint: params.colorHint,
    labelHint: params.labelHint,
  });
  const estCostUsd = params.estCostUsd ?? 0.04;

  const adapted = await runFlatLayImagePolish({ platePng, prompt });
  if (!adapted.ok) {
    return { ok: false, code: adapted.code, error: adapted.error };
  }

  // Always persist polished as PNG (never JPEG).
  const polishedPng = await sharp(adapted.png).png().toBuffer();
  const polishedDataUrl = `data:image/png;base64,${polishedPng.toString("base64")}`;

  console.info(
    `[closet-flat-lay] model=${adapted.model} provider=${adapted.provider} estUsd=${estCostUsd} bytes=${polishedPng.length}`
  );

  return {
    ok: true,
    polishedDataUrl,
    model: adapted.model,
    provider: adapted.provider,
    estCostUsd,
  };
}
