"use client";

export type KnowSeason = "yes" | "no" | "";

export function KnowSeasonFork({
  value,
  onChange,
}: {
  value: KnowSeason;
  onChange: (next: KnowSeason) => void;
}) {
  return (
    <fieldset>
      <legend className="font-serif text-[22px] leading-tight">Do you already know your season?</legend>
      <p className="mt-2 text-[14px] leading-5 text-black/50">
        A named season (True spring, Soft summer…) is enough. If you don’t know it, we’ll ask a few color questions
        instead — not both.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {(
          [
            ["yes", "Yes"],
            ["no", "No"],
          ] as const
        ).map(([id, label]) => {
          const selected = value === id;
          return (
            <label key={id} className="cursor-pointer">
              <input
                type="radio"
                name="knowSeason"
                value={id}
                checked={selected}
                onChange={() => onChange(id)}
                className="peer sr-only"
              />
              <span
                className={`flex h-14 items-center justify-center rounded-2xl border text-[16px] font-medium peer-checked:border-black peer-checked:bg-black peer-checked:text-white ${
                  selected ? "border-black bg-black text-white" : "border-black/15 bg-white"
                }`}
              >
                {label}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
