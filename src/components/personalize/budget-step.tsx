"use client";

import { ScreenHeader } from "@/components/app-shell";
import { GenerateQuotaNote, quotaMessage, useStylistBudget } from "@/components/generate-quota-note";
import { useState } from "react";

export function BudgetStep({
  budgetMax,
  name,
  generateUserKey,
  requestId,
  quotaExhausted = false,
  fromProfile = false,
}: {
  budgetMax: number;
  name: string;
  generateUserKey?: string | null;
  requestId?: string | null;
  quotaExhausted?: boolean;
  fromProfile?: boolean;
}) {
  const [max, setMax] = useState(() => Math.min(2000, Math.max(80, budgetMax || 250)));
  const budget = useStylistBudget(generateUserKey, requestId);
  const paused = quotaExhausted || Boolean(budget && quotaMessage(budget));

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[460px] flex-col px-5 py-6">
      <ScreenHeader
        {...(fromProfile ? { closeHref: "/profile" } : { backHref: "/personalize/prefs" })}
      />
      <p className="text-[12px] text-black/40">{fromProfile ? "Profile · Budget" : "5 of 5"}</p>
      <h1 className="mt-2 font-serif text-[32px] leading-tight">Budget</h1>
      <p className="mt-2 text-[14px] text-black/50">
        {fromProfile
          ? `Four looks for ${name}, kept inside this range.`
          : `Four looks for ${name}, kept inside this range. Next: a quick tour while your first board starts.`}
      </p>
      <form action="/session" method="post" className="mt-8 flex flex-1 flex-col">
        <input type="hidden" name="path" value="deep" />
        <input type="hidden" name="done_budget" value="1" />
        <input type="hidden" name="budgetMin" value="80" />
        <input type="hidden" name="budgetMax" value={max} />
        <input type="hidden" name="next" value={fromProfile ? "/profile" : "/personalize/ready"} />
        <p className="text-[22px] font-medium">$80 – ${max}</p>
        <input
          type="range"
          min={80}
          max={2000}
          step={20}
          value={max}
          onChange={(event) => setMax(Number(event.target.value))}
          className="mt-4 w-full accent-black"
        />
        <p className="mt-3 text-[13px] text-black/40">Looks stay inside this range. Shop links go to the live catalog.</p>
        <GenerateQuotaNote
          userKey={generateUserKey}
          requestId={requestId}
          forced={quotaExhausted}
        />
        <button
          type="submit"
          disabled={paused}
          className="mt-auto mb-4 flex h-12 w-full items-center justify-center rounded-xl bg-black text-[15px] font-medium text-white disabled:bg-black/30"
        >
          {paused ? "Looks pause until tomorrow" : fromProfile ? "Done" : "Save & continue"}
        </button>
        {!fromProfile ? (
          <p className="mb-4 text-center text-[12px] leading-5 text-black/40">
            Saves your profile. Your first board starts while you take a quick tour.
          </p>
        ) : (
          <p className="mb-4 text-center text-[12px] leading-5 text-black/40">Returns to Profile.</p>
        )}
      </form>
    </div>
  );
}
