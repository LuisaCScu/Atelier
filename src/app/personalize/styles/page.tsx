import { ScreenHeader } from "@/components/app-shell";
import { StyleDeck } from "@/components/personalize/style-deck";
import { ctaPrimary, pageWrap } from "@/components/marks";
import { defaultSession } from "@/lib/generate";
import { isProfileEdit } from "@/lib/profile-edit";
import { readSession } from "@/lib/session";
import { filterInputFromSession, selectStyleDeck, styleCardsForGender, SWIPE_DECK_COUNT } from "@/lib/style-cards";

export default async function StylesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; edit?: string }>;
}) {
  const session = (await readSession()) ?? defaultSession();
  const fromProfile = isProfileEdit(await searchParams);
  const pool = styleCardsForGender();
  const deck = selectStyleDeck(filterInputFromSession(session), SWIPE_DECK_COUNT);
  const liked = session.likedStyleIds.filter((id) => deck.some((card) => card.id === id));
  const disliked = (session.dislikedStyleIds ?? []).filter((id) => deck.some((card) => card.id === id));

  return (
    <div className={pageWrap}>
      <ScreenHeader
        {...(fromProfile ? { closeHref: "/profile" } : { backHref: "/personalize/color" })}
      />
      <p className="text-[12px] text-black/40">{fromProfile ? "Profile · Style" : "3 of 5 · Style"}</p>
      <h1 className="mt-2 font-serif text-[32px] leading-tight tracking-tight">Swipe the looks you’d wear</h1>
      {pool.length === 0 ? (
        <>
          <p className="mt-2 text-[14px] leading-6 text-black/50">
            Style cards are not in this bank yet. Color and occasions still go to your stylist.
          </p>
          <form action="/session" method="post" className="mt-8">
            <input type="hidden" name="done_styles" value="1" />
            <input type="hidden" name="next" value={fromProfile ? "/profile" : "/personalize/prefs"} />
            <button type="submit" className={ctaPrimary}>
              {fromProfile ? "Done" : "Continue to extras"}
            </button>
          </form>
        </>
      ) : (
        <>
          <p className="mt-2 text-[13px] leading-5 text-black/45">
            Swipes filtered to your look age — more variety so likes actually teach your stylist. Gut feel — like at least two.
          </p>
          {!session.lookAge && !fromProfile ? (
            <p className="mt-3 rounded-2xl border border-black/8 bg-black/[0.02] px-3 py-2 text-[12px] leading-5 text-black/50">
              No look age yet — deck stays mixed.{" "}
              <a href="/personalize" className="font-medium text-black/70 underline underline-offset-2">
                Pick look age first
              </a>{" "}
              for tighter swipes (optional).
            </p>
          ) : null}
          <StyleDeck
            cards={deck}
            likedIds={liked}
            dislikedIds={disliked}
            fromProfile={fromProfile}
          />
        </>
      )}
    </div>
  );
}
