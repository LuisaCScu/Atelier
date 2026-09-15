"use client";

import { ctaPrimary, ctaSecondary } from "@/components/marks";
import { useState, type ReactNode } from "react";

export function PremiumCopy({
  eyebrow = "Premium",
  title = "More polish, same free tiles.",
  body = "Atelier is free to style and shop — every board stays shoppable as tiles. Premium is a preview unlock on this device while fittings stay parked.",
}: {
  eyebrow?: string;
  title?: string;
  body?: string;
}) {
  return (
    <>
      <p className="text-[11px] tracking-[0.16em] text-black/40 uppercase">{eyebrow}</p>
      <h2 className="mt-2 font-serif text-[26px] leading-tight">{title}</h2>
      <p className="mt-3 text-[14px] leading-6 text-black/55">{body}</p>
    </>
  );
}

export function PremiumUnlockForm({
  next = "/style",
  label = "Continue with Premium",
}: {
  next?: string;
  label?: string;
}) {
  const [blocked, setBlocked] = useState(false);

  if (blocked) {
    return (
      <div className="rounded-2xl bg-[#efe8dc] px-4 py-5">
        <p className="text-[15px] font-semibold">Development in progress</p>
        <p className="mt-2 text-[13px] leading-5 text-black/55">
          Payments aren&apos;t live — nothing was charged. This device is unlocked for Premium preview. You can still
          create and shop free without Premium. Worn fittings stay parked for now.
        </p>
        <form action="/premium" method="post" className="mt-4">
          <input type="hidden" name="next" value={next} />
          <button type="submit" className={ctaPrimary}>
            Continue with Premium
          </button>
        </form>
      </div>
    );
  }

  return (
    <button type="button" className={ctaPrimary} onClick={() => setBlocked(true)}>
      {label}
    </button>
  );
}

export function PremiumSheet({
  open,
  onClose,
  next = "/style",
  children,
}: {
  open: boolean;
  onClose: () => void;
  next?: string;
  children?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 px-3 pb-3 pt-16 sm:items-center">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[420px] rounded-3xl bg-white px-5 py-6 shadow-xl">
        {children ?? (
          <>
            <PremiumCopy />
            <div className="mt-6">
              <PremiumUnlockForm next={next} />
            </div>
          </>
        )}
        <button type="button" className={`${ctaSecondary} mt-2.5`} onClick={onClose}>
          Not now
        </button>
      </div>
    </div>
  );
}
