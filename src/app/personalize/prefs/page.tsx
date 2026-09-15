import { ScreenHeader } from "@/components/app-shell";
import { ImportantField } from "@/components/personalize/important-field";
import { OccasionGlyph } from "@/components/marks";
import { HARD_NOS, OCCASIONS } from "@/lib/constants";
import { isProfileEdit } from "@/lib/profile-edit";
import { readSession } from "@/lib/session";

export default async function PrefsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; edit?: string }>;
}) {
  const session = await readSession();
  const fromProfile = isProfileEdit(await searchParams);
  const occasions = session?.occasions?.length ? session.occasions : ["weekend"];

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[460px] flex-col px-5 py-6">
      <ScreenHeader
        {...(fromProfile ? { closeHref: "/profile" } : { backHref: "/personalize/styles" })}
      />
      <p className="text-[12px] text-black/40">{fromProfile ? "Profile" : "4 of 5"}</p>
      <h1 className="mt-2 font-serif text-[32px] leading-tight">Occasions & prefs</h1>
      <p className="mt-2 text-[14px] text-black/50">Where it&apos;s for, what to weight, and what to skip.</p>
      <form action="/session" method="post" className="mt-8 flex flex-1 flex-col">
        <input type="hidden" name="done_prefs" value="1" />
        <input type="hidden" name="next" value={fromProfile ? "/profile" : "/personalize/budget"} />
        <p className="text-[11px] tracking-[0.16em] text-black/40 uppercase">Where it&apos;s for</p>
        <div className="mt-3 mb-8 grid grid-cols-3 gap-2">
          {OCCASIONS.map((item) => (
            <label key={item.id} className="cursor-pointer">
              <input
                type="checkbox"
                name="occasion"
                value={item.id}
                defaultChecked={occasions.includes(item.id)}
                className="peer sr-only"
              />
              <span className="flex flex-col items-center gap-1.5 rounded-xl bg-white px-2 py-3 text-[12px] text-black peer-checked:bg-black peer-checked:text-white">
                <OccasionGlyph name={item.icon} className="size-5" />
                {item.label}
              </span>
            </label>
          ))}
        </div>
        <div className="mb-8">
          <ImportantField defaultValue={session?.priorities ?? []} />
        </div>
        <p className="text-[11px] tracking-[0.16em] text-black/40 uppercase">Any hard nos?</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {HARD_NOS.map((item) => (
            <label key={item.id} className="cursor-pointer">
              <input
                type="checkbox"
                name="hardNo"
                value={item.id}
                defaultChecked={session?.hardNos.includes(item.id)}
                className="peer sr-only"
              />
              <span className="flex h-10 items-center rounded-full bg-white px-4 text-[13px] peer-checked:bg-black peer-checked:text-white">
                {item.label}
              </span>
            </label>
          ))}
        </div>
        <label className="mt-8 text-[11px] tracking-[0.16em] text-black/40 uppercase">Notes</label>
        <textarea
          name="notes"
          defaultValue={session?.notes}
          rows={4}
          placeholder="City walking shoes. Soft tailoring. Navy over black."
          className="mt-2 rounded-2xl border border-black/8 bg-white px-4 py-3 text-[15px] outline-none"
        />
        <button
          type="submit"
          className="mt-auto mb-4 flex h-12 w-full items-center justify-center rounded-xl bg-black text-[15px] font-medium text-white"
        >
          {fromProfile ? "Done" : "Continue to budget"}
        </button>
      </form>
    </div>
  );
}
