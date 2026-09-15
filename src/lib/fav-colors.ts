import type { ColorSwatch } from "./types";

/** Wear favorites — neutrals + full spectrum. Season still maps season-correct shades of picks. */
export const FAV_COLOR_PRESETS: ColorSwatch[] = [
  { name: "Blue", hex: "#3B6EA5" },
  { name: "Navy", hex: "#1e2a4a" },
  { name: "Black", hex: "#111111" },
  { name: "Brown", hex: "#6B4423" },
  { name: "Beige", hex: "#D6C4A8" },
  { name: "Gray", hex: "#7a7a7a" },
  { name: "Yellow", hex: "#E4C56A" },
  { name: "Orange", hex: "#D96B2B" },
  { name: "Red", hex: "#B4232A" },
  { name: "Pink", hex: "#D9A7A0" },
  { name: "Purple", hex: "#7A5C9E" },
  { name: "Green", hex: "#3F6B4F" },
  { name: "Ivory", hex: "#f4f1ea" },
  { name: "Cream", hex: "#e8dcc8" },
  { name: "Camel", hex: "#c4a574" },
  { name: "Chocolate", hex: "#4a3020" },
  { name: "Olive", hex: "#5c6040" },
  { name: "Burgundy", hex: "#6b2430" },
  { name: "Charcoal", hex: "#3a3a3a" },
];

export const FAV_COLOR_CAP = 6;

export function parseFavColors(raw: unknown): ColorSwatch[] {
  if (!Array.isArray(raw)) return [];
  const out: ColorSwatch[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const name = typeof rec.name === "string" ? rec.name.trim() : "";
    const hex = typeof rec.hex === "string" ? rec.hex.trim() : "";
    if (!name || !/^#?[0-9a-fA-F]{3,8}$/.test(hex)) continue;
    const normalized = hex.startsWith("#") ? hex : `#${hex}`;
    if (out.some((entry) => entry.hex.toLowerCase() === normalized.toLowerCase())) continue;
    out.push({ name, hex: normalized });
    if (out.length >= FAV_COLOR_CAP) break;
  }
  return out;
}

export function toggleFavColor(current: ColorSwatch[], preset: ColorSwatch): ColorSwatch[] {
  const exists = current.some((item) => item.hex.toLowerCase() === preset.hex.toLowerCase());
  if (exists) return current.filter((item) => item.hex.toLowerCase() !== preset.hex.toLowerCase());
  if (current.length >= FAV_COLOR_CAP) return current;
  return [...current, preset];
}
