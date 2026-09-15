"use client";

import { LookBoard } from "@/components/look-board";
import { loadLikedLooks, subscribeLikedLooks } from "@/lib/liked-looks";
import { selectHomeLookbook, type HomeLookVote } from "@/lib/home-lookbook";
import { loadLookVotes, mergeHomeVotes, subscribeLookVotes } from "@/lib/look-votes";
import { lookbookCardTitle, type StylistResponseV1 } from "@/lib/stylist-contract";
import { useEffect, useMemo, useState } from "react";

export function HomeLookbook({
  board,
  feedback,
  awaiting,
  lookbookHref,
  styleHref,
}: {
  board: StylistResponseV1 | null;
  feedback: HomeLookVote[];
  awaiting: boolean;
  lookbookHref: string;
  /** Generating / active board → Style tab. */
  styleHref?: string;
}) {
  const [liked, setLiked] = useState<ReturnType<typeof loadLikedLooks> | null>(null);
  const [deviceVotes, setDeviceVotes] = useState<HomeLookVote[]>([]);

  useEffect(() => {
    const refresh = () => {
      setLiked(loadLikedLooks());
      setDeviceVotes(loadLookVotes());
    };
    refresh();
    const stopLikes = subscribeLikedLooks(refresh);
    const stopVotes = subscribeLookVotes(refresh);
    return () => {
      stopLikes();
      stopVotes();
    };
  }, []);

  const cards = useMemo(
    () =>
      selectHomeLookbook({
        board,
        feedback: mergeHomeVotes(feedback, deviceVotes),
        liked: liked ?? [],
      }),
    [board, feedback, deviceVotes, liked]
  );

  return (
    <section className="mt-10">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] tracking-[0.16em] text-black/40 uppercase">Lookbook</p>
          <h2 className="mt-1 font-serif text-[26px] leading-tight">Yours</h2>
        </div>
        <a href={lookbookHref} className="text-[13px] text-black/50 underline underline-offset-4">
          Open lookbook
        </a>
      </div>
      <p className="mt-2 text-[13px] leading-5 text-black/45">
        Looks you Wear or Maybe, plus ones you have not voted on yet. No and dismissed leftovers stay off this list.
      </p>

      {liked === null ? (
        <p className="mt-4 text-[13px] text-black/40">Opening your lookbook…</p>
      ) : cards.length ? (
        <div className="-mx-5 mt-5 space-y-6">
          {cards.map((card) => (
            <a
              key={card.key}
              href={`/lookbook/${card.look.id}?requestId=${encodeURIComponent(card.requestId)}`}
              className="block"
            >
              <LookBoard look={{ ...card.look, fittingLocked: true }} fittingLocked />
              <p className="px-5 pt-2 text-[13px] font-medium">{lookbookCardTitle(card.look)}</p>
            </a>
          ))}
        </div>
      ) : awaiting ? (
        <a href={styleHref ?? lookbookHref} className="mt-5 block rounded-2xl bg-white px-5 py-8 text-center">
          <p className="font-serif text-[22px] leading-tight">Generating your looks…</p>
          <p className="mt-2 text-[13px] text-black/45">Almost ready… Style checks automatically — tap to open.</p>
        </a>
      ) : (
        <p className="mt-5 rounded-2xl bg-white px-5 py-8 text-[14px] leading-6 text-black/50">
          Nothing here yet. Style a board, then Wear or Maybe saves a look to your Lookbook. No removes it.
        </p>
      )}
    </section>
  );
}
