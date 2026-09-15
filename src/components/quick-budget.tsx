"use client";

import { sectionLabel } from "@/components/marks";
import { useState } from "react";

export function QuickBudget({ defaultValue = 250 }: { defaultValue?: number }) {
  const [budget, setBudget] = useState(() => Math.min(2000, Math.max(80, defaultValue)));

  return (
    <>
      <p className={`mt-8 ${sectionLabel}`}>What&apos;s your budget?</p>
      <p className="mt-2 text-[15px] font-medium">$80 – ${budget}</p>
      <input type="hidden" name="budgetMax" value={budget} />
      <input
        type="range"
        min={80}
        max={2000}
        step={20}
        value={budget}
        onChange={(event) => setBudget(Number(event.target.value))}
        className="mt-3 w-full accent-black"
      />
    </>
  );
}
