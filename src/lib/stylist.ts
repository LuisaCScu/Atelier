import {
  budgetExhausted,
  countsTowardUserGenerate,
  incrementGenerateBudget,
  mappedUserKeyForRequest,
  newGenerateUserKey,
  readInflightRequestId,
  readStylistBudget,
  recordBudgetRequestMapping,
  writeInflightRequestId,
  type StylistBudgetSnapshot,
} from "./stylist-budget";
import { deleteInbox, listPendingRequests } from "./stylist-inbox";
import { writeSession } from "./session";
import { localStylistResponse } from "./stylist-local";
import { generateAccess } from "./freemium";
import { hostClosetImagesForStylist } from "./closet-cutout-host";
import {
  buildLookFingerprint,
  readLookCache,
  responseFromLookCache,
  writeLookCache,
} from "./look-cache";
import {
  buildStylistRequest,
  FITTINGS_PARKED,
  parseStylistResponse,
  stylistMode,
  type StylistClosetPieceV1,
  type StylistGenerateModeV1,
  type StylistRequestV1,
  type StylistResponseV1,
} from "./stylist-contract";
import { inboxResponse, readInbox, writeInboxRequest, writeInboxResponse } from "./stylist-inbox";
import { clearReadyCookie, readReadyCookie, writeReadyCookie } from "./stylist-mirror";
import type { ProfileSession } from "./types";

export function sessionRequestIds(session?: ProfileSession | null, extra?: string | null): string[] {
  const ids = [extra, session?.stylistRequestId, ...(session?.stylistRequestIds ?? [])].filter(
    (id): id is string => Boolean(id)
  );
  return [...new Set(ids)];
}

/** Latest request the lookbook should wait on — do not walk older ids while this one is pending. */
export function activeStylistRequestId(session?: ProfileSession | null, extra?: string | null): string | null {
  return extra?.trim() || session?.stylistRequestId || null;
}

/** Ignore a second Generate/Regenerate while the current request is still pending. */
export const PENDING_SINGLE_FLIGHT_MS = 2 * 60 * 1000;

export function lookbookPathAfterRequest(result: {
  request: StylistRequestV1 | null;
  budgetExhausted?: boolean;
  premiumRequired?: boolean;
}): string {
  if (result.premiumRequired) return "/upgrade";
  const req = result.request;
  // How to style it waits on piece detail — never take over Style / Lookbook.
  if (req?.generateMode === "styleThisPiece" && req.closetPieceId) {
    const params = new URLSearchParams();
    if (req.requestId) params.set("styling", req.requestId);
    if (result.budgetExhausted) params.set("quota", "exhausted");
    const query = params.toString();
    return `/closet/${encodeURIComponent(req.closetPieceId)}${query ? `?${query}` : ""}`;
  }
  const params = new URLSearchParams();
  if (req?.requestId) params.set("requestId", req.requestId);
  if (result.budgetExhausted) params.set("quota", "exhausted");
  const query = params.toString();
  // Active generate + board live on Style (four-bucket IA).
  return query ? `/style?${query}` : "/style";
}

/** Active Style board (generating / Wear-Maybe-No). Saved archive is `/lookbook`. */
export function lookbookHref(requestId?: string | null): string {
  const id = requestId?.trim();
  if (id) return `/style?requestId=${encodeURIComponent(id)}`;
  return "/style";
}

export function styleHref(requestId?: string | null): string {
  return lookbookHref(requestId);
}

/** RSC-safe: never write cookies here. Free-board burn happens via POST /api/freemium/mark-free-board. */
export async function rememberFreeBoardIfReady(
  _session: ProfileSession,
  _looks: StylistResponseV1 | null | undefined
): Promise<void> {
  return;
}

export type StylistStatus = "awaiting_stylist" | "ready" | "demo";

/** Do not write cookies from resolveStylistLooks (Server Component). Burn free board via markFreeBoardUsedFromClient / session route. */
export function shouldMarkFreeBoardUsed(
  session: ProfileSession,
  request: StylistRequestV1 | null | undefined
): boolean {
  if (session.hasUsedFreeBoard) return false;
  if (!request || request.freeFirstBoard !== true) return false;
  return true;
}

export async function resolveStylistLooks(
  session: ProfileSession,
  queryRequestId?: string | null
): Promise<StylistResponseV1 | null> {
  const activeId = activeStylistRequestId(session, queryRequestId);
  if (activeId) {
    const record = await readInbox(activeId);
    const ingested = inboxResponse(record);
    if (ingested?.looks.length) {
      return ingested;
    }
    if (record?.request && !ingested) {
      if (stylistMode() === "local") {
        return localStylistResponse(record.request, session);
      }
      // Any pending Generate must not blank Style — fall through to prior looks (optimistic UI).
    }
  }

  const ids = sessionRequestIds(session, queryRequestId);
  for (const id of ids) {
    if (id === activeId) continue;
    const record = await readInbox(id);
    const ingested = inboxResponse(record);
    if (ingested?.looks.length) {
      return ingested;
    }
  }
  const mirrored = await readReadyCookie();
  if (mirrored?.looks.length) {
    const activeRecord = activeId ? await readInbox(activeId) : null;
    const activeIsPending =
      Boolean(activeId) &&
      Boolean(activeRecord?.request) &&
      !inboxResponse(activeRecord)?.looks.length;
    if (activeId && mirrored.requestId !== activeId && !activeIsPending) {
      return null;
    }
    if (
      !queryRequestId ||
      mirrored.requestId === queryRequestId ||
      ids.includes(mirrored.requestId) ||
      activeIsPending
    ) {
      return mirrored;
    }
  }
  if (stylistMode() === "local") {
    const request = buildStylistRequest(session);
    return localStylistResponse(request, session);
  }
  return null;
}

export async function sessionStylistStatus(
  session: ProfileSession,
  queryRequestId?: string | null
): Promise<{
  status: StylistStatus;
  request: StylistRequestV1 | null;
  response: StylistResponseV1 | null;
}> {
  const response = await resolveStylistLooks(session, queryRequestId);
  const record = await readInbox(queryRequestId || session.stylistRequestId);
  if (response?.looks.length) {
    return { status: "ready", request: record?.request ?? null, response };
  }
  if (stylistMode() === "local") {
    const request = record?.request ?? buildStylistRequest(session);
    return { status: "demo", request, response: localStylistResponse(request, session) };
  }
  return { status: "awaiting_stylist", request: record?.request ?? null, response: null };
}

export type RequestStylistResult = {
  request: StylistRequestV1 | null;
  status: "awaiting_stylist" | "demo" | "quota" | "ready";
  response: StylistResponseV1 | null;
  budget: StylistBudgetSnapshot;
  budgetExhausted: boolean;
  /** @deprecated Create is never premium-gated under freemium lock. */
  premiumRequired?: boolean;
  /** True when fingerprint look-cache served ready looks without Stylist wait. */
  cacheHit?: boolean;
};

async function findPendingRequestForUser(
  userKey: string,
  session: ProfileSession,
  now: number,
  opts?: { generateMode?: StylistGenerateModeV1; fingerprint?: string }
): Promise<StylistRequestV1 | null> {
  const inflightId = await readInflightRequestId(userKey);
  const candidateIds = [inflightId, session.stylistRequestId].filter((id): id is string => Boolean(id));

  try {
    const pending = await listPendingRequests();
    for (const record of pending) {
      if (!record.request?.requestId || inboxResponse(record)) continue;
      const mapped = await mappedUserKeyForRequest(record.request.requestId);
      if (mapped !== userKey) continue;
      const updated = Date.parse(record.updatedAt);
      const age = Number.isFinite(updated) ? now - updated : 0;
      if (age < PENDING_SINGLE_FLIGHT_MS) candidateIds.push(record.request.requestId);
    }
  } catch {
    /* inbox list is a backup; inflight + session still apply */
  }

  for (const id of [...new Set(candidateIds)]) {
    const existing = await readInbox(id);
    if (!existing?.request || inboxResponse(existing)) continue;
    if (opts?.generateMode && existing.request.generateMode !== opts.generateMode) continue;
    const updated = Date.parse(existing.updatedAt);
    const age =
      session.stylistRequestId === id && session.stylistRequestedAt
        ? now - session.stylistRequestedAt
        : Number.isFinite(updated)
          ? now - updated
          : 0;
    // Inflight key already expires at 2 minutes; other matches use inbox/session age.
    if (id === inflightId || age < PENDING_SINGLE_FLIGHT_MS) return existing.request;
  }
  return null;
}

/** Delete older pending twins for same user + mode (and fingerprint when known). */
async function supersedePendingTwins(input: {
  userKey: string;
  session: ProfileSession;
  generateMode: StylistGenerateModeV1;
  keepRequestId?: string;
}): Promise<void> {
  const ids = new Set<string>();
  if (input.session.stylistRequestId) ids.add(input.session.stylistRequestId);
  for (const id of input.session.stylistRequestIds ?? []) ids.add(id);
  try {
    const pending = await listPendingRequests();
    for (const record of pending) {
      if (!record.request?.requestId || inboxResponse(record)) continue;
      if (record.request.generateMode !== input.generateMode) continue;
      const mapped = await mappedUserKeyForRequest(record.request.requestId);
      if (mapped && mapped !== input.userKey) continue;
      // Same session list OR mapped to this user.
      if (mapped === input.userKey || ids.has(record.request.requestId)) {
        ids.add(record.request.requestId);
      }
    }
  } catch {
    /* best-effort */
  }
  for (const id of ids) {
    if (input.keepRequestId && id === input.keepRequestId) continue;
    const record = await readInbox(id);
    if (!record?.request || inboxResponse(record)) continue;
    if (record.request.generateMode !== input.generateMode) continue;
    try {
      await deleteInbox(id);
    } catch {
      /* soft-fail */
    }
  }
}

/** Save the profile and the request. The browser does not call Stylist. */
export async function requestStylistLooks(
  session: ProfileSession,
  options?: {
    force?: boolean;
    closet?: StylistClosetPieceV1[];
    generateMode?: StylistGenerateModeV1;
    closetPieceId?: string;
  }
): Promise<RequestStylistResult> {
  const generateUserKey = session.generateUserKey?.trim() || newGenerateUserKey();
  const withKey: ProfileSession = { ...session, generateUserKey };
  const now = Date.now();
  const access = generateAccess(withKey);
  const tier = access === "premium" ? "premium" : "free";

  // Host data: URLs → lasting https before build/Redis (never send megabase64 to Stylist).
  const host = await atelierHost();
  const slimCloset = await hostClosetImagesForStylist(options?.closet, host);

  // Fittings parked → freeFirstBoard false in buildStylistRequest; keep local false so we do not claim a free fittings board.
  const freeFirstBoard = false;
  // Build before quota gate so tiles-only (fittingCount 0 / styleThisPiece) can create at 5/5.
  const draft = buildStylistRequest(
    { ...withKey, stylistRequestId: undefined },
    {
      closet: slimCloset,
      tier,
      freeFirstBoard,
      generateMode: options?.generateMode,
      closetPieceId: options?.closetPieceId,
    }
  );

  const fingerprint = buildLookFingerprint({
    session: withKey,
    generateMode: draft.generateMode,
    closetPieceIds: (draft.closet ?? []).map((p) => p.id),
    focusPieceId: draft.closetPieceId,
  });

  // Fingerprint cache hit → store ready immediately (≤2s perceived), no Stylist pending wait.
  // Never remapping prior boards on force regenerate / re-Create after votes (fingerprint also busts).
  if (!options?.force && (FITTINGS_PARKED || (draft.fittingCount ?? 0) === 0)) {
    const cached = await readLookCache(fingerprint);
    if (cached) {
      const ready = responseFromLookCache(cached, draft.requestId);
      if (ready?.looks.length) {
        await supersedePendingTwins({
          userKey: generateUserKey,
          session,
          generateMode: draft.generateMode,
          keepRequestId: draft.requestId,
        });
        const metersGenerate = countsTowardUserGenerate(draft);
        const budget = await readStylistBudget({ userKey: generateUserKey });
        if (metersGenerate && budgetExhausted(budget)) {
          await writeSession(withKey);
          const existing = session.stylistRequestId ? await readInbox(session.stylistRequestId) : null;
          return {
            request: existing?.request ?? null,
            status: "quota",
            response: inboxResponse(existing),
            budget,
            budgetExhausted: true,
          };
        }
        const next: ProfileSession = {
          ...withKey,
          stylistRequestId: draft.requestId,
          stylistRequestIds: [
            draft.requestId,
            ...(session.stylistRequestIds ?? []).filter((id) => id !== draft.requestId),
          ].slice(0, 8),
          stylistRequestedAt: now,
          generated: true,
          hasUsedFreeBoard: withKey.hasUsedFreeBoard === true,
        };
        await writeInboxRequest(draft);
        await writeInboxResponse(ready);
        await writeReadyCookie(ready);
        await writeInflightRequestId(generateUserKey, draft.requestId);
        if (metersGenerate) {
          await incrementGenerateBudget({ userKey: generateUserKey, requestId: draft.requestId });
        } else {
          await recordBudgetRequestMapping({ userKey: generateUserKey, requestId: draft.requestId });
        }
        await writeSession(next);
        const after = await readStylistBudget({ userKey: generateUserKey });
        return {
          request: draft,
          status: "ready",
          response: ready,
          budget: after,
          budgetExhausted: false,
          cacheHit: true,
        };
      }
    }
  }

  // Single-flight reuse only when not forced and same mode pending exists.
  if (!options?.force) {
    const kept = await findPendingRequestForUser(generateUserKey, session, now, {
      generateMode: draft.generateMode,
      fingerprint,
    });
    if (kept) {
      await writeInflightRequestId(generateUserKey, kept.requestId);
      await writeSession({
        ...withKey,
        generated: true,
        stylistRequestId: kept.requestId,
        stylistRequestedAt: session.stylistRequestedAt ?? now,
        hasUsedFreeBoard: withKey.hasUsedFreeBoard === true,
      });
      return {
        request: kept,
        status: "awaiting_stylist",
        response: null,
        budget: await readStylistBudget({ userKey: generateUserKey }),
        budgetExhausted: false,
      };
    }
  }

  const request = draft;
  const metersGenerate = countsTowardUserGenerate(request);

  const budget = await readStylistBudget({ userKey: generateUserKey });
  if (metersGenerate && budgetExhausted(budget)) {
    await writeSession(withKey);
    const existing = session.stylistRequestId ? await readInbox(session.stylistRequestId) : null;
    return {
      request: existing?.request ?? null,
      status: "quota",
      response: inboxResponse(existing),
      budget,
      budgetExhausted: true,
    };
  }

  // Supersede older pending twins so hydrate does not race empty Generating.
  await supersedePendingTwins({
    userKey: generateUserKey,
    session,
    generateMode: request.generateMode,
    keepRequestId: request.requestId,
  });

  const next: ProfileSession = {
    ...withKey,
    stylistRequestId: request.requestId,
    stylistRequestIds: [request.requestId, ...(session.stylistRequestIds ?? []).filter((id) => id !== request.requestId)].slice(
      0,
      8
    ),
    stylistRequestedAt: now,
    generated: true,
    // Burn free board only when fittings/looks are ready — not at request create.
    hasUsedFreeBoard: withKey.hasUsedFreeBoard === true,
  };
  await writeInboxRequest(request);
  await writeInflightRequestId(generateUserKey, request.requestId);
  if (metersGenerate) {
    await incrementGenerateBudget({ userKey: generateUserKey, requestId: request.requestId });
  } else {
    // Keep request→user mapping for budget UI without burning user/global caps.
    await recordBudgetRequestMapping({ userKey: generateUserKey, requestId: request.requestId });
  }
  await clearReadyCookie();
  await writeSession(next);
  await notifyStyleSite(request);

  const after = await readStylistBudget({ userKey: generateUserKey });
  if (stylistMode() === "local") {
    const response = localStylistResponse(request, next);
    await writeInboxResponse(response);
    try {
      await writeLookCache({
        fingerprint,
        generateMode: request.generateMode,
        response,
      });
    } catch {
      /* optional */
    }
    return {
      request,
      status: "demo",
      response,
      budget: after,
      budgetExhausted: false,
    };
  }
  return { request, status: "awaiting_stylist", response: null, budget: after, budgetExhausted: false };
}

export async function ingestStylistLooks(injected: unknown) {
  const parsed = parseStylistResponse(injected);
  if (!parsed) return null;
  await writeInboxResponse(parsed);
  return parsed;
}

async function atelierHost(): Promise<string> {
  try {
    const { headers } = await import("next/headers");
    const hdrs = await headers();
    const forwarded = hdrs.get("x-forwarded-host") || hdrs.get("host");
    const proto = hdrs.get("x-forwarded-proto") || (process.env.VERCEL ? "https" : "http");
    if (forwarded) return `${proto}://${forwarded.split(",")[0].trim()}`;
  } catch {
    /* not in a request context */
  }
  if (process.env.NEXT_PUBLIC_ATELIER_HOST) return process.env.NEXT_PUBLIC_ATELIER_HOST.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "https://atelier-theta-one.vercel.app";
}

let warnedMissingHandoffKey = false;

/** Wake Flow (handoff owner) when a request is saved. Until the webhook is set, they poll pending. */
async function notifyStyleSite(request: StylistRequestV1) {
  // Create-time wake for Flow. Cron floor is 5m — webhook is the ≤1m path.
  // Webhook URL is owned/configured by Flow — Style Site does not invent it.
  const url =
    process.env.STYLIST_HANDOFF_WEBHOOK_URL ||
    process.env.STYLIST_HANDOFF_URL ||
    process.env.FLOW_HANDOFF_WEBHOOK_URL;
  if (!url) return;

  const key = process.env.STYLIST_INGEST_KEY?.trim();
  if (!key && !warnedMissingHandoffKey) {
    warnedMissingHandoffKey = true;
    console.warn(
      "[handoff-wake] STYLIST_INGEST_KEY missing — wake still fires without Authorization; set the key so Flow accepts Bearer"
    );
  }

  const host = await atelierHost();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(key ? { authorization: `Bearer ${key}` } : {}),
      },
      body: JSON.stringify({ requestId: request.requestId, host }),
      signal: controller.signal,
    });
    // Never log Authorization / the key — status only so lasting can confirm 200.
    console.info("[handoff-wake]", request.requestId, res.status);
  } catch (err) {
    const message = err instanceof Error ? err.message : "wake failed";
    console.warn("[handoff-wake]", request.requestId, "error", message);
    /* Flow can still poll GET /api/stylist/pending */
  } finally {
    clearTimeout(timer);
  }
}
