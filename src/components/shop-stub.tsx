"use client";

import { useState } from "react";

export function ShopStub({ label = "Shop", href = "#demo-stub" }: { label?: string; href?: string }) {
  const [open, setOpen] = useState(false);
  const stub = !href || href === "#demo-stub" || href.startsWith("#");

  if (!stub) {
    return (
      <a
        href={href}
        target="_blank"
        rel="sponsored noopener noreferrer"
        className="flex h-9 w-full items-center justify-center rounded-lg bg-black text-[12px] font-medium text-white"
      >
        {label}
      </a>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          window.setTimeout(() => setOpen(false), 2200);
        }}
        className="h-9 w-full rounded-lg bg-black text-[12px] font-medium text-white"
        data-shop-url={href}
        aria-description="Shop link pending"
      >
        {label}
      </button>
      {open ? (
        <p
          role="status"
          className="fixed inset-x-4 bottom-24 z-40 rounded-xl bg-black px-4 py-3 text-center text-[13px] text-white shadow-lg"
        >
          Shop link isn’t live yet — see our affiliate disclosure.
        </p>
      ) : null}
    </>
  );
}
