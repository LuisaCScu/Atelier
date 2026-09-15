"use client";

import { FAV_COLOR_CAP, FAV_COLOR_PRESETS, toggleFavColor } from "@/lib/fav-colors";
import type { ColorSwatch } from "@/lib/types";

export function FavoriteColorsPicker({
  selected,
  onChange,
}: {
  selected: ColorSwatch[];
  onChange: (next: ColorSwatch[]) => void;
}) {
  return (
    <div className="mt-8">
      <p className="text-[11px] tracking-[0.16em] text-black/40 uppercase">Favorite colors</p>
      <p className="mt-1 text-[13px] leading-5 text-black/45">
        Colors you like to wear — not a flattering-near-the-face test. Pick up to {FAV_COLOR_CAP}.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {FAV_COLOR_PRESETS.map((preset) => {
          const on = selected.some((item) => item.hex.toLowerCase() === preset.hex.toLowerCase());
          return (
            <button
              key={preset.hex}
              type="button"
              onClick={() => onChange(toggleFavColor(selected, preset))}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] ${
                on ? "bg-black text-white" : "bg-white text-black"
              }`}
            >
              <span className="size-3.5 rounded-full border border-black/15" style={{ background: preset.hex }} />
              {preset.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function FavoriteColorFields({ selected }: { selected: ColorSwatch[] }) {
  return (
    <>
      <input type="hidden" name="favColorsSet" value="1" />
      {selected.map((item) => (
        <span key={`${item.name}-${item.hex}`}>
          <input type="hidden" name="favName" value={item.name} />
          <input type="hidden" name="favHex" value={item.hex} />
        </span>
      ))}
    </>
  );
}
