import { ScreenHeader } from "@/components/app-shell";
import { pageWrap } from "@/components/marks";
import type { ReactNode } from "react";

export function TrustPage({
  title,
  lede,
  children,
}: {
  title: string;
  lede?: string;
  children: ReactNode;
}) {
  return (
    <div className={pageWrap}>
      <ScreenHeader backHref="/" />
      <h1 className="font-serif text-[34px] leading-tight tracking-tight">{title}</h1>
      {lede ? <p className="mt-3 text-[15px] leading-6 text-black/55">{lede}</p> : null}
      <div className="mt-8 space-y-6 text-[15px] leading-6 text-black/70">{children}</div>
    </div>
  );
}

export function TrustCard({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white px-5 py-5">
      {title ? <h2 className="text-[16px] font-medium text-black">{title}</h2> : null}
      <div className={title ? "mt-2 space-y-3" : "space-y-3"}>{children}</div>
    </section>
  );
}
