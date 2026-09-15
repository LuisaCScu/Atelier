import type { ChromaId, SeasonId, UndertoneId, ValueId } from "./types";

export interface ColorWhy {
  name: string;
  hex: string;
  why: string;
}

export interface ColorResult {
  undertone: UndertoneId;
  value: ValueId;
  chroma: ChromaId;
  season: SeasonId;
  secondary?: SeasonId;
  summary: string;
  colors: ColorWhy[];
  fromFace: boolean;
}

export interface SeasonGuide {
  id: SeasonId;
  label: string;
  undertone: UndertoneId;
  value: ValueId;
  chroma: ChromaId;
  primary: string;
  secondaryAspect: string;
  summary: string;
  colors: ColorWhy[];
}

/** First-party 12-season guides. Swatches are our own, tied to undertone / value / chroma — not a copied palette. */
export const SEASON_GUIDES: SeasonGuide[] = [
  {
    id: "light-spring",
    label: "Light spring",
    undertone: "warm",
    value: "light",
    chroma: "bright",
    primary: "light",
    secondaryAspect: "warm",
    summary: "Warm · light · clear. Soft sun, not earth.",
    colors: [
      { name: "Peach", hex: "#f4a882", why: "Warm clear tint at a light value — opens the face without ivory glare." },
      { name: "Coral", hex: "#ff7f6a", why: "Bright warm chroma; a soft spring red, not autumn brick." },
      { name: "Turquoise", hex: "#4ec9c7", why: "Clear cool-adjacent aqua that still reads warm-spring fresh." },
      { name: "Warm gold", hex: "#e8c04a", why: "Yellow-gold light that keeps chroma bright, not dusty camel." },
    ],
  },
  {
    id: "true-spring",
    label: "True spring",
    undertone: "warm",
    value: "medium",
    chroma: "bright",
    primary: "warm",
    secondaryAspect: "bright",
    summary: "Warm · medium · clear. Golden, not dusty.",
    colors: [
      { name: "Clear tomato", hex: "#e24a2f", why: "Warm clear red at medium value — pigment, not greyed rust." },
      { name: "Warm gold", hex: "#d4a017", why: "Saturated yellow-gold; the spring warmth without autumn mute." },
      { name: "Turquoise", hex: "#2bb8b0", why: "Clear warm-leaning aqua that keeps chroma high." },
      { name: "Coral", hex: "#f07050", why: "Bright peach-coral — golden undertone, not dusty brick." },
    ],
  },
  {
    id: "bright-spring",
    label: "Bright spring",
    undertone: "warm",
    value: "medium",
    chroma: "bright",
    primary: "bright",
    secondaryAspect: "warm",
    summary: "Warm · medium · very clear. High chroma first.",
    colors: [
      { name: "Coral", hex: "#ff5a45", why: "High-chroma warm red — clarity is the primary match." },
      { name: "Turquoise", hex: "#00c4c0", why: "Electric clear aqua against warm, bright skin." },
      { name: "Warm gold", hex: "#f0c020", why: "Saturated gold leaf energy — not a muted camel." },
      { name: "Clear tomato", hex: "#e8361e", why: "True warm red kept bright; never greyed into autumn." },
    ],
  },
  {
    id: "light-summer",
    label: "Light summer",
    undertone: "cool",
    value: "light",
    chroma: "muted",
    primary: "light",
    secondaryAspect: "cool",
    summary: "Cool · light · muted. Dusty air, not ice.",
    colors: [
      { name: "Soft rose", hex: "#d9a8b8", why: "Cool muted pink at a light value — no yellow cream." },
      { name: "Periwinkle", hex: "#9aafd4", why: "Blue-based and softened; chalky, not winter cobalt." },
      { name: "Lavender", hex: "#b8a8cc", why: "Cool mauve-lilac kept light and greyed." },
      { name: "Dusty teal", hex: "#7aa8a4", why: "Muted blue-green that stays soft summer, not bright spring." },
    ],
  },
  {
    id: "true-summer",
    label: "True summer",
    undertone: "cool",
    value: "medium",
    chroma: "muted",
    primary: "cool",
    secondaryAspect: "muted",
    summary: "Cool · medium · muted. Blue-based, softened.",
    colors: [
      { name: "Soft rose", hex: "#c4889a", why: "Cool muted rose at medium value — pigment with grey in it." },
      { name: "Periwinkle", hex: "#7a92b8", why: "Blue undertone softened; not a clear winter navy." },
      { name: "Dusty teal", hex: "#5f8f8a", why: "Muted cool green-blue that stays wearable and soft." },
      { name: "Mauve", hex: "#9a7a8e", why: "Greyed cool purple — summer chroma, not winter fuchsia." },
    ],
  },
  {
    id: "soft-summer",
    label: "Soft summer",
    undertone: "cool",
    value: "medium",
    chroma: "muted",
    primary: "muted",
    secondaryAspect: "cool",
    summary: "Cool · medium · very muted. Neighbors soft autumn.",
    colors: [
      { name: "Mauve", hex: "#8f7384", why: "Very muted cool rose — low chroma first." },
      { name: "Dusty teal", hex: "#6a8a86", why: "Greyed teal that won’t raise contrast on a soft face." },
      { name: "Soft rose", hex: "#c4a0aa", why: "Powdery cool pink; camel would push too warm." },
      { name: "Lavender", hex: "#a090b0", why: "Soft cool lilac — neighbors soft autumn without going earthy." },
    ],
  },
  {
    id: "soft-autumn",
    label: "Soft autumn",
    undertone: "warm",
    value: "medium",
    chroma: "muted",
    primary: "muted",
    secondaryAspect: "warm",
    summary: "Warm · medium · muted. Earth, not gold leaf.",
    colors: [
      { name: "Rust", hex: "#b85a3a", why: "Warm muted orange-red — earth pigment, not spring coral." },
      { name: "Olive", hex: "#6b6f3a", why: "Yellow-green with low chroma — the autumn mute." },
      { name: "Mustard", hex: "#c4a035", why: "Muted warm yellow; gold kept dusty, not bright spring." },
      { name: "Terracotta", hex: "#c47850", why: "Soft clay warmth at medium value." },
    ],
  },
  {
    id: "true-autumn",
    label: "True autumn",
    undertone: "warm",
    value: "medium",
    chroma: "muted",
    primary: "warm",
    secondaryAspect: "muted",
    summary: "Warm · medium-dark · muted. Spice, not ice.",
    colors: [
      { name: "Rust", hex: "#a84828", why: "Yellow-based warm red — spice, not winter true red." },
      { name: "Terracotta", hex: "#b86840", why: "Muted clay warmth at a medium-dark value." },
      { name: "Mustard", hex: "#b89420", why: "Deep warm yellow with grey in it." },
      { name: "Aubergine", hex: "#6a3a4a", why: "Warm muted purple depth without cool winter contrast." },
    ],
  },
  {
    id: "dark-autumn",
    label: "Dark autumn",
    undertone: "warm",
    value: "dark",
    chroma: "muted",
    primary: "dark",
    secondaryAspect: "warm",
    summary: "Warm · dark · muted. Depth first, then gold.",
    colors: [
      { name: "Aubergine", hex: "#4a2838", why: "Dark warm purple — depth with undertone, not icy black." },
      { name: "Rust", hex: "#8a3a22", why: "Deep muted spice that won’t bleach a dark complexion." },
      { name: "Olive", hex: "#4a4e28", why: "Dark yellow-green kept muted and warm." },
      { name: "Mustard", hex: "#a88828", why: "A lighter warm accent for contrast without icy white." },
    ],
  },
  {
    id: "dark-winter",
    label: "Dark winter",
    undertone: "cool",
    value: "dark",
    chroma: "bright",
    primary: "dark",
    secondaryAspect: "cool",
    summary: "Cool · dark · clear. High contrast, icy depth.",
    colors: [
      { name: "Fuchsia", hex: "#d01070", why: "Cool clear magenta — high chroma at a dark winter value." },
      { name: "Emerald", hex: "#0a8a58", why: "Clear cool green depth; not muted autumn olive." },
      { name: "Icy pink", hex: "#f0b8d0", why: "Light cool tint for winter contrast — never warm cream." },
      { name: "Black", hex: "#111111", why: "Dark + cool + clear — one black max when contrast is already high." },
    ],
  },
  {
    id: "true-winter",
    label: "True winter",
    undertone: "cool",
    value: "dark",
    chroma: "bright",
    primary: "cool",
    secondaryAspect: "bright",
    summary: "Cool · dark · clear. Blue-based, high contrast.",
    colors: [
      { name: "True red", hex: "#c41028", why: "Cool clear red — blue-based, not warm tomato." },
      { name: "Emerald", hex: "#00885a", why: "Saturated cool green that keeps winter chroma sharp." },
      { name: "Icy pink", hex: "#f2c4d8", why: "Crisp cool light that won’t mute the palette." },
      { name: "Electric cobalt", hex: "#1a4fd0", why: "Clear blue undertone at wearable winter depth." },
    ],
  },
  {
    id: "bright-winter",
    label: "Bright winter",
    undertone: "cool",
    value: "medium",
    chroma: "bright",
    primary: "bright",
    secondaryAspect: "cool",
    summary: "Cool · medium · very clear. Pigment first.",
    colors: [
      { name: "Fuchsia", hex: "#e01888", why: "Electric cool magenta — chroma is the match." },
      { name: "True red", hex: "#e01030", why: "High-chroma cool red against clear coloring." },
      { name: "Emerald", hex: "#00a86a", why: "Bright cool green; muted stone would grey this face." },
      { name: "Electric cobalt", hex: "#2050f0", why: "Clear saturated blue — pigment first, not soft summer periwinkle." },
    ],
  },
];

const GUIDE_BY_ID = Object.fromEntries(SEASON_GUIDES.map((guide) => [guide.id, guide])) as Record<
  SeasonId,
  SeasonGuide
>;

export function guideForSeason(season: SeasonId, fromFace = false): ColorResult {
  const guide = GUIDE_BY_ID[season];
  return {
    undertone: guide.undertone,
    value: guide.value,
    chroma: guide.chroma,
    season,
    summary: guide.summary,
    colors: guide.colors,
    fromFace,
  };
}

function lightness(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function saturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max < 8) return 0;
  return (max - min) / max;
}

export interface FaceSignals {
  warmth: number;
  yellow: number;
  skinL: number;
  hairL: number;
  eyeL: number;
  eyeWarmth: number;
  contrast: number;
  chroma: number;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "").trim();
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

/**
 * Facetune-style axes (from their education + draping UI):
 * - Hue / undertone: warm ↔ cool (skin + hair + eyes)
 * - Value / depth: light ↔ deep (weighted skin + hair)
 * - Chroma / clarity: muted ↔ bright (skin saturation + face contrast)
 * - Face contrast: |skin − hair| (+ eyes) — high wants clear seasons, low wants soft
 * Plus a soft "swatch ring" drape: season palette colors that share undertone and
 * sit near the face's value/chroma score higher (circles of color around the face).
 */
export function signalsToAspects(signals: FaceSignals): {
  undertone: UndertoneId;
  value: ValueId;
  chroma: ChromaId;
} {
  const temp = signals.warmth + 0.3 * signals.yellow + 0.25 * signals.eyeWarmth;
  let undertone: UndertoneId = "neutral";
  if (temp > 12) undertone = "warm";
  else if (temp < -7) undertone = "cool";

  const depth = 0.35 * signals.skinL + 0.45 * signals.hairL + 0.2 * signals.eyeL;
  let value: ValueId = "medium";
  if (depth < 92 || signals.hairL < 58) value = "dark";
  else if (depth > 155 && signals.hairL > 135) value = "light";

  const chromaScore =
    signals.chroma +
    (signals.contrast > 95 ? 0.14 : 0) -
    (signals.contrast < 42 ? 0.1 : 0) +
    (Math.abs(signals.eyeWarmth) > 20 && signals.chroma > 0.18 ? 0.05 : 0);
  const chroma: ChromaId = chromaScore >= 0.2 ? "bright" : "muted";

  return { undertone, value, chroma };
}

function scoreGuide(guide: SeasonGuide, aspects: ReturnType<typeof signalsToAspects>, contrast: number): number {
  let score = 0;
  if (guide.undertone === aspects.undertone) score += 5;
  else if (aspects.undertone === "neutral") score += 2;
  else score -= 4;

  if (guide.value === aspects.value) score += 4;
  else if (
    (guide.value === "medium" && aspects.value !== "medium") ||
    (aspects.value === "medium" && guide.value !== "medium")
  ) {
    score += 1;
  } else score -= 3;

  if (guide.chroma === aspects.chroma) score += 4;
  else score -= 3;

  if (aspects.chroma === "bright" && contrast > 100 && guide.primary === "bright") score += 2;
  if (aspects.chroma === "muted" && contrast < 55 && guide.primary === "muted") score += 2;
  if (aspects.value === "dark" && guide.primary === "dark") score += 3;
  if (aspects.value === "light" && guide.primary === "light") score += 3;
  if (aspects.value === "dark" && guide.value === "light") score -= 4;
  if (aspects.value === "light" && guide.value === "dark") score -= 4;
  if (aspects.value === "dark" && aspects.chroma === "bright" && guide.id.startsWith("dark")) score += 2;
  if (aspects.undertone !== "neutral" && guide.primary === (aspects.undertone === "warm" ? "warm" : "cool")) {
    score += 1;
  }

  return score;
}

/** Soft drape: how season swatches would sit as a ring around the face. */
function drapeScore(
  guide: SeasonGuide,
  skin: { r: number; g: number; b: number; L: number; warmth: number; chroma: number },
  contrast: number
): number {
  let total = 0;
  for (const swatch of guide.colors) {
    const rgb = hexToRgb(swatch.hex);
    const sL = lightness(rgb.r, rgb.g, rgb.b);
    const sWarm = rgb.r - rgb.b;
    const sChroma = saturation(rgb.r, rgb.g, rgb.b);
    // Shared undertone direction with skin
    const warmAlign = Math.sign(sWarm || 1) === Math.sign(skin.warmth || 1) || Math.abs(skin.warmth) < 8;
    total += warmAlign ? 1.2 : -1.4;
    // Value: light seasons shouldn't dunk deep swatches on light faces and vice versa
    const valueGap = Math.abs(sL - skin.L);
    if (valueGap < 35) total += 0.8;
    else if (valueGap > 110 && contrast < 55) total -= 1.1; // low-contrast faces wash out in extreme value jumps
    else if (valueGap > 90 && contrast > 100) total += 0.5; // high contrast can take drama
    // Chroma harmony
    const chromaGap = Math.abs(sChroma - skin.chroma);
    if (chromaGap < 0.15) total += 0.7;
    else if (guide.chroma === "bright" && skin.chroma < 0.14) total -= 0.9;
    else if (guide.chroma === "muted" && skin.chroma > 0.32) total -= 0.7;
  }
  return total / Math.max(1, guide.colors.length);
}

export function analyzeSignals(
  signals: FaceSignals,
  fromFace = true,
  skinRgb?: { r: number; g: number; b: number }
): ColorResult {
  const aspects = signalsToAspects(signals);
  const ranked = SEASON_GUIDES.map((guide) => {
    let score = scoreGuide(guide, aspects, signals.contrast);
    if (skinRgb) {
      score +=
        1.35 *
        drapeScore(guide, {
          r: skinRgb.r,
          g: skinRgb.g,
          b: skinRgb.b,
          L: signals.skinL,
          warmth: signals.warmth,
          chroma: signals.chroma,
        }, signals.contrast);
    }
    return { guide, score };
  }).sort((a, b) => b.score - a.score);

  const primary = ranked[0].guide;
  const secondary = ranked[1] && ranked[1].score >= ranked[0].score - 3 ? ranked[1].guide : undefined;

  const result = guideForSeason(primary.id, fromFace);
  result.undertone = aspects.undertone;
  result.value = aspects.value;
  result.chroma = aspects.chroma;
  result.secondary = secondary?.id;
  result.summary = `${primary.label} · ${aspects.undertone} undertone, ${aspects.value} value, ${aspects.chroma} chroma${
    secondary ? `. Neighbors ${secondary.label.toLowerCase()}` : ""
  }.`;
  return result;
}

function sampleRegion(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): { r: number; g: number; b: number; n: number } {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  const left = Math.floor(width * x0);
  const top = Math.floor(height * y0);
  const right = Math.floor(width * x1);
  const bottom = Math.floor(height * y1);
  for (let y = top; y < bottom; y += 2) {
    for (let x = left; x < right; x += 2) {
      const i = (y * width + x) * 4;
      const red = data[i];
      const green = data[i + 1];
      const blue = data[i + 2];
      const max = Math.max(red, green, blue);
      const min = Math.min(red, green, blue);
      if (max < 28 || min > 248) continue;
      if (green > red + 30 && green > blue + 20) continue;
      r += red;
      g += green;
      b += blue;
      n += 1;
    }
  }
  return { r, g, b, n };
}

function avg(sample: { r: number; g: number; b: number; n: number }, fallback: { r: number; g: number; b: number }) {
  if (!sample.n) return fallback;
  return { r: sample.r / sample.n, g: sample.g / sample.n, b: sample.b / sample.n };
}

export function analyzePixels(r: number, g: number, b: number): ColorResult {
  const skinL = lightness(r, g, b);
  return analyzeSignals(
    {
      warmth: r - b,
      yellow: r + g - 2 * b,
      skinL,
      hairL: Math.max(40, skinL - 30),
      eyeL: Math.max(35, skinL - 45),
      eyeWarmth: (r - b) * 0.5,
      contrast: 40,
      chroma: saturation(r, g, b),
    },
    true,
    { r, g, b }
  );
}

/** Facetune-inspired pass: sample skin, hair, eyes; score 12 seasons + soft swatch drape. */
export async function analyzeFaceDataUrl(dataUrl: string): Promise<ColorResult> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const size = 160;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(guideForSeason("soft-autumn"));
        return;
      }
      ctx.drawImage(image, 0, 0, size, size);
      const { data } = ctx.getImageData(0, 0, size, size);
      // Portrait heuristics (center-weighted selfie): hair band, cheeks, eye band
      const skin = sampleRegion(data, size, size, 0.28, 0.36, 0.72, 0.72);
      const hair = sampleRegion(data, size, size, 0.18, 0.02, 0.82, 0.22);
      const eyes = sampleRegion(data, size, size, 0.3, 0.28, 0.7, 0.4);
      if (!skin.n) {
        resolve(guideForSeason("soft-autumn"));
        return;
      }
      const s = avg(skin, { r: 160, g: 120, b: 100 });
      const h = avg(hair, { r: s.r * 0.55, g: s.g * 0.55, b: s.b * 0.55 });
      const e = avg(eyes, { r: s.r * 0.5, g: s.g * 0.5, b: s.b * 0.55 });
      const skinL = lightness(s.r, s.g, s.b);
      const hairL = lightness(h.r, h.g, h.b);
      const eyeL = lightness(e.r, e.g, e.b);
      const contrast = Math.abs(skinL - hairL) * 0.75 + Math.abs(skinL - eyeL) * 0.25;
      resolve(
        analyzeSignals(
          {
            warmth: s.r - s.b,
            yellow: s.r + s.g - 2 * s.b,
            skinL,
            hairL,
            eyeL,
            eyeWarmth: e.r - e.b,
            contrast,
            chroma: saturation(s.r, s.g, s.b) * 0.7 + saturation(e.r, e.g, e.b) * 0.3,
          },
          true,
          s
        )
      );
    };
    image.onerror = () => resolve(guideForSeason("soft-autumn"));
    image.src = dataUrl;
  });
}

export const SEASON_IDS = SEASON_GUIDES.map((guide) => guide.id);

const SEASON_ALIASES: Record<string, SeasonId> = Object.fromEntries(
  SEASON_GUIDES.flatMap((guide) => {
    const label = guide.label.toLowerCase().replace(/\s+/g, "-");
    const spaced = guide.label.toLowerCase();
    return [
      [guide.id, guide.id],
      [label, guide.id],
      [spaced, guide.id],
      [spaced.replace(" ", "-"), guide.id],
    ];
  })
) as Record<string, SeasonId>;

export function normalizeSeasonId(raw: string | null | undefined): SeasonId | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase().replace(/_/g, "-").replace(/\s+/g, "-");
  return SEASON_ALIASES[key] ?? SEASON_IDS.find((id) => id === key) ?? null;
}

export function packetValue(value?: ValueId | null): "light" | "medium" | "deep" | null {
  if (!value) return null;
  if (value === "dark" || value === "deep") return "deep";
  return value;
}

export function seasonMappedAspects(season: SeasonId): {
  undertone: UndertoneId;
  value: ValueId;
  chroma: ChromaId;
} {
  const guide = GUIDE_BY_ID[season];
  return { undertone: guide.undertone, value: guide.value, chroma: guide.chroma };
}
