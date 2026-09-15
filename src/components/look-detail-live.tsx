"use client";

import { BackArrow } from "@/components/icons";
import { LookBoard } from "@/components/look-board";
import { AffiliateNote } from "@/components/affiliate-note";
import { ShopStub } from "@/components/shop-stub";
import { formatMoney } from "@/lib/format";
import { findCachedLooks } from "@/lib/stylist-client";
import {
  CORE_LOOK_LABEL,
  ELEVATE_ADDS_LABEL,
  LookTotalBar,
} from "@/components/look-totals";
import {
  lookCoreTotal,
  lookCurrency,
  lookElevateTotal,
  lookTotal,
  lookWhyParts,
  STYLIST_DEMO_SHOP,
  type StylistLookV1,
  type StylistPieceV1,
} from "@/lib/stylist-contract";
import { LookFeedback } from "@/components/look-feedback";
import { useEffect, useState } from "react";

type Props = {
  id: string;
  initial: StylistLookV1 | null;
  budgetMin?: number;
  budgetMax?: number;
  backHref?: string;
  requestId?: string;
  fittingLocked?: boolean;
  initialVote?: "like" | "dislike" | "skip";
  initialReasons?: string[];
};

export function LookDetailLive({
  id,
  initial,
  budgetMin = 80,
  budgetMax = 280,
  backHref = "/lookbook",
  requestId,
  fittingLocked: _fittingLocked = false,
  initialVote,
  initialReasons,
}: Props) {
  const [look, setLook] = useState<StylistLookV1 | null>(initial);

  useEffect(() => {
    if (look) return;
    const stored = findCachedLooks();
    const found = stored?.looks.find((entry) => entry.id === id) ?? null;
    if (found) setLook(found);
  }, [id, look]);

  if (!look) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-[460px] flex-col px-5 py-6">
        <a href={backHref} className="mb-4 flex items-center gap-1 text-[15px] text-black">
          <BackArrow className="size-4" />
          Looks
        </a>
        <p className="mt-10 text-[15px] text-black/50">That look isn’t on this device yet. Go back to the lookbook.</p>
      </div>
    );
  }

  const parts = lookWhyParts(look);
  const total = lookTotal(look);
  const currency = lookCurrency(look);
  const money = (value: number) => (currency === "USD" ? formatMoney(value) : `${currency} ${Math.round(value)}`);
  const totalLabel = money(total);
  const core = lookCoreTotal(look);
  const elevate = lookElevateTotal(look);
  const overBudget = total > budgetMax;
  const underBudget = total < budgetMin;
  const coreInBudget = core != null && core <= budgetMax;
  const levelUp = Array.isArray(look.levelUp) ? look.levelUp : [];

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[460px] flex-col pb-16">
      <div className="px-5 pt-6">
        <a href={backHref} className="mb-4 flex items-center gap-1 text-[15px] text-black" aria-label="Back to looks">
          <BackArrow className="size-4" />
          Looks
        </a>
      </div>

      {/* Fittings parked — tiles-only; never surface worn heroes as primary. */}
      <LookBoard look={look} fittingLocked />

      <div className="px-5">
        <p className="mt-5 text-[11px] tracking-[0.16em] text-black/40 uppercase">Shop the look</p>
        <h1 className="mt-1 font-serif text-[28px] leading-tight tracking-tight">{look.title}</h1>
        <div className="mt-4">
          <LookTotalBar look={look} />
        </div>
        {look.formula ? (
          <p className="mt-2 text-[15px] leading-6 text-black/75">{look.formula}</p>
        ) : look.hook ? (
          <p className="mt-2 text-[13px] leading-5 text-black/45">{look.hook}</p>
        ) : null}

        <p className="mt-3 text-[13px] leading-5 text-black/50">
          This look {totalLabel}
          {overBudget ? " — over" : underBudget ? " — under" : " · inside"} your {formatMoney(budgetMin)}–
          {formatMoney(budgetMax)} request.
        </p>

        <section className="mt-5 space-y-3" aria-label="Why this look">
          {parts.fit ? <WhyBlock label="Why the fit" text={parts.fit} /> : null}
          {parts.color ? <WhyBlock label="Why the color" text={parts.color} /> : null}
          {parts.vibe ? <WhyBlock label="Why the vibe" text={parts.vibe} /> : null}
          {!parts.fit && !parts.color && !parts.vibe && look.why ? (
            <WhyBlock label="Why this look" text={look.why} />
          ) : null}
        </section>

        {look.capsuleNote ? (
          <p className="mt-4 text-[13px] leading-5 text-black/50">{look.capsuleNote}</p>
        ) : null}
        <CapsuleExpandMock />

        <LookFeedback
          look={look}
          requestId={requestId}
          initialVote={initialVote}
          initialReasons={initialReasons}
          budgetMax={budgetMax}
        />

        <section className="mt-8">
          <div className="flex items-end justify-between gap-3">
            <h2 className="text-[15px] font-semibold">{CORE_LOOK_LABEL}</h2>
            {core != null ? <p className="text-[15px] font-semibold whitespace-nowrap">{money(core)}</p> : null}
          </div>
          <p className="mt-1 text-[13px] text-black/45">
            {look.pieces.length} pieces
            {coreInBudget ? ` · inside your ${formatMoney(budgetMax)} request` : ""}
          </p>
          <PieceGrid pieces={look.pieces} />
        </section>

        {levelUp.length ? (
          <section className="mt-10 border-t border-black/12 pt-8">
            <div className="flex items-end justify-between gap-3">
              <h2 className="text-[15px] font-semibold">{ELEVATE_ADDS_LABEL}</h2>
              {elevate != null ? <p className="text-[15px] font-semibold whitespace-nowrap">{money(elevate)}</p> : null}
            </div>
            <p className="mt-1 text-[13px] text-black/45">
              Optional extras — may sit over your {formatMoney(budgetMax)} budget.
            </p>
            <div className="mt-3">
              <PieceGrid pieces={levelUp} />
            </div>
          </section>
        ) : null}

        <div className="mt-10">
          <LookTotalBar look={look} />
        </div>

        <AffiliateNote className="mt-6" />
      </div>
    </div>
  );
}

function CapsuleExpandMock() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[13px] text-black/55 underline underline-offset-4"
      >
        Expand this capsule
      </button>
      {open ? (
        <p className="mt-2 rounded-2xl bg-[#efe8dc] px-4 py-3 text-[13px] leading-5 text-black/60">
          Development in progress. Capsule expand is a preview — no checkout.
        </p>
      ) : null}
    </div>
  );
}

function WhyBlock({ label, text }: { label: string; text: string }) {
  return (
    <section className="rounded-2xl bg-white px-4 py-4">
      <p className="text-[11px] tracking-[0.16em] text-black/40 uppercase">{label}</p>
      <p className="mt-2 text-[15px] leading-6 text-black/80">{text}</p>
    </section>
  );
}

/** Shared shoppable piece grid — reused by How to style it row expand. */
export function PieceGrid({ pieces }: { pieces: StylistPieceV1[] }) {
  return (
    <ul className="mt-3 grid grid-cols-2 gap-2.5">
      {pieces.map((piece) => (
        <li key={piece.id} className="overflow-hidden rounded-xl bg-white">
          <div className="aspect-square bg-[#ececec]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={piece.image} alt={piece.name} className="size-full object-cover" />
          </div>
          <div className="px-2.5 pt-2.5 pb-3">
            <p className="text-[10px] tracking-[0.14em] text-black/40 uppercase">{piece.brand}</p>
            <p className="mt-0.5 line-clamp-2 text-[13px] leading-4 font-medium">{piece.name}</p>
            <p className="mt-1 text-[13px] text-black/55">
              {piece.currency === "USD" ? formatMoney(piece.price) : `${piece.currency} ${Math.round(piece.price)}`}
            </p>
            <div className="mt-2.5">
              <ShopStub href={piece.shopUrl || STYLIST_DEMO_SHOP} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
