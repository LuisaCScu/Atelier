import { stylistKeyAuthorized, unauthorizedStylist } from "@/lib/stylist-auth";
import { corsJson, stylistOptions } from "@/lib/stylist-cors";
import { assertFittingHeroesLive, isTilesOnlyHeroSkip } from "@/lib/hero-ready";
import { FITTINGS_PARKED } from "@/lib/stylist-contract";
import {
  activeStylistRequestId,
  ingestStylistLooks,
  sessionRequestIds,
  sessionStylistStatus,
} from "@/lib/stylist";
import { parseStylistResponse } from "@/lib/stylist-contract";
import { inboxResponse, readInbox } from "@/lib/stylist-inbox";
import { readReadyCookie, writeReadyCookie } from "@/lib/stylist-mirror";
import { buildLookFingerprint, writeLookCache } from "@/lib/look-cache";
import { readSession } from "@/lib/session";

export function OPTIONS() {
  return stylistOptions();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const queryId = url.searchParams.get("requestId");
  const session = await readSession();
  const ids = sessionRequestIds(session, queryId);
  const activeId = activeStylistRequestId(session, queryId);

  if (activeId) {
    const record = await readInbox(activeId);
    const response = inboxResponse(record);
    if (response?.looks.length) {
      await writeReadyCookie(response);
      return corsJson({
        status: "ready",
        request: record?.request ?? null,
        response,
      });
    }
    if (record?.request && !response) {
      return corsJson({
        status: "awaiting_stylist",
        request: record.request,
        response: null,
      });
    }
  }

  for (const id of ids.length ? ids : queryId ? [queryId] : []) {
    if (id === activeId) continue;
    const record = await readInbox(id);
    const response = inboxResponse(record);
    if (response?.looks.length) {
      await writeReadyCookie(response);
      return corsJson({
        status: "ready",
        request: record?.request ?? null,
        response,
      });
    }
  }

  const mirrored = await readReadyCookie();
  if (
    mirrored?.looks.length &&
    (!activeId || mirrored.requestId === activeId) &&
    (!queryId || mirrored.requestId === queryId || ids.includes(mirrored.requestId))
  ) {
    return corsJson({ status: "ready", request: null, response: mirrored });
  }

  if (queryId) {
    const record = await readInbox(queryId);
    const response = inboxResponse(record);
    if (response?.looks.length) {
      await writeReadyCookie(response);
      return corsJson({ status: "ready", request: record?.request ?? null, response });
    }
    if (record?.request) {
      return corsJson({ status: "awaiting_stylist", request: record.request, response: null });
    }
  }

  if (session?.stylistRequestId) {
    return corsJson(await sessionStylistStatus(session, queryId));
  }
  if (!queryId) {
    return corsJson({ status: "empty", request: null, response: null });
  }
  return corsJson({ status: "awaiting_stylist", request: null, response: null });
}

function requestIdFromBody(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const root = body as Record<string, unknown>;
  const raw =
    root.response && typeof root.response === "object" && !Array.isArray(root.response)
      ? (root.response as Record<string, unknown>)
      : root;
  return typeof raw.requestId === "string" && raw.requestId.trim() ? raw.requestId.trim() : null;
}

export async function POST(request: Request) {
  if (!stylistKeyAuthorized(request)) return unauthorizedStylist();
  const body = await request.json().catch(() => null);
  try {
    const requestId = requestIdFromBody(body);
    const inbox = requestId ? await readInbox(requestId) : null;
    const bodyRec =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : null;
    const nested =
      bodyRec?.response && typeof bodyRec.response === "object" && !Array.isArray(bodyRec.response)
        ? (bodyRec.response as Record<string, unknown>)
        : null;
    const bodyLooks = Array.isArray(bodyRec?.looks)
      ? (bodyRec!.looks as Array<{ fittingLocked?: boolean }>)
      : Array.isArray(nested?.looks)
        ? (nested!.looks as Array<{ fittingLocked?: boolean }>)
        : null;
    const allBodyLocked = Boolean(bodyLooks?.length && bodyLooks.every((look) => look?.fittingLocked === true));
    const bodyFittingCount =
      bodyRec?.fittingCount === 0 || nested?.fittingCount === 0
        ? 0
        : undefined;
    const tilesOnly =
      FITTINGS_PARKED ||
      inbox?.request?.generateMode === "styleThisPiece" ||
      inbox?.request?.fittingCount === 0 ||
      bodyFittingCount === 0 ||
      allBodyLocked;
    const parsed = parseStylistResponse(body, { tilesOnly });
    if (!parsed) {
      return corsJson(
        {
          error:
            "Body must be atelier.stylistResponse.v1 with looks[]. Each look needs id, title (or formula/id), pieces[], and why or whyFit/whyColor/whyVibe/formula. Store pieces need shopUrl; closet pieces (photo-/closet-/source closet) may omit shopUrl. Fitting heroImage optional while fittings parked / tiles-only (fittingCount 0 / styleThisPiece).",
        },
        400
      );
    }
    // Tiles-only / parked / all fittingLocked: store ready immediately — NEVER 409 awaiting_heroes.
    const skipHeroes = isTilesOnlyHeroSkip(parsed, { tilesOnly }) || tilesOnly;
    if (!skipHeroes) {
      const heroes = await assertFittingHeroesLive(parsed, { tilesOnly });
      if (!heroes.ok) {
        return corsJson(
          {
            status: "awaiting_heroes",
            error:
              "Fitting heroImage URLs must return HTTP 200 before looks go ready. Host on atelier-assets, then POST again.",
            missing: heroes.missing,
            requestId: parsed.requestId,
          },
          409
        );
      }
    }
    const stored = await ingestStylistLooks(parsed);
    if (!stored) {
      return corsJson({ error: "Inbox ingest failed after hero check." }, 500);
    }
    await writeReadyCookie(stored);

    // Fingerprint look-cache write (tiles-only only).
    try {
      const session = await readSession();
      const req = inbox?.request;
      if (session && req && (FITTINGS_PARKED || req.fittingCount === 0 || tilesOnly)) {
        const fingerprint = buildLookFingerprint({
          session,
          generateMode: req.generateMode,
          closetPieceIds: (req.closet ?? []).map((p) => p.id),
          focusPieceId: req.closetPieceId,
        });
        await writeLookCache({
          fingerprint,
          generateMode: req.generateMode,
          response: stored,
        });
      }
    } catch {
      /* cache write is best-effort */
    }

    return corsJson({ status: "stored", response: stored });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Inbox write failed";
    return corsJson({ error: message }, 500);
  }
}
