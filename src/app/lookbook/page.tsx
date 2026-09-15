import { AppShell, BrandWord } from "@/components/app-shell";
import { LikedLookbook } from "@/components/liked-lookbook";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LookbookPage({
  searchParams,
}: {
  searchParams: Promise<{ requestId?: string; quota?: string }>;
}) {
  const { requestId: queryRequestId, quota } = await searchParams;

  // Old bookmarks during generate → Style (active board + wait).
  if (queryRequestId || quota === "exhausted") {
    const params = new URLSearchParams();
    if (queryRequestId) params.set("requestId", queryRequestId);
    if (quota) params.set("quota", quota);
    const q = params.toString();
    redirect(q ? `/style?${q}` : "/style");
  }

  // Saved archive always stays here — empty Lookbook is fine. Pending generate lives on Style.

  return (
    <AppShell tab="lookbook">
      <header className="flex items-center justify-center">
        <BrandWord className="text-[20px]" />
      </header>
      <h1 className="mt-7 font-serif text-[32px] leading-tight">Lookbook</h1>
      <p className="mt-2 text-[14px] leading-6 text-black/50">
        Your saved fashion book — Wear and Maybe. Shoppable tiles. Active Style boards live under Style.
      </p>
      <section className="mt-6">
        <LikedLookbook />
      </section>
    </AppShell>
  );
}
