"use client";

import { LookBoard } from "@/components/look-board";
import { loadLikedLooks, removeLikedLook, subscribeLikedLooks, type LikedLook } from "@/lib/liked-looks";
import { lookbookCardTitle, type StylistLookV1 } from "@/lib/stylist-contract";
import { useEffect, useMemo, useRef, useState } from "react";

function asLook(item: LikedLook): StylistLookV1 {
  return {
    id: item.lookId,
    title: lookbookCardTitle(item),
    hook: item.hook ?? "",
    why: item.why ?? item.formula ?? item.title,
    formula: item.formula,
    // Fittings parked — do not surface worn heroes; tiles path only.
    heroImage: "",
    fittingImage: "",
    fittingLocked: true,
    pieces: item.pieces,
    levelUp: item.levelUp,
  };
}

function lookHref(item: LikedLook) {
  return `/lookbook/${item.lookId}?requestId=${encodeURIComponent(item.requestId)}`;
}

export function LikedLookbook() {
  const [items, setItems] = useState<LikedLook[] | null>(null);
  const [spotlight, setSpotlight] = useState(0);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    const refresh = () => setItems(loadLikedLooks());
    refresh();
    return subscribeLikedLooks(refresh);
  }, []);

  const ordered = useMemo(() => items ?? [], [items]);

  useEffect(() => {
    if (!ordered.length) {
      setSpotlight(0);
      return;
    }
    setSpotlight((i) => Math.min(i, ordered.length - 1));
  }, [ordered.length]);

  if (items === null) {
    return <p className="mt-3 text-[13px] text-black/40">Loading saved looks…</p>;
  }

  if (!items.length) {
    return (
      <p className="mt-3 text-[14px] leading-6 text-black/50">
        Looks you mark Wear or Maybe land here — pieces and recipe. No removes them. Style boards stay under Style
        until you vote.
      </p>
    );
  }

  const feature = ordered[spotlight] ?? ordered[0];
  const featureTitle = lookbookCardTitle(feature);

  function go(delta: number) {
    setSpotlight((i) => {
      const next = i + delta;
      if (next < 0) return ordered.length - 1;
      if (next >= ordered.length) return 0;
      return next;
    });
  }

  return (
    <div className="mt-4 space-y-8">
      {/* Spotlight — one look at a time, full-width */}
      <section aria-label="Spotlight look">
        <div
          className="overflow-hidden rounded-2xl bg-white"
          onTouchStart={(e) => {
            touchX.current = e.changedTouches[0]?.clientX ?? null;
          }}
          onTouchEnd={(e) => {
            const start = touchX.current;
            touchX.current = null;
            if (start == null) return;
            const end = e.changedTouches[0]?.clientX ?? start;
            const dx = end - start;
            if (Math.abs(dx) < 40) return;
            go(dx < 0 ? 1 : -1);
          }}
        >
          <a href={lookHref(feature)} className="block">
            <LookBoard look={asLook(feature)} fittingLocked />
            <div className="px-4 pb-4 pt-3">
              <p className="font-serif text-[22px] leading-tight">{featureTitle}</p>
              <p className="mt-1 text-[11px] tracking-[0.08em] text-black/35 uppercase">
                {spotlight + 1} / {ordered.length}
                <span className="ml-2 normal-case tracking-normal text-black/30">
                  {feature.vote === "maybe" ? "Maybe" : "Wear"}
                </span>
              </p>
            </div>
          </a>
          <div className="flex items-center justify-between gap-3 px-4 pb-4">
            <button
              type="button"
              onClick={() => go(-1)}
              className="rounded-full border border-black/10 px-3 py-1.5 text-[12px] text-black/55"
              aria-label="Previous look"
            >
              Prev
            </button>
            <div className="flex max-w-[50%] flex-wrap justify-center gap-1.5">
              {ordered.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={`Show look ${index + 1}`}
                  aria-current={index === spotlight}
                  onClick={() => setSpotlight(index)}
                  className={`h-1.5 rounded-full transition-all ${
                    index === spotlight ? "w-5 bg-black/70" : "w-1.5 bg-black/20"
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => go(1)}
              className="rounded-full border border-black/10 px-3 py-1.5 text-[12px] text-black/55"
              aria-label="Next look"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {/* Denser archive grid — pictures first; Wear/Maybe subtle */}
      <section aria-label="Archive">
        <p className="mb-3 text-[11px] tracking-[0.16em] text-black/40 uppercase">Archive</p>
        <div className="grid grid-cols-3 gap-2">
          {ordered.map((item, index) => {
            const title = lookbookCardTitle(item);
            return (
              <article key={item.id} className="overflow-hidden rounded-xl bg-white">
                <a
                  href={lookHref(item)}
                  className="block"
                  onClick={(e) => {
                    // Tap archive tile also stages spotlight without blocking navigation long-press intent.
                    if (index !== spotlight) setSpotlight(index);
                  }}
                >
                  <LookBoard look={asLook(item)} compact fittingLocked />
                  <div className="px-1.5 pb-1.5 pt-1">
                    <p className="line-clamp-2 text-[10px] font-medium leading-[14px] text-black/80">{title}</p>
                    <p className="mt-0.5 text-[9px] text-black/30">{item.vote === "maybe" ? "Maybe" : "Wear"}</p>
                  </div>
                </a>
                <div className="px-1.5 pb-1.5">
                  <button
                    type="button"
                    onClick={() => removeLikedLook(item.requestId, item.lookId)}
                    className="text-[10px] text-black/35 underline underline-offset-2"
                  >
                    Remove
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
