"use client";

type SwatchDraft = { name: string; hex: string };

const EMPTY: SwatchDraft = { name: "", hex: "" };

export function ColorSwatchPicker({
  swatches,
  onChange,
}: {
  swatches: SwatchDraft[];
  onChange: (next: SwatchDraft[]) => void;
}) {
  const rows = swatches.length ? swatches : [{ ...EMPTY }, { ...EMPTY }];

  function update(index: number, patch: Partial<SwatchDraft>) {
    const next = rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange(next);
  }

  return (
    <details className="mt-8 rounded-2xl bg-white px-4 py-3">
      <summary className="cursor-pointer text-[13px] font-medium">Add colors that sit well near your face</summary>
      <p className="mt-2 text-[13px] leading-5 text-black/45">
        Optional. Tap <span className="font-medium text-black/70">Pick color</span> to open the color picker — the
        square is a button, not a finished swatch.
      </p>
      <div className="mt-3 space-y-3">
        {rows.map((swatch, index) => {
          const hex = /^#[0-9a-fA-F]{6}$/.test(swatch.hex) ? swatch.hex : "";
          return (
            <div key={index} className="rounded-xl bg-[#f3f3f3] px-3 py-3">
              <div className="flex items-center gap-2">
                <label className="relative flex h-11 shrink-0 items-center gap-2 rounded-xl bg-white px-2.5">
                  <span
                    className="size-7 rounded-md border border-black/10"
                    style={{ backgroundColor: hex || "#e8e8e8" }}
                    aria-hidden
                  />
                  <span className="text-[13px] font-medium whitespace-nowrap">Pick color</span>
                  <input
                    type="color"
                    value={hex || "#c4a574"}
                    onChange={(event) => update(index, { hex: event.target.value })}
                    className="absolute inset-0 cursor-pointer opacity-0"
                    aria-label={`Pick color ${index + 1}`}
                  />
                </label>
                <input
                  value={swatch.name}
                  onChange={(event) => update(index, { name: event.target.value })}
                  placeholder={index === 0 ? "Name, e.g. Ivory" : "Name"}
                  className="h-11 min-w-0 flex-1 rounded-xl bg-white px-3 text-[13px] outline-none"
                />
              </div>
              <p className="mt-1.5 px-1 text-[11px] tracking-wide text-black/35 uppercase">
                {hex || "No color chosen yet"}
              </p>
            </div>
          );
        })}
      </div>
    </details>
  );
}
