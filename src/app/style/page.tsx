import { LookbookCacheGate } from "@/components/lookbook-cache-gate";
import { LookbookLive } from "@/components/lookbook-live";
import { firstName } from "@/lib/format";
import { generateAccess, isFreeFirstBoard } from "@/lib/freemium";
import { defaultSession } from "@/lib/generate";
import { readSession } from "@/lib/session";
import { utcDayKey } from "@/lib/stylist-budget";
import { activeStylistRequestId, resolveStylistLooks, sessionRequestIds } from "@/lib/stylist";
import { inboxResponse, readInbox } from "@/lib/stylist-inbox";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function StylePage({
  searchParams,
}: {
  searchParams: Promise<{ requestId?: string; quota?: string }>;
}) {
  const session = await readSession();
  const { requestId: queryRequestId, quota } = await searchParams;
  const quotaExhausted =
    quota === "exhausted" ||
    Boolean(session && !session.hasPremium && session.lastFreeGenerateDay === utcDayKey());
  const generateAction: "/generate" | "/regenerate" =
    session?.generated || session?.stylistRequestId ? "/regenerate" : "/generate";

  if (!session?.generated && !queryRequestId && !session?.stylistRequestId) {
    return (
      <LookbookCacheGate
        quotaExhausted={quotaExhausted}
        generateUserKey={session?.generateUserKey}
        generateAccess={generateAccess(session)}
        showStyleCtas
        showProfileCta={!session}
      />
    );
  }

  const activeId = activeStylistRequestId(session, queryRequestId);
  const record = activeId ? await readInbox(activeId) : null;
  const activeRequest = record?.request ?? null;
  const activeLooks = inboxResponse(record);
  const activeIsStyleThisPiece = activeRequest?.generateMode === "styleThisPiece";
  const activeReady = Boolean(activeLooks?.looks.length);
  const activePending = Boolean(activeRequest && !activeReady);

  // styleThisPiece lives on Closet — Style shows prior boards (+ soft link), never collage takeover.
  const pendingStyleThisPiece = activeIsStyleThisPiece
    ? {
        requestId: activeRequest!.requestId,
        closetPieceId: activeRequest!.closetPieceId,
        ready: activeReady,
      }
    : null;

  /** storeFirst / closetFirst pending — keep prior board + Generating badge (never blank). */
  // Lock: if inbox already has looks for activeId, never stick on Generating.
  const pendingGenerate =
    activePending && !activeIsStyleThisPiece && activeId && !activeReady
      ? { requestId: activeId, generateMode: activeRequest?.generateMode }
      : null;

  let payload = activeIsStyleThisPiece ? null : activeLooks;
  if (!payload && session) {
    if (activeIsStyleThisPiece || activePending) {
      const ids = sessionRequestIds(session, queryRequestId);
      for (const id of ids) {
        if (id === activeId) continue;
        const prior = inboxResponse(await readInbox(id));
        if (prior?.looks.length) {
          payload = prior;
          break;
        }
      }
      if (!payload) {
        payload = await resolveStylistLooks(session, null);
        if (payload?.requestId === activeId) payload = null;
      }
    } else {
      payload = await resolveStylistLooks(session, queryRequestId);
    }
  }
  if (!payload && queryRequestId && !activeIsStyleThisPiece) {
    payload = inboxResponse(await readInbox(queryRequestId));
  }

  const displayRecord =
    payload?.requestId && payload.requestId !== activeId
      ? await readInbox(payload.requestId)
      : activeIsStyleThisPiece
        ? payload?.requestId
          ? await readInbox(payload.requestId)
          : null
        : record;
  const requestMeta =
    displayRecord?.request ??
    (activeIsStyleThisPiece ? null : activeRequest) ??
    (queryRequestId ? (await readInbox(queryRequestId))?.request : null);

  const name = firstName(session?.name || "there");
  const sizeLine = session?.path === "quick" && session.size ? ` · sizes ${session.size}` : "";
  const freeBoard = isFreeFirstBoard(requestMeta);
  const access = generateAccess(session ?? defaultSession());

  const allIds = sessionRequestIds(session, queryRequestId);
  // Prefer cookie/session active requestId for hydrate — list it first when pending.
  const requestIds = pendingStyleThisPiece
    ? [
        ...(payload?.requestId ? [payload.requestId] : []),
        ...allIds.filter((id) => id !== payload?.requestId && id !== pendingStyleThisPiece.requestId),
        pendingStyleThisPiece.requestId,
      ]
    : pendingGenerate
      ? [
          pendingGenerate.requestId,
          ...(payload?.requestId && payload.requestId !== pendingGenerate.requestId
            ? [payload.requestId]
            : []),
          ...allIds.filter(
            (id) => id !== pendingGenerate.requestId && id !== payload?.requestId
          ),
        ]
      : activeId
        ? [activeId]
        : allIds;

  return (
    <LookbookLive
      name={name}
      budgetMax={session?.budgetMax ?? 280}
      sizeLine={sizeLine}
      requestIds={requestIds}
      initial={payload}
      cachedHint={!payload}
      generateUserKey={session?.generateUserKey}
      quotaExhausted={quotaExhausted}
      freeBoard={freeBoard}
      generateMode={requestMeta?.generateMode}
      fittingCount={requestMeta?.fittingCount}
      generateAccess={access}
      pendingStyleThisPiece={pendingStyleThisPiece}
      pendingGenerate={pendingGenerate}
      showStyleCtas
      generateAction={generateAction}
      lookVotes={session?.lookFeedback?.map((item) => ({
        lookId: item.lookId,
        vote: item.vote,
        reasons: item.reasons,
        requestId: item.requestId,
      }))}
    />
  );
}
