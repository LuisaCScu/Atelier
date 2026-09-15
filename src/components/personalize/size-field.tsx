import { SIZES } from "@/lib/constants";
import { sectionLabel } from "@/components/marks";

export function SizeField({ defaultValue = "" }: { defaultValue?: string }) {
  return (
    <fieldset>
      <legend className={sectionLabel}>Clothing size (optional)</legend>
      <p className="mt-1 text-[13px] text-black/45">What you usually buy — XS–XL. Not a measurement.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {SIZES.map((size) => (
          <label key={size} className="cursor-pointer">
            <input
              type="radio"
              name="size"
              value={size}
              defaultChecked={defaultValue === size}
              className="peer sr-only"
            />
            <span className="flex h-11 min-w-12 items-center justify-center rounded-xl bg-white px-4 text-[14px] peer-checked:bg-black peer-checked:text-white">
              {size}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
