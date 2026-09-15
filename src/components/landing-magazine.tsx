import { LandingLogin } from "@/components/landing-login";
import { CherryMark } from "@/components/marks";
import { seasonalClash, type SeasonalClashId } from "@/lib/seasonal-clash";

const pillPrimary =
  "flex h-12 w-full items-center justify-center rounded-full bg-black text-[13px] font-medium tracking-[0.14em] text-white";

export function LandingMagazine({ clashId }: { clashId?: SeasonalClashId }) {
  const clash = seasonalClash(clashId);
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[460px] flex-col">
      <section
        className="flex min-h-0 flex-[2] flex-col items-center justify-center px-8 py-10 text-center"
        style={{ backgroundColor: clash.cover, color: clash.cream }}
      >
        <CherryMark className="h-[72px] w-[72px]" />
        <p className="mt-5 font-serif text-[40px] leading-none tracking-[0.22em]">ATELIER</p>
        <p className="mt-10 max-w-[280px] font-serif text-[22px] leading-snug">
          <span className="italic">From “I have nothing to wear”</span>
          <br />
          <span className="font-bold">to “Look at me.”</span>
        </p>
        <p className="mt-10 text-[10px] tracking-[0.28em] uppercase">{clash.masthead}</p>
        <p
          className="mt-5 inline-flex max-w-[320px] rounded-full px-4 py-1.5 text-center text-[11px] font-medium leading-snug tracking-[0.04em]"
          style={{ backgroundColor: clash.cream, color: clash.cover }}
        >
          {clash.ticker}
        </p>
      </section>
      <div className="h-3.5 w-full shrink-0" style={{ backgroundColor: clash.accent }} aria-hidden />
      <section
        className="flex flex-[1] flex-col items-center justify-center gap-3 px-7 py-8"
        style={{ backgroundColor: clash.cream }}
      >
        <a href="/personalize" className={pillPrimary}>
          Create a profile
        </a>
        <LandingLogin lookbookHref="/lookbook" createHref="/personalize" />
      </section>
    </div>
  );
}
