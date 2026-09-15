import { PRIORITIES } from "@/lib/constants";
import type { PriorityId } from "@/lib/types";
import { sectionLabel } from "@/components/marks";

export function ImportantField({ defaultValue = [] }: { defaultValue?: PriorityId[] }) {
  return (
    <fieldset>
      <legend className={sectionLabel}>What&apos;s important to you</legend>
      <p className="mt-1 text-[13px] text-black/45">Pick a few. We&apos;ll weight the looks toward these.</p>
      <input type="hidden" name="prioritiesSet" value="1" />
      <div className="mt-3 flex flex-wrap gap-2">
        {PRIORITIES.map((item) => (
          <label key={item.id} className="cursor-pointer">
            <input
              type="checkbox"
              name="priority"
              value={item.id}
              defaultChecked={defaultValue.includes(item.id)}
              className="peer sr-only"
            />
            <span className="block rounded-full border border-black/20 bg-white px-3.5 py-1.5 text-[13px] peer-checked:border-black peer-checked:bg-black peer-checked:text-white">
              {item.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
