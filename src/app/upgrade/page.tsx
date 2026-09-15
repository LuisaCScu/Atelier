import { ScreenHeader } from "@/components/app-shell";
import { PremiumCopy, PremiumUnlockForm } from "@/components/premium-sheet";
import { ctaSecondary, pageWrap } from "@/components/marks";
import { readSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function UpgradePage() {
  const session = await readSession();
  if (session?.hasPremium) redirect("/style");

  return (
    <div className={pageWrap}>
      <ScreenHeader backHref={session?.generated ? "/style" : "/"} title="Premium" />
      <PremiumCopy
        title="More polish, same free tiles."
        body="Atelier is free to style and shop. Boards stay shoppable as piece tiles — formula and price included. Premium is a mock unlock on this device while worn fittings stay parked."
      />
      <div className="mt-8 space-y-2.5">
        <article className="rounded-2xl bg-white px-4 py-4">
          <p className="text-[12px] tracking-[0.14em] text-black/40 uppercase">Free</p>
          <p className="mt-1 text-[17px] font-medium">Style, create, shop</p>
          <p className="mt-1 text-[13px] text-black/45">
            Every board is tiles-first — cutouts, recipe, and shop. No paywall on tiles.
          </p>
        </article>
        <article className="rounded-2xl border border-black/10 bg-white px-4 py-4">
          <p className="text-[12px] tracking-[0.14em] text-black/40 uppercase">Premium</p>
          <p className="mt-1 text-[17px] font-medium">Preview unlock</p>
          <p className="mt-1 text-[13px] text-black/45">
            Mock unlock on this device. No Stripe. Worn fittings are parked for now — Premium does not gate tiles.
          </p>
        </article>
      </div>
      <div className="mt-8">
        <PremiumUnlockForm next="/style" />
      </div>
      <a href={session?.generated ? "/style" : "/"} className={`${ctaSecondary} mt-2.5`}>
        Keep styling free
      </a>
    </div>
  );
}
