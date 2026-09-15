/**
 * POST /api/closet/detect-garments
 * Body: { dataUrl: string }
 *
 * Vision (Gateway gpt-4o-mini) — detect women's garments/accessories in an
 * outfit / mirror selfie, including floor items. Returns normalized boxes +
 * role/label for outfit split. Does NOT touch stylist userGenerate budget.
 */
import { generateObject, jsonSchema } from "ai";
import type { ClosetRole, ColorId } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 45;

const DETECT_MODEL =
  process.env.CLOSET_DETECT_MODEL?.trim() ||
  process.env.APPEARANCE_VISION_MODEL?.trim() ||
  "openai/gpt-4o-mini";

const ROLE_ENUM = [
  "top",
  "bottom",
  "dress",
  "outerwear",
  "sweater",
  "cardigan",
  "shoes",
  "bag",
  "accessory",
  "other",
] as const satisfies readonly ClosetRole[];

const COLOR_ENUM = [
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
  "other",
] as const;

type DetectedGarment = {
  role: ClosetRole;
  label: string;
  colorHint: ColorId | "other";
  /** Normalized box in [0,1] relative to full image: x,y = top-left; w,h = size. */
  box: { x: number; y: number; w: number; h: number };
};

type DetectResult = {
  onBody: boolean;
  garments: DetectedGarment[];
};

const detectSchema = jsonSchema<DetectResult>({
  type: "object",
  properties: {
    onBody: {
      type: "boolean",
      description: "True when a person is wearing one or more garments in frame.",
    },
    garments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          role: { type: "string", enum: [...ROLE_ENUM] },
          label: {
            type: "string",
            description: "Short catalog name, e.g. denim dress, burgundy belt, brown boots",
          },
          colorHint: { type: "string", enum: [...COLOR_ENUM] },
          box: {
            type: "object",
            properties: {
              x: { type: "number" },
              y: { type: "number" },
              w: { type: "number" },
              h: { type: "number" },
            },
            required: ["x", "y", "w", "h"],
            additionalProperties: false,
          },
        },
        required: ["role", "label", "colorHint", "box"],
        additionalProperties: false,
      },
    },
  },
  required: ["onBody", "garments"],
  additionalProperties: false,
});

function hasGatewayAuth(): boolean {
  if (process.env.AI_GATEWAY_API_KEY?.trim()) return true;
  if (process.env.VERCEL_OIDC_TOKEN?.trim()) return true;
  const onVercel = process.env.VERCEL === "1" || process.env.VERCEL === "true";
  return onVercel && process.env.VERCEL_ENV === "production";
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function coerceRoleFromLabel(role: ClosetRole, label: string): ClosetRole {
  const l = label.toLowerCase();
  if (/fedora|hat|beanie|cap|scrunchie|belt|jewel|earring|necklace|bracelet|sunglass/.test(l)) {
    return "accessory";
  }
  if (/boot|shoe|sandal|sneaker|heel|loafer/.test(l)) return "shoes";
  if (/dress|romper|jumpsuit/.test(l)) return "dress";
  if (/bag|purse|tote|clutch/.test(l)) return "bag";
  return role;
}

function normalizeGarment(raw: DetectedGarment): DetectedGarment | null {
  let role = (ROLE_ENUM as readonly string[]).includes(raw.role) ? raw.role : "other";
  const label =
    typeof raw.label === "string" && raw.label.trim()
      ? raw.label.trim().slice(0, 64)
      : role;
  role = coerceRoleFromLabel(role as ClosetRole, label);
  const colorHint = (COLOR_ENUM as readonly string[]).includes(raw.colorHint)
    ? raw.colorHint
    : "other";
  const x = clamp01(Number(raw.box?.x));
  const y = clamp01(Number(raw.box?.y));
  let w = clamp01(Number(raw.box?.w));
  let h = clamp01(Number(raw.box?.h));
  if (w < 0.04 || h < 0.04) return null;
  if (x + w > 1) w = Math.max(0.04, 1 - x);
  if (y + h > 1) h = Math.max(0.04, 1 - y);
  return { role: role as ClosetRole, label, colorHint: colorHint as ColorId | "other", box: { x, y, w, h } };
}

/** Prefer larger / apparel pieces first; drop near-duplicates. */
function dedupeGarments(items: DetectedGarment[]): DetectedGarment[] {
  const sorted = [...items].sort((a, b) => b.box.w * b.box.h - a.box.w * a.box.h);
  const kept: DetectedGarment[] = [];
  for (const g of sorted) {
    const cx = g.box.x + g.box.w / 2;
    const cy = g.box.y + g.box.h / 2;
    const overlap = kept.some((k) => {
      const kx = k.box.x + k.box.w / 2;
      const ky = k.box.y + k.box.h / 2;
      const sameRole = k.role === g.role;
      const near = Math.abs(cx - kx) < 0.12 && Math.abs(cy - ky) < 0.12;
      const areaRatio =
        Math.min(k.box.w * k.box.h, g.box.w * g.box.h) /
        Math.max(k.box.w * k.box.h, g.box.w * g.box.h);
      return sameRole && near && areaRatio > 0.55;
    });
    if (!overlap) kept.push(g);
  }
  return kept.slice(0, 8);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const dataUrl =
    body && typeof body === "object" && typeof (body as { dataUrl?: unknown }).dataUrl === "string"
      ? (body as { dataUrl: string }).dataUrl.trim()
      : "";
  if (!dataUrl.startsWith("data:image/")) {
    return Response.json({ ok: false, code: "invalid_image", error: "dataUrl image required" }, { status: 400 });
  }
  if (dataUrl.length > 8_000_000) {
    return Response.json({ ok: false, code: "invalid_image", error: "Image too large" }, { status: 413 });
  }
  if (!hasGatewayAuth()) {
    return Response.json({ ok: false, code: "no_gateway", error: "no_gateway", fallback: true }, { status: 503 });
  }

  try {
    const { object } = await generateObject({
      model: DETECT_MODEL,
      schema: detectSchema,
      schemaName: "ClosetGarmentDetect",
      schemaDescription:
        "Detect each distinct women's fashion item in an outfit photo for closet split into catalog tiles.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "PROMPT LOCK — Closet Photo extraction (Admin/Luisa):\n" +
                "1) Find every distinct women's garment/accessory in the photo (worn on body AND on floor/furniture).\n" +
                "2) Each item will be laid flat as a catalog flat-lay tile — isolate pieces for that pipeline.\n" +
                "3) No background person/scene as a piece — do NOT return the whole person as one item.\n" +
                "4) One item per tile / one entry per distinct piece.\n" +
                "5) ANY paired item = ONE tile for the pair (shoes, boots, sandals, sneakers, socks, gloves, earrings, etc.) — NEVER left/right split; one box covering BOTH boots/shoes side-by-side (not a single boot).\n6) Hats/fedoras on the floor are accessories — label clearly (e.g. brown fedora hat) and box tightly around the hat only.\n7) Belts on dresses are separate accessory entries with a tight belt-only box.\n" +
                "Typical items: dress, romper, top, bottom, sweater, outerwear, belt, boots, sandals, sneakers, hat, bag, scrunchie, jewelry as accessory.\n" +
                "Do NOT invent items that are not visible.\nPrefer worn outfit pieces + intentional accessories (belt on dress, hat on floor) over background clutter (flip-flops/slides on the floor when tall boots are already worn). Always emit a belt as its own accessory when a waist belt is visible on a dress.\n" +
                "For each item return: role (one of " +
                ROLE_ENUM.join(", ") +
                "), short label (e.g. 'denim dress', 'burgundy belt', 'brown boots', 'fedora hat'), " +
                "colorHint (closet color id or other), and box as normalized 0–1 fractions of the FULL image " +
                "(x,y = top-left corner; w,h = width/height). Boxes must tightly cover that item only — " +
                "no torso leftover on a belt, no full legs on a dress hem, no floor/furniture padding. " +
                "Belts, hats, paired shoes, and small accessories each get their OWN entry (pairs stay together). " +
                "CRITICAL: boxes must be exclusive — if a belt sits on a dress, the dress box EXCLUDES the belt band and the belt gets its own tight box; " +
                "do not wrap the whole torso+belt as the dress. Hats on the floor get their own box. " +
                "Prefer accurate closet colors (chocolate brown boots ≠ black). " +
                "Set onBody true if someone is wearing clothes in frame. " +
                "If the photo is already a single flat product shot of one garment, return exactly one garment.",
            },
            { type: "image", image: dataUrl },
          ],
        },
      ],
    });

    const garments = dedupeGarments(
      (object.garments || [])
        .map((g) => normalizeGarment(g as DetectedGarment))
        .filter((g): g is DetectedGarment => Boolean(g))
    );

    return Response.json({
      ok: true,
      onBody: Boolean(object.onBody),
      garments,
      model: DETECT_MODEL,
      source: "vision",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "detect failed";
    console.warn("[closet-detect-garments]", message);
    return Response.json(
      { ok: false, code: "detect_failed", error: message, fallback: true, garments: [], onBody: false },
      { status: 502 }
    );
  }
}
