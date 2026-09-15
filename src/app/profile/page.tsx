import { AppShell, BrandWord } from "@/components/app-shell";
import { ProfileAvatar } from "@/components/profile-avatar";
import { ctaPrimary, ctaSecondary } from "@/components/marks";
import { appearanceChipLabels, LOOK_AGES, lookAgeLabel } from "@/lib/appearance";
import { DEEP_STEPS, PRIORITIES, SHAPES, TORSOS } from "@/lib/constants";
import { SEASON_GUIDES } from "@/lib/color-analysis";
import { formatMoney } from "@/lib/format";
import { withProfileEdit } from "@/lib/profile-edit";
import { readSession } from "@/lib/session";

export default async function ProfilePage() {
  const session = await readSession();

  if (!session) {
    return (
      <AppShell tab="profile">
        <header className="flex items-center justify-center">
          <BrandWord className="text-[20px]" />
        </header>
        <h1 className="mt-10 font-serif text-[32px]">Profile</h1>
        <p className="mt-3 text-[15px] leading-6 text-black/50">
          No profile yet. Create one from home — a short quiz, then four looks.
        </p>
        <a href="/" className={`${ctaPrimary} mt-8`}>
          Create profile
        </a>
        <a href="/contact" className="mt-4 block text-center text-[13px] text-black/45 underline underline-offset-4">
          Submit a ticket
        </a>
      </AppShell>
    );
  }

  const done = session.deepDone;
  const shapeLabel = SHAPES.find((item) => item.id === session.shape)?.label;
  const torsoLabel = TORSOS.find((item) => item.id === session.torso)?.label;
  const seasonLabel = SEASON_GUIDES.find((item) => item.id === session.season)?.label;
  const priorityLabels = PRIORITIES.filter((item) => session.priorities?.includes(item.id)).map((item) => item.label);

  return (
    <AppShell tab="profile">
      <header className="flex items-center justify-center">
        <BrandWord className="text-[20px]" />
      </header>

      <div className="mt-7 flex items-center gap-4">
        <ProfileAvatar name={session.name} />
        <div className="min-w-0">
          <h1 className="font-serif text-[32px] leading-tight">{session.name || "Profile"}</h1>
          <p className="mt-1 text-[13px] text-black/45">
            {session.path === "deep" ? "Personalize path" : "Quick path"}
            {session.lookAge ? ` · ${lookAgeLabel(session.lookAge)}` : ""}
          </p>
        </div>
      </div>

      <p className="mt-3 text-[13px] text-black/45">
        {shapeLabel ? `${shapeLabel}` : ""}
        {torsoLabel ? ` · ${torsoLabel.toLowerCase()}` : ""}
        {seasonLabel ? ` · ${seasonLabel}` : ""}
        {session.undertone ? ` · ${session.undertone}` : ""}
        {session.value ? ` · ${session.value}` : ""}
        {session.chroma ? ` · ${session.chroma}` : ""}
        {priorityLabels.length ? ` · ${priorityLabels.join(", ")}` : ""}
        {appearanceChipLabels(session.appearance).length
          ? ` · ${appearanceChipLabels(session.appearance).join(", ")}`
          : ""}
        {` · budget ${formatMoney(session.budgetMin)}–${formatMoney(session.budgetMax)}`}
      </p>
      {session.favColors?.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {session.favColors.map((item) => (
            <span key={item.hex} className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px]">
              <span className="size-2.5 rounded-full border border-black/10" style={{ background: item.hex }} />
              {item.name}
            </span>
          ))}
        </div>
      ) : null}

      <form action="/session" method="post" className="mt-6 rounded-2xl bg-white px-4 py-4">
        <input type="hidden" name="next" value="/profile" />
        <label className="text-[12px] text-black/40">Name</label>
        <input
          name="name"
          defaultValue={session.name}
          className="mt-2 h-11 w-full rounded-xl bg-[#f3f3f3] px-3 text-[15px] outline-none"
        />
        <label className="mt-4 block text-[12px] text-black/40">Size</label>
        <input
          name="size"
          defaultValue={session.size}
          className="mt-2 h-11 w-full rounded-xl bg-[#f3f3f3] px-3 text-[15px] outline-none"
        />
        <p className="mt-4 text-[12px] text-black/40">Look age</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {LOOK_AGES.map((item) => (
            <label key={item.id} className="cursor-pointer">
              <input
                type="radio"
                name="lookAge"
                value={item.id}
                defaultChecked={session.lookAge === item.id}
                className="peer sr-only"
              />
              <span className="flex rounded-full bg-[#f3f3f3] px-3 py-1.5 text-[12px] peer-checked:bg-black peer-checked:text-white">
                {item.label}
              </span>
            </label>
          ))}
        </div>
        <button type="submit" className="mt-4 text-[13px] underline underline-offset-4">
          Save
        </button>
      </form>

      <section className="mt-8">
        <h2 className="font-serif text-[22px] leading-tight">Preferences</h2>
        <p className="mt-1 text-[13px] text-black/45">Path depth and prefs. Fill what you skipped.</p>
        <ol className="mt-4 overflow-hidden rounded-2xl bg-white">
          {DEEP_STEPS.map((step, index) => (
            <li key={step.id} className="border-b border-black/6 last:border-b-0">
              <a href={withProfileEdit(step.href)} className="flex items-center justify-between px-4 py-3.5">
                <span className="text-[14px]">
                  {index + 1}. {step.label}
                </span>
                <span className={`size-5 rounded-full border ${done[step.id] ? "border-black bg-black" : "border-black/20"}`} />
              </a>
            </li>
          ))}
          <li>
            <a href={withProfileEdit("/personalize/favorites")} className="flex items-center justify-between px-4 py-3.5">
              <span className="text-[14px]">Favorite colors</span>
              <span className={`size-5 rounded-full border ${session.favColors?.length ? "border-black bg-black" : "border-black/20"}`} />
            </a>
          </li>
          <li className="border-b-0">
            <a href={withProfileEdit("/personalize/measurements")} className="flex items-center justify-between px-4 py-3.5">
              <span className="text-[14px]">Shape (optional)</span>
              <span className={`size-5 rounded-full border ${done.measurements ? "border-black bg-black" : "border-black/20"}`} />
            </a>
          </li>
        </ol>
      </section>

      <section className="mt-8 rounded-2xl bg-white px-4 py-4">
        <h2 className="font-serif text-[20px] leading-tight">Account</h2>
        <p className="mt-1 text-[13px] text-black/45">Password and plan — stubs for beta.</p>
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between rounded-xl bg-[#f3f3f3] px-3 py-3">
            <span className="text-[14px]">Password</span>
            <span className="text-[12px] text-black/40">Coming soon</span>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-[#f3f3f3] px-3 py-3">
            <span className="text-[14px]">Plan</span>
            <span className="text-[12px] text-black/40">
              {session.hasPremium ? "Premium (mock)" : "Free"}
            </span>
          </div>
          {!session.hasPremium ? (
            <a href="/upgrade" className="block text-[13px] text-black/55 underline underline-offset-4">
              Explore Premium
            </a>
          ) : null}
        </div>
      </section>

      <a href="/contact" className={`${ctaSecondary} mt-8`}>
        Submit a ticket
      </a>

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <a href="/" className={`${ctaSecondary} h-11 text-[13px]`}>
          Home
        </a>
        {session.generated ? (
          <a href="/style" className={`${ctaPrimary} h-11 text-[13px]`}>
            Open Style
          </a>
        ) : (
          <a href="/personalize" className={`${ctaPrimary} h-11 text-[13px]`}>
            Continue quiz
          </a>
        )}
      </div>
    </AppShell>
  );
}
