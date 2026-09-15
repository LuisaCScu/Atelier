import type { ProfileSession } from "./types";
import { FITTINGS_PARKED, type StylistLookV1, type StylistRequestV1 } from "./stylist-contract";

export const FREE_FITTING_COUNT = 3;
export const PREMIUM_FITTING_COUNT = 4;

/** Re-export product park flag for UI call sites. */
export { FITTINGS_PARKED };

/** Create is always allowed. `"gated"` kept deprecated/unused for old call sites. */
export type GenerateAccess = "free" | "premium" | "gated";
export type GenerateTier = "free" | "premium";

/** Premium if hasPremium; otherwise free. Never gates create/shop. */
export function generateAccess(
  session?: ProfileSession | null,
  _opts?: { boardReady?: boolean }
): GenerateAccess {
  if (session?.hasPremium) return "premium";
  return "free";
}

export function requestTierFromAccess(access: GenerateAccess): GenerateTier {
  return access === "premium" ? "premium" : "free";
}

export function isFreeFirstBoard(request?: Pick<StylistRequestV1, "freeFirstBoard" | "tier"> | null): boolean {
  if (FITTINGS_PARKED) return false;
  if (!request) return false;
  return request.freeFirstBoard === true;
}

export function lookFittingUrl(look: Pick<StylistLookV1, "heroImage" | "fittingImage">): string {
  if (FITTINGS_PARKED) return "";
  const fitting = typeof look.fittingImage === "string" ? look.fittingImage.trim() : "";
  if (fitting) return fitting;
  return typeof look.heroImage === "string" ? look.heroImage.trim() : "";
}

export function lookHasFitting(look: Pick<StylistLookV1, "heroImage" | "fittingImage" | "fittingLocked">): boolean {
  if (FITTINGS_PARKED) return false;
  if (look.fittingLocked) return false;
  return lookFittingUrl(look).length > 0;
}

/**
 * Fittings parked (2026-09-12): always locked — tiles-only boards sitewide.
 * Legacy: first free board locked look 4; later free boards all locked; premium unlocked.
 */
export function lookFittingLocked(
  look: StylistLookV1,
  index: number,
  request?: Partial<Pick<StylistRequestV1, "freeFirstBoard" | "tier" | "fittingCount" | "generateMode">> | null
): boolean {
  if (FITTINGS_PARKED) return true;
  if (look.fittingLocked === true) return true;
  // How to style it / tiles-only boards: no See-it-on fittings.
  if (request?.generateMode === "styleThisPiece" || request?.fittingCount === 0) return true;
  const freeFirst = isFreeFirstBoard(request);
  if (freeFirst && index === 3) return true;
  if (request?.tier === "free" && !freeFirst) return true;
  return false;
}

export function applyFreeBoardFittings<T extends StylistLookV1>(looks: T[], free: boolean): T[] {
  if (FITTINGS_PARKED) {
    return looks.map((look) => ({ ...look, heroImage: "", fittingImage: "", fittingLocked: true }));
  }
  if (!free) {
    return looks.map((look) => ({ ...look, fittingLocked: look.fittingLocked === true }));
  }
  return looks.map((look, index) => {
    if (index !== 3) return { ...look, fittingLocked: false };
    return { ...look, heroImage: "", fittingImage: "", fittingLocked: true };
  });
}
