"use client";

import { GenerateQuotaNote } from "@/components/generate-quota-note";
import { OnceForm } from "@/components/once-form";
import { ctaPrimary } from "@/components/marks";
import { OCCASIONS } from "@/lib/constants";
import type { GenerateAccess } from "@/lib/freemium";
import { inferOccasionId } from "@/lib/style-chat";
import type { OccasionId } from "@/lib/types";
import { cn } from "cn";
import { useMemo, useState } from "react";

/**
 * Style Generate — little chat: occasion + details → 4 looks
 * (1 mostly closet, 2–3 mix, 4 store-only).
 */
export function StyleGenerateChat({
  className,
  action = "/generate",
  quotaExhausted = false,
  generateAccess = "free",
  generateUserKey,
  defaultOccasion,
  defaultDetails,
}: {
  className?: string;
  action?: "/generate" | "/regenerate";
  quotaExhausted?: boolean;
  generateAccess?: GenerateAccess;
  generateUserKey?: string | null;
  defaultOccasion?: OccasionId;
  defaultDetails?: string;
}) {
  const [occasion, setOccasion] = useState<OccasionId | "">(defaultOccasion ?? "");
  const [details, setDetails] = useState(defaultDetails ?? "");
  const paused = quotaExhausted && generateAccess !== "premium";
  const inferred = useMemo(() => (details.trim() ? inferOccasionId(details) : null), [details]);
  const resolvedOccasion = occasion || inferred || "weekend";
  const canSubmit = Boolean(occasion || details.trim()) && !paused;

  return (
    <div className={cn("rounded-3xl bg-white px-4 py-4", className)}>
      <p className="text-[11px] tracking-[0.16em] text-black/40 uppercase">Atelier</p>
      <p className="mt-1 font-serif text-[22px] leading-tight tracking-tight">What are you dressing for?</p>
      <p className="mt-1.5 text-[13px] leading-5 text-black/50">
        Occasion plus any details — I’ll make 4 looks. One from your closet, two mixed, one from the store.
      </p>

      <OnceForm action={action} generateMode="styleChat" className="mt-4">
        <input type="hidden" name="occasion" value={resolvedOccasion} />
        <div className="flex flex-wrap gap-1.5">
          {OCCASIONS.map((item) => {
            const active = occasion === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setOccasion((current) => (current === item.id ? "" : item.id))}
                className={cn(
                  "h-8 rounded-full px-3 text-[13px]",
                  active ? "bg-black text-white" : "bg-black/6 text-black/70"
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <label className="mt-3 block">
          <span className="sr-only">Details</span>
          <textarea
            name="occasionNote"
            rows={2}
            maxLength={280}
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            placeholder="Dinner with friends, keep it easy…"
            className="w-full resize-none rounded-2xl border border-black/10 bg-[#f7f7f7] px-3 py-2.5 text-[14px] leading-5 outline-none placeholder:text-black/35 focus:border-black/30"
          />
        </label>
        {paused ? (
          <GenerateQuotaNote
            userKey={generateUserKey}
            forced
            className="mt-3 text-[13px] leading-5 text-black/45"
          />
        ) : (
          <button type="submit" disabled={!canSubmit} className={`${ctaPrimary} mt-3 disabled:opacity-40`}>
            Get 4 looks
          </button>
        )}
      </OnceForm>
      {paused ? null : (
        <p className="mt-2 text-[11px] leading-4 text-black/35">
          Free: 1 generate a day. Closet mix is 1 mostly yours, 2 mixed, 1 store-only.
        </p>
      )}
    </div>
  );
}
