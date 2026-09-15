"use client";

import { GenerateQuotaNote, quotaMessage, useStylistBudget } from "@/components/generate-quota-note";
import { StylePhoto } from "@/components/style-photo";
import { ImportantField } from "@/components/personalize/important-field";
import { SizeField } from "@/components/personalize/size-field";
import { OnceForm } from "@/components/once-form";
import { QuickColorField } from "@/components/personalize/quick-color-field";
import { QuickBudget } from "@/components/quick-budget";
import { representativeStyleCards } from "@/lib/style-cards";
import { OCCASIONS, VIBES } from "@/lib/constants";
import { OccasionGlyph, ctaPrimary, sectionLabel } from "@/components/marks";

export function QuickForm({
  generateUserKey,
  requestId,
  quotaExhausted = false,
}: {
  generateUserKey?: string | null;
  requestId?: string | null;
  quotaExhausted?: boolean;
}) {
  const budget = useStylistBudget(generateUserKey, requestId);
  const paused = quotaExhausted || Boolean(budget && quotaMessage(budget));
  return (
    <OnceForm action="/generate" generateMode="storeFirst" className="atelier-quick flex flex-1 flex-col">
      <input type="hidden" name="path" value="quick" />
      <input type="hidden" name="budgetMin" value="80" />

      <label className={sectionLabel}>Your name</label>
      <input
        name="name"
        defaultValue="Alex"
        className="mt-2 h-12 rounded-xl bg-white px-4 text-[15px] outline-none"
      />

      <div className="mt-8">
        <SizeField />
      </div>

      <div className="mt-8">
        <ImportantField defaultValue={["comfort", "versatility"]} />
      </div>

      <p className={`mt-8 ${sectionLabel}`}>What feels like you</p>
      <p className="mt-1 text-[13px] text-black/45">Curated looks from the style-card bank. Tap the ones you would wear.</p>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        {representativeStyleCards("female", 2).map((card) => (
          <label key={card.id} className="relative cursor-pointer">
            <input type="checkbox" name="likedStyle" value={card.id} className="peer sr-only" />
            <span className="absolute top-2 right-2 z-10 hidden size-6 items-center justify-center rounded-full bg-black text-[11px] text-white peer-checked:flex">
              ✓
            </span>
            <span className="block overflow-hidden rounded-xl bg-white text-left">
              <span className="block aspect-[3/4] bg-[#ececec]">
                <StylePhoto src={card.image} alt={card.alt} />
              </span>
              <span className="block px-2.5 py-2">
                <span className="block text-[11px] leading-4 text-black/50">{card.formulaHint}</span>
              </span>
            </span>
          </label>
        ))}
      </div>

      <p className={`mt-8 ${sectionLabel}`}>Pick your vibe</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {VIBES.map((item) => (
          <label key={item.id} className="cursor-pointer">
            <input
              type="checkbox"
              name="vibe"
              value={item.id}
              defaultChecked={item.id === "minimal"}
              className="peer sr-only"
            />
            <span className="block rounded-full border border-black/20 bg-white px-3.5 py-1.5 text-[13px] peer-checked:border-black peer-checked:bg-black peer-checked:text-white">
              {item.label}
            </span>
          </label>
        ))}
      </div>

      <p className={`mt-8 ${sectionLabel}`}>Where it&apos;s for</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {OCCASIONS.map((item) => (
          <label key={item.id} className="cursor-pointer">
            <input
              type="checkbox"
              name="occasion"
              value={item.id}
              defaultChecked={item.id === "weekend"}
              className="peer sr-only"
            />
            <span className="flex flex-col items-center gap-1.5 rounded-xl bg-white px-2 py-3 text-[12px] text-black peer-checked:bg-black peer-checked:text-white">
              <OccasionGlyph name={item.icon} className="size-5" />
              {item.label}
            </span>
          </label>
        ))}
      </div>

      <QuickBudget />

      <QuickColorField />

      <GenerateQuotaNote userKey={generateUserKey} requestId={requestId} forced={quotaExhausted} />
      <button type="submit" disabled={paused} className={`${ctaPrimary} mt-10 disabled:bg-black/30`}>
        {paused ? "Looks pause until tomorrow" : "Request 4 looks"}
      </button>
      <p className="mt-3 mb-6 text-center text-[12px] leading-5 text-black/40">
        Saves your profile for your stylist. Looks appear in the lookbook when they&apos;re ready.
      </p>
    </OnceForm>
  );
}
