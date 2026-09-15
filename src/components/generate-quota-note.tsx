"use client";

import { useEffect, useState } from "react";

export type BudgetBucket = {
  used: number;
  limit: number;
  remaining: number;
  exhausted: boolean;
};

export type BudgetSnapshot = {
  ok: true;
  globalDaily: BudgetBucket;
  userGenerate: BudgetBucket | null;
};

export function quotaMessage(snapshot: BudgetSnapshot): string | null {
  if (snapshot.globalDaily.exhausted) {
    return "Today’s studio queue is full. New looks open again tomorrow.";
  }
  if (snapshot.userGenerate?.exhausted) {
    return `You’ve used today’s ${snapshot.userGenerate.limit} look requests. More tomorrow.`;
  }
  return null;
}

export function useStylistBudget(userKey?: string | null, requestId?: string | null) {
  const [snapshot, setSnapshot] = useState<BudgetSnapshot | null>(null);

  useEffect(() => {
    const query = new URLSearchParams();
    if (userKey) query.set("userKey", userKey);
    if (requestId) query.set("requestId", requestId);
    const suffix = query.toString();
    void fetch(`/api/stylist/budget${suffix ? `?${suffix}` : ""}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data: BudgetSnapshot) => {
        if (data?.ok && data.globalDaily) setSnapshot(data);
      })
      .catch(() => {
        /* keep generate available if the probe fails */
      });
  }, [userKey, requestId]);

  return snapshot;
}

export function GenerateQuotaNote({
  userKey,
  requestId,
  forced = false,
  className = "mt-3 text-[13px] leading-5 text-black/45",
}: {
  userKey?: string | null;
  requestId?: string | null;
  forced?: boolean;
  className?: string;
}) {
  const snapshot = useStylistBudget(userKey, requestId);
  const live = snapshot ? quotaMessage(snapshot) : null;
  const message = live ?? (forced ? "Look requests are paused for today. Try again tomorrow." : null);
  if (!message) return null;
  return <p className={className}>{message}</p>;
}
