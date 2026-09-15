import type { AppearanceTags, EyeColorId, HairColorId, HairLengthId, LookAgeId, SkinToneBandId } from "./types";

export const LOOK_AGES: { id: LookAgeId; label: string; hint: string }[] = [
  { id: "younger", label: "Younger", hint: "Early twenties energy" },
  { id: "mid", label: "Mid", hint: "Late twenties to forties" },
  { id: "mature", label: "Mature", hint: "A more grown line" },
  { id: "mixed", label: "Mixed", hint: "Keep it flexible" },
];

export const HAIR_COLORS: { id: HairColorId; label: string }[] = [
  { id: "black", label: "Black" },
  { id: "brunette", label: "Brunette" },
  { id: "auburn", label: "Auburn" },
  { id: "blonde", label: "Blonde" },
  { id: "red", label: "Red" },
  { id: "gray", label: "Gray" },
];

export const HAIR_LENGTHS: { id: HairLengthId; label: string }[] = [
  { id: "short", label: "Short" },
  { id: "medium", label: "Medium" },
  { id: "long", label: "Long" },
];

export const EYE_COLORS: { id: EyeColorId; label: string }[] = [
  { id: "brown", label: "Brown" },
  { id: "hazel", label: "Hazel" },
  { id: "green", label: "Green" },
  { id: "blue", label: "Blue" },
  { id: "gray", label: "Gray" },
];

export const SKIN_TONE_BANDS: { id: SkinToneBandId; label: string }[] = [
  { id: "fair", label: "Fair" },
  { id: "light", label: "Light" },
  { id: "medium", label: "Medium" },
  { id: "medium-deep", label: "Medium-deep" },
  { id: "deep", label: "Deep" },
  { id: "deep-rich", label: "Deep rich" },
];

const HAIR = new Set(HAIR_COLORS.map((item) => item.id));
const LENGTH = new Set(HAIR_LENGTHS.map((item) => item.id));
const EYES = new Set(EYE_COLORS.map((item) => item.id));
const SKIN = new Set(SKIN_TONE_BANDS.map((item) => item.id));
const AGES = new Set(LOOK_AGES.map((item) => item.id));

export function parseLookAge(raw: unknown): LookAgeId | undefined {
  return typeof raw === "string" && AGES.has(raw as LookAgeId) ? (raw as LookAgeId) : undefined;
}

export function parseAppearance(raw: unknown): AppearanceTags | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const rec = raw as Record<string, unknown>;
  const tags: AppearanceTags = {};
  if (typeof rec.hairColor === "string" && HAIR.has(rec.hairColor as HairColorId)) {
    tags.hairColor = rec.hairColor as HairColorId;
  }
  if (typeof rec.hairLength === "string" && LENGTH.has(rec.hairLength as HairLengthId)) {
    tags.hairLength = rec.hairLength as HairLengthId;
  }
  if (typeof rec.eyes === "string" && EYES.has(rec.eyes as EyeColorId)) {
    tags.eyes = rec.eyes as EyeColorId;
  }
  if (typeof rec.skinToneBand === "string" && SKIN.has(rec.skinToneBand as SkinToneBandId)) {
    tags.skinToneBand = rec.skinToneBand as SkinToneBandId;
  }
  return Object.keys(tags).length ? tags : undefined;
}

export function lookAgeLabel(id?: LookAgeId): string {
  return LOOK_AGES.find((item) => item.id === id)?.label ?? "";
}

export function appearanceChipLabels(tags?: AppearanceTags): string[] {
  if (!tags) return [];
  return [
    HAIR_COLORS.find((item) => item.id === tags.hairColor)?.label,
    HAIR_LENGTHS.find((item) => item.id === tags.hairLength)?.label,
    EYE_COLORS.find((item) => item.id === tags.eyes)?.label,
    SKIN_TONE_BANDS.find((item) => item.id === tags.skinToneBand)?.label,
  ].filter((item): item is string => Boolean(item));
}

export function guessHairColor(hairL: number, warmth: number): HairColorId {
  if (hairL < 48) return "black";
  if (hairL > 175 && warmth < 25) return "gray";
  if (hairL > 155) return "blonde";
  if (warmth > 55 && hairL < 130) return "red";
  if (warmth > 28 && hairL < 120) return "auburn";
  return "brunette";
}

export function guessSkinToneBand(skinL: number): SkinToneBandId {
  if (skinL < 62) return "deep-rich";
  if (skinL < 88) return "deep";
  if (skinL < 118) return "medium-deep";
  if (skinL < 150) return "medium";
  if (skinL < 185) return "light";
  return "fair";
}

/** Heuristic fallback from a daylight face still (canvas sampling). */
export async function guessAppearanceHeuristicFromDataUrl(dataUrl: string): Promise<AppearanceTags> {
  if (typeof Image === "undefined") return {};
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const size = 128;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve({});
        return;
      }
      ctx.drawImage(image, 0, 0, size, size);
      const { data } = ctx.getImageData(0, 0, size, size);
      const skin = sample(data, size, 0.3, 0.36, 0.7, 0.72);
      const hair = sample(data, size, 0.22, 0.04, 0.78, 0.22);
      if (!skin.n) {
        resolve({});
        return;
      }
      const skinL = 0.2126 * (skin.r / skin.n) + 0.7152 * (skin.g / skin.n) + 0.0722 * (skin.b / skin.n);
      const hr = hair.n ? hair.r / hair.n : skin.r / skin.n;
      const hg = hair.n ? hair.g / hair.n : skin.g / skin.n;
      const hb = hair.n ? hair.b / hair.n : skin.b / skin.n;
      const hairL = 0.2126 * hr + 0.7152 * hg + 0.0722 * hb;
      resolve({
        hairColor: guessHairColor(hairL, hr - hb),
        hairLength: "medium",
        eyes: "brown",
        skinToneBand: guessSkinToneBand(skinL),
      });
    };
    image.onerror = () => resolve({});
    image.src = dataUrl;
  });
}

/**
 * Prefer cheap text-vision via Vercel AI Gateway (`openai/gpt-4o-mini`).
 * Heuristic / rembg-adjacent canvas sampling is fallback only when gateway fails.
 */
export async function guessAppearanceFromDataUrl(dataUrl: string): Promise<AppearanceTags> {
  if (typeof fetch !== "undefined" && dataUrl.startsWith("data:image/")) {
    try {
      const res = await fetch("/api/appearance/guess", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dataUrl }),
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as { appearance?: AppearanceTags };
        const parsed = parseAppearance(data.appearance);
        if (parsed && Object.keys(parsed).length) return parsed;
      }
    } catch {
      /* fall through to heuristic */
    }
  }
  return guessAppearanceHeuristicFromDataUrl(dataUrl);
}

function sample(
  data: Uint8ClampedArray,
  size: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): { r: number; g: number; b: number; n: number } {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let y = Math.floor(size * y0); y < Math.floor(size * y1); y += 2) {
    for (let x = Math.floor(size * x0); x < Math.floor(size * x1); x += 2) {
      const i = (y * size + x) * 4;
      const red = data[i];
      const green = data[i + 1];
      const blue = data[i + 2];
      if (Math.max(red, green, blue) < 22 || Math.min(red, green, blue) > 250) continue;
      r += red;
      g += green;
      b += blue;
      n += 1;
    }
  }
  return { r, g, b, n };
}
