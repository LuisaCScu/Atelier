import { TORSOS } from "@/lib/constants";
import type { TorsoId } from "@/lib/types";
import { sectionLabel } from "@/components/marks";

export function TorsoField({ defaultValue }: { defaultValue?: TorsoId }) {
  return (
    <fieldset className="mt-8">
      <legend className={sectionLabel}>Torso length</legend>
      <p className="mt-1 text-[13px] text-black/45">Where the waist sits. A proportion cue, not a measurement.</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {TORSOS.map((item) => (
          <label key={item.id} className="cursor-pointer">
            <input
              type="radio"
              name="torso"
              value={item.id}
              defaultChecked={(defaultValue ?? "medium") === item.id}
              className="peer sr-only"
            />
            <span className="flex min-h-[96px] flex-col rounded-2xl bg-white px-2.5 py-3 peer-checked:bg-black peer-checked:text-white">
              <span className="text-[13px] font-medium leading-tight">{item.label}</span>
              <span className="mt-1 text-[11px] leading-4 text-current/50">{item.hint}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
