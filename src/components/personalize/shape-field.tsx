import { SHAPES } from "@/lib/constants";
import type { ShapeId } from "@/lib/types";
import { sectionLabel } from "@/components/marks";

function ShapeMark({ id }: { id: ShapeId }) {
  if (id === "soft-middle") {
    return <ellipse cx="12" cy="12" rx="7" ry="8.5" />;
  }
  if (id === "broad-shoulder") {
    return <path d="M4 8h16l-3 10H7Z" />;
  }
  if (id === "long-line") {
    return <rect x="8" y="3" width="8" height="18" rx="3" />;
  }
  if (id === "hourglass") {
    return <path d="M6 4h12l-3.5 6L18 20H6l3.5-10Z" />;
  }
  return <circle cx="12" cy="12" r="7" />;
}

export function ShapeField({ defaultValue }: { defaultValue?: ShapeId }) {
  return (
    <fieldset>
      <legend className={sectionLabel}>Overall shape</legend>
      <p className="mt-1 text-[13px] text-black/45">
        A gentle read of proportion — not a body type quiz.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        {SHAPES.map((item) => (
          <label key={item.id} className="cursor-pointer">
            <input
              type="radio"
              name="shape"
              value={item.id}
              defaultChecked={(defaultValue ?? "balanced") === item.id}
              className="peer sr-only"
            />
            <span className="flex min-h-[108px] flex-col rounded-2xl bg-white px-3.5 py-3 peer-checked:bg-black peer-checked:text-white">
              <svg viewBox="0 0 24 24" className="size-7" fill="none" aria-hidden>
                <g stroke="currentColor" strokeWidth="1.4" fill="none">
                  <ShapeMark id={item.id} />
                </g>
              </svg>
              <span className="mt-2 text-[13px] font-medium leading-tight">{item.label}</span>
              <span className="mt-1 text-[11px] leading-4 text-current/50">{item.hint}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
