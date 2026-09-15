import { generateObject, jsonSchema } from "ai";
import {
  EYE_COLORS,
  HAIR_COLORS,
  HAIR_LENGTHS,
  parseAppearance,
  SKIN_TONE_BANDS,
} from "@/lib/appearance";
import type { AppearanceTags } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const APPEARANCE_VISION_MODEL =
  process.env.APPEARANCE_VISION_MODEL?.trim() || "openai/gpt-4o-mini";

const hairIds = HAIR_COLORS.map((item) => item.id);
const lengthIds = HAIR_LENGTHS.map((item) => item.id);
const eyeIds = EYE_COLORS.map((item) => item.id);
const skinIds = SKIN_TONE_BANDS.map((item) => item.id);

const appearanceSchema = jsonSchema<AppearanceTags>({
  type: "object",
  properties: {
    hairColor: { type: "string", enum: hairIds },
    hairLength: { type: "string", enum: lengthIds },
    eyes: { type: "string", enum: eyeIds },
    skinToneBand: { type: "string", enum: skinIds },
  },
  additionalProperties: false,
});

function hasGatewayAuth(): boolean {
  if (process.env.AI_GATEWAY_API_KEY?.trim()) return true;
  if (process.env.VERCEL_OIDC_TOKEN?.trim()) return true;
  const onVercel = process.env.VERCEL === "1" || process.env.VERCEL === "true";
  return onVercel && process.env.VERCEL_ENV === "production";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const dataUrl =
    body && typeof body === "object" && typeof (body as { dataUrl?: unknown }).dataUrl === "string"
      ? (body as { dataUrl: string }).dataUrl.trim()
      : "";
  if (!dataUrl.startsWith("data:image/")) {
    return Response.json({ error: "dataUrl image required", appearance: {} }, { status: 400 });
  }
  if (!hasGatewayAuth()) {
    return Response.json({ error: "no_gateway", appearance: {}, fallback: true }, { status: 503 });
  }

  try {
    const { object } = await generateObject({
      model: APPEARANCE_VISION_MODEL,
      schema: appearanceSchema,
      schemaName: "AppearanceTags",
      schemaDescription: "Editable guesses for hair, eyes, and skin from a daylight face photo.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Guess appearance for styling chips from this daylight face photo. " +
                "Return only: hairColor, hairLength, eyes, skinToneBand. " +
                `hairColor one of: ${hairIds.join(", ")}. ` +
                `hairLength one of: ${lengthIds.join(", ")}. ` +
                `eyes one of: ${eyeIds.join(", ")}. ` +
                `skinToneBand one of: ${skinIds.join(", ")}. ` +
                "Prefer visible evidence (blue eyes stay blue; dark blonde/light brown is blonde not brunette). " +
                "If unsure, pick the closest option.",
            },
            { type: "image", image: dataUrl },
          ],
        },
      ],
    });
    const appearance = parseAppearance(object) ?? {};
    return Response.json({
      appearance,
      model: APPEARANCE_VISION_MODEL,
      source: "vision",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "vision failed";
    console.warn("[appearance-guess]", message);
    return Response.json({ error: message, appearance: {}, fallback: true }, { status: 502 });
  }
}
