"use client";

import { SEASON_GUIDES } from "@/lib/color-analysis";

export function SeasonPicker({
  name,
  value,
  onChange,
}: {
  name: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="mt-4 space-y-2">
      {SEASON_GUIDES.map((guide) => {
        const selected = value === guide.id;
        return (
          <label key={guide.id} className="block cursor-pointer">
            <input
              type="radio"
              name={name}
              value={guide.id}
              checked={selected}
              onChange={() => onChange(guide.id)}
              className="peer sr-only"
            />
            <span
              className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 peer-checked:border-black peer-checked:bg-black peer-checked:text-white ${
                selected ? "border-black bg-black text-white" : "border-black/12 bg-white"
              }`}
            >
              <span className="min-w-0">
                <span className="block text-[14px] font-medium">{guide.label}</span>
                <span className={`mt-0.5 block text-[11px] leading-4 ${selected ? "text-white/65" : "text-black/40"}`}>
                  {guide.summary.split(".")[0]}
                </span>
              </span>
              <span className="flex shrink-0 gap-1" aria-hidden>
                {guide.colors.slice(0, 4).map((swatch) => (
                  <span
                    key={`${guide.id}-${swatch.hex}`}
                    title={swatch.name}
                    className={`size-5 rounded-full border ${selected ? "border-white/25" : "border-black/10"}`}
                    style={{ backgroundColor: swatch.hex }}
                  />
                ))}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
