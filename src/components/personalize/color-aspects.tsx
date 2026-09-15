"use client";

const UNDERTONES = [
  { id: "warm", label: "Warm", hint: "Golden, peach, or olive in the skin" },
  { id: "cool", label: "Cool", hint: "Pink, rose, or blue in the skin" },
  { id: "neutral", label: "Neutral", hint: "A mix — neither strongly gold nor pink" },
] as const;

const VALUES = [
  { id: "light", label: "Light", hint: "Hair and skin stay on the lighter side" },
  { id: "medium", label: "Medium", hint: "A mid depth — not very fair, not very deep" },
  { id: "deep", label: "Deep", hint: "Hair and/or skin read darker overall" },
] as const;

const CHROMAS = [
  { id: "bright", label: "Bright / clear", hint: "Strong, clean colors sit well" },
  { id: "muted", label: "Muted / soft", hint: "Softer, dusty colors sit well" },
] as const;

export function ColorAspects({
  undertone,
  value,
  chroma,
  onUndertone,
  onValue,
  onChroma,
}: {
  undertone: string;
  value: string;
  chroma: string;
  onUndertone: (next: string) => void;
  onValue: (next: string) => void;
  onChroma: (next: string) => void;
}) {
  return (
    <div className="mt-6 space-y-6">
      <AspectGroup
        legend="Undertone"
        name="undertoneUi"
        value={undertone}
        onChange={onUndertone}
        options={UNDERTONES}
      />
      <AspectGroup legend="Value" name="valueUi" value={value} onChange={onValue} options={VALUES} />
      <AspectGroup legend="Chroma" name="chromaUi" value={chroma} onChange={onChroma} options={CHROMAS} />
    </div>
  );
}

function AspectGroup({
  legend,
  name,
  value,
  onChange,
  options,
}: {
  legend: string;
  name: string;
  value: string;
  onChange: (next: string) => void;
  options: ReadonlyArray<{ id: string; label: string; hint: string }>;
}) {
  return (
    <fieldset>
      <legend className="text-[11px] tracking-[0.16em] text-black/40 uppercase">{legend}</legend>
      <div className="mt-2 space-y-2">
        {options.map((item) => {
          const selected = value === item.id;
          return (
            <label key={item.id} className="block cursor-pointer">
              <input
                type="radio"
                name={name}
                value={item.id}
                checked={selected}
                onChange={() => onChange(item.id)}
                className="peer sr-only"
              />
              <span
                className={`block rounded-2xl border px-4 py-3 peer-checked:border-black peer-checked:bg-black peer-checked:text-white ${
                  selected ? "border-black bg-black text-white" : "border-black/12 bg-white"
                }`}
              >
                <span className="block text-[14px] font-medium">{item.label}</span>
                <span className={`mt-0.5 block text-[12px] leading-4 ${selected ? "text-white/65" : "text-black/45"}`}>
                  {item.hint}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
