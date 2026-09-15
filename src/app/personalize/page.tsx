import { ScreenHeader } from "@/components/app-shell";
import { ctaPrimary, pageWrap } from "@/components/marks";
import { LOOK_AGES } from "@/lib/appearance";
import { readSession } from "@/lib/session";

export default async function PersonalizePage() {
  const session = await readSession();

  return (
    <div className={pageWrap}>
      <ScreenHeader backHref="/" />
      <p className="text-[12px] text-black/40">1 of 5</p>
      <h1 className="mt-2 font-serif text-[34px] leading-tight tracking-tight">About you</h1>
      <p className="mt-3 text-[15px] leading-6 text-black/50">
        A short quiz — who we&apos;re dressing, optional shape, color, a few likes, then budget. No body photos.
      </p>
      <form action="/session" method="post" className="mt-8">
        <input type="hidden" name="path" value="deep" />
        <input type="hidden" name="reset_styles" value="1" />
        <input type="hidden" name="next" value="/personalize/measurements" />
        <label className="text-[12px] text-black/40">Your name</label>
        <input
          name="name"
          defaultValue={session?.name && session.name !== "Alex" ? session.name : ""}
          placeholder="First name"
          required
          className="mt-2 mb-6 h-12 w-full rounded-xl bg-white px-4 text-[15px] outline-none"
        />
        <p className="text-[12px] text-black/40">Look age</p>
        <p className="mt-1 text-[13px] leading-5 text-black/45">
          How heroes should read — not a birthday. Stylist uses this as <span className="font-medium text-black/60">lookAge</span>.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {LOOK_AGES.map((item) => (
            <label key={item.id} className="cursor-pointer">
              <input
                type="radio"
                name="lookAge"
                value={item.id}
                defaultChecked={session?.lookAge === item.id}
                required
                className="peer sr-only"
              />
              <span className="flex flex-col rounded-2xl bg-white px-3 py-2.5 peer-checked:bg-black peer-checked:text-white">
                <span className="text-[13px] font-medium">{item.label}</span>
                <span className="mt-0.5 text-[11px] opacity-60">{item.hint}</span>
              </span>
            </label>
          ))}
        </div>
        <button type="submit" className={`${ctaPrimary} mt-8`}>
          Continue
        </button>
      </form>
    </div>
  );
}
