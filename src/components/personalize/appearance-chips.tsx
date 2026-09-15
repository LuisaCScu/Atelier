"use client";

import { EYE_COLORS, HAIR_COLORS, HAIR_LENGTHS, SKIN_TONE_BANDS } from "@/lib/appearance";
import type { AppearanceTags, EyeColorId, HairColorId, HairLengthId, SkinToneBandId } from "@/lib/types";

export function AppearanceChips({
  value,
  onChange,
}: {
  value: AppearanceTags;
  onChange: (next: AppearanceTags) => void;
}) {
  return (
    <div className="mt-8">
      <p className="text-[11px] tracking-[0.16em] text-black/40 uppercase">Appearance</p>
      <p className="mt-1 text-[13px] leading-5 text-black/45">
        Guesses from a daylight face if you added one — edit anything. Heroes can honor these tags.
      </p>
      <ChipRow
        label="Hair color"
        options={HAIR_COLORS}
        selected={value.hairColor}
        onSelect={(hairColor) => onChange({ ...value, hairColor: hairColor as HairColorId })}
      />
      <ChipRow
        label="Hair length"
        options={HAIR_LENGTHS}
        selected={value.hairLength}
        onSelect={(hairLength) => onChange({ ...value, hairLength: hairLength as HairLengthId })}
      />
      <ChipRow
        label="Eyes"
        options={EYE_COLORS}
        selected={value.eyes}
        onSelect={(eyes) => onChange({ ...value, eyes: eyes as EyeColorId })}
      />
      <ChipRow
        label="Skin tone"
        options={SKIN_TONE_BANDS}
        selected={value.skinToneBand}
        onSelect={(skinToneBand) => onChange({ ...value, skinToneBand: skinToneBand as SkinToneBandId })}
      />
    </div>
  );
}

export function AppearanceFields({ value }: { value: AppearanceTags }) {
  return (
    <>
      <input type="hidden" name="appearanceSet" value="1" />
      {value.hairColor ? <input type="hidden" name="hairColor" value={value.hairColor} /> : null}
      {value.hairLength ? <input type="hidden" name="hairLength" value={value.hairLength} /> : null}
      {value.eyes ? <input type="hidden" name="eyes" value={value.eyes} /> : null}
      {value.skinToneBand ? <input type="hidden" name="skinToneBand" value={value.skinToneBand} /> : null}
    </>
  );
}

function ChipRow({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: { id: string; label: string }[];
  selected?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="mt-4">
      <p className="text-[12px] text-black/40">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={`rounded-full px-3 py-1.5 text-[12px] ${
              selected === item.id ? "bg-black text-white" : "bg-white"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
