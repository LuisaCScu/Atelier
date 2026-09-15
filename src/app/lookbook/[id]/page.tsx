import { LookDetailLive } from "@/components/look-detail-live";
import { isFreeFirstBoard, lookFittingLocked } from "@/lib/freemium";
import { readSession } from "@/lib/session";
import { resolveStylistLooks } from "@/lib/stylist";
import { readInbox } from "@/lib/stylist-inbox";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LookDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ requestId?: string; from?: string }>;
}) {
  const session = await readSession();
  const { requestId, from } = await searchParams;
  if (!session?.generated && !requestId) redirect("/");
  const { id } = await params;
  const payload = session ? await resolveStylistLooks(session, requestId) : null;
  const look = payload?.looks.find((entry) => entry.id === id) ?? null;
  const lookIndex = payload?.looks.findIndex((entry) => entry.id === id) ?? -1;
  const prior = session?.lookFeedback?.find((item) => item.lookId === id);
  const inboxId = payload?.requestId ?? requestId ?? session?.stylistRequestId;
  const record = inboxId ? await readInbox(inboxId) : null;

  return (
    <LookDetailLive
      id={id}
      initial={look}
      budgetMin={session?.budgetMin}
      budgetMax={session?.budgetMax}
      requestId={payload?.requestId ?? requestId ?? session?.stylistRequestId}
      fittingLocked={look && lookIndex >= 0 ? lookFittingLocked(look, lookIndex, record?.request) : false}
      initialVote={prior?.vote}
      initialReasons={prior?.reasons}
      backHref={from === "style" ? "/style" : "/lookbook"}
    />
  );
}
