import { formatMoney } from "@/lib/format";
import {
  lookCoreTotal,
  lookCurrency,
  lookElevateTotal,
  lookTotal,
  type StylistLookV1,
} from "@/lib/stylist-contract";

export const CORE_LOOK_LABEL = "Core look (in budget)";
export const ELEVATE_ADDS_LABEL = "Elevate (optional adds)";
export const LOOK_TOTAL_LABEL = "Look total";

function money(look: StylistLookV1, value: number): string {
  const currency = lookCurrency(look);
  return currency === "USD" ? formatMoney(value) : `${currency} ${Math.round(value)}`;
}

export function lookHasElevate(look: StylistLookV1): boolean {
  return Boolean(look.levelUp?.length) || lookElevateTotal(look) != null;
}

/** Compact three-line totals for lookbook cards. Omits invented amounts. */
export function LookCardTotals({ look, budgetMax }: { look: StylistLookV1; budgetMax?: number }) {
  const core = lookCoreTotal(look);
  const elevate = lookElevateTotal(look);
  const total = lookTotal(look);
  const showElevate = lookHasElevate(look);
  const showSplit = core != null || showElevate;

  if (!showSplit) {
    return <p className="mt-1 text-[13px] text-black/40">{money(look, total)}</p>;
  }

  const coreInBudget = core != null && budgetMax != null && core <= budgetMax;

  return (
    <dl className="mt-2 space-y-1 text-[12px] leading-4">
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-black/50">{CORE_LOOK_LABEL}</dt>
        <dd className="font-medium text-black/80">{core != null ? money(look, core) : null}</dd>
      </div>
      {coreInBudget ? <p className="text-[11px] text-black/40">Inside your {formatMoney(budgetMax)} request</p> : null}
      {showElevate ? (
        <>
          <div className="my-1.5 border-t border-black/10" />
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-black/50">{ELEVATE_ADDS_LABEL}</dt>
            <dd className="font-medium text-black/80">{elevate != null ? money(look, elevate) : null}</dd>
          </div>
        </>
      ) : null}
      <div className="my-1.5 border-t border-black/15" />
      <div className="flex items-baseline justify-between gap-3">
        <dt className="font-semibold text-black">{LOOK_TOTAL_LABEL}</dt>
        <dd className="font-semibold text-black">{money(look, total)}</dd>
      </div>
    </dl>
  );
}

export function LookTotalBar({ look }: { look: StylistLookV1 }) {
  return (
    <p className="flex items-center justify-between gap-3 rounded-xl bg-black px-3.5 py-3 text-white">
      <span className="text-[13px] font-medium text-white/70">{LOOK_TOTAL_LABEL}</span>
      <span className="font-serif text-[22px] leading-none tracking-tight">{money(look, lookTotal(look))}</span>
    </p>
  );
}
