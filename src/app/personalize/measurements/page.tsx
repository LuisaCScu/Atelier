import { ScreenHeader } from "@/components/app-shell";
import { ShapeField } from "@/components/personalize/shape-field";
import { SizeField } from "@/components/personalize/size-field";
import { TorsoField } from "@/components/personalize/torso-field";
import { isProfileEdit } from "@/lib/profile-edit";
import { readSession } from "@/lib/session";

function MeasureInput({
  name,
  label,
  defaultValue,
  min = 20,
  max = 220,
}: {
  name: string;
  label: string;
  defaultValue?: number;
  min?: number;
  max?: number;
}) {
  return (
    <label className="block">
      <span className="mt-4 block text-[12px] text-black/40">{label}</span>
      <input
        name={name}
        type="number"
        min={min}
        max={max}
        step={0.5}
        defaultValue={defaultValue}
        placeholder="Optional · cm"
        className="mt-2 h-12 w-full rounded-xl border border-black/8 bg-white px-4 text-[15px] outline-none"
      />
    </label>
  );
}

export default async function MeasurementsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; edit?: string }>;
}) {
  const session = await readSession();
  const params = await searchParams;
  const fromProfile = isProfileEdit(params);
  const chestLabel = "Bust circumference";

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[460px] flex-col bg-transparent px-5 py-6">
      <ScreenHeader
        {...(fromProfile ? { closeHref: "/profile" } : { backHref: "/personalize" })}
      />
      <p className="text-[12px] text-black/40">{fromProfile ? "Profile · Shape" : "Optional · before color"}</p>
      <h1 className="mt-2 font-serif text-[32px] leading-tight">Shape</h1>
      <p className="mt-2 text-[14px] text-black/50">
        Optional silhouette cues — skip anytime. Same overall shape + torso as Profile. Soft retail size
        helps shopping; not required to request looks. No body photos.
      </p>
      <form action="/session" method="post" className="mt-8 flex flex-1 flex-col">
        <input type="hidden" name="done_measurements" value="1" />
        <input type="hidden" name="measurementsSet" value="1" />
        <input type="hidden" name="next" value={fromProfile ? "/profile" : "/personalize/color"} />
        <ShapeField defaultValue={session?.shape} />
        <TorsoField defaultValue={session?.torso} />
        <div className="mt-8">
          <SizeField defaultValue={session?.size || ""} />
        </div>

        <fieldset className="mt-8">
          <legend className="text-[12px] tracking-[0.14em] text-black/40 uppercase">Measurements</legend>
          <p className="mt-1 text-[13px] text-black/45">Optional retail fields. Skip any you&apos;d rather not share.</p>
          <MeasureInput name="heightCm" label="Height" min={120} max={230} defaultValue={session?.heightCm} />
          <MeasureInput name="chestCm" label={chestLabel} min={60} max={160} defaultValue={session?.chestCm} />
          <MeasureInput name="waistCm" label="Waist" min={50} max={160} defaultValue={session?.waistCm} />
          <MeasureInput name="hipsCm" label="Hips" min={60} max={180} defaultValue={session?.hipsCm} />
          <MeasureInput name="inseamCm" label="Inseam" min={50} max={110} defaultValue={session?.inseamCm} />
        </fieldset>

        <button
          type="submit"
          className="mt-10 mb-4 flex h-12 w-full items-center justify-center rounded-xl bg-black text-[15px] font-medium text-white"
        >
          {fromProfile ? "Done" : "Continue"}
        </button>
        {!fromProfile ? (
          <p className="mb-6 text-center text-[12px] text-black/40">All of this is optional — continue when ready.</p>
        ) : null}
      </form>
    </div>
  );
}
