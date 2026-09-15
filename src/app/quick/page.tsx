import { ScreenHeader } from "@/components/app-shell";
import { pageWrap } from "@/components/marks";
import { QuickForm } from "@/components/quick-form";
import { readSession } from "@/lib/session";

export default async function QuickPage({
  searchParams,
}: {
  searchParams: Promise<{ quota?: string }>;
}) {
  const session = await readSession();
  const { quota } = await searchParams;
  return (
    <div className={pageWrap}>
      <ScreenHeader backHref="/" />
      <p className="text-[12px] text-black/40">Quick · 2 steps</p>
      <div className="mt-2 h-px overflow-hidden bg-black/10">
        <div className="h-full w-2/3 bg-black" />
      </div>
      <h1 className="mt-6 font-serif text-[30px] leading-tight tracking-tight">A few likes, then four looks.</h1>
      <div className="mt-6">
        <QuickForm
          generateUserKey={session?.generateUserKey}
          requestId={session?.stylistRequestId}
          quotaExhausted={quota === "exhausted"}
        />
      </div>
    </div>
  );
}
