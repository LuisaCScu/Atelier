/**
 * Swap-ready polish image adapter.
 *
 * PROVIDER LOCK: Vercel AI Gateway (Production atelier).
 * Prefer OIDC (`VERCEL_OIDC_TOKEN` via vercel env pull / Vercel runtime).
 * Also accept `AI_GATEWAY_API_KEY` when present.
 *
 * Isolate all provider SDK calls here so the pipeline can swap later
 * without touching photo-add / budget / hang-rack.
 *
 * MODEL LOCK: openai/gpt-image-1 (env CLOSET_FLATLAY_MODEL).
 * Never touches stylist userGenerate / incrementGenerateBudget.
 */
import { generateImage } from "ai";

export const CLOSET_FLATLAY_MODEL_DEFAULT = "openai/gpt-image-1";

export type FlatLayProviderKind = "ai-gateway" | "none";

export function closetFlatLayModel(): string {
  const raw = process.env.CLOSET_FLATLAY_MODEL?.trim();
  // Always keep openai/ prefix for gateway routing unless caller already set a full id.
  if (!raw) return CLOSET_FLATLAY_MODEL_DEFAULT;
  if (raw.includes("/")) return raw;
  return `openai/${raw}`;
}

/** True when Gateway can auth (OIDC on Vercel, or explicit AI_GATEWAY_API_KEY). */
export function detectFlatLayProvider(): FlatLayProviderKind {
  if (process.env.AI_GATEWAY_API_KEY?.trim()) return "ai-gateway";
  if (process.env.VERCEL_OIDC_TOKEN?.trim()) return "ai-gateway";
  // Production atelier on Vercel: Gateway uses platform OIDC (@vercel/oidc)
  // even when AI_GATEWAY_API_KEY is unset. Local/dev without either → none → 503.
  const onVercel = process.env.VERCEL === "1" || process.env.VERCEL === "true";
  if (onVercel && process.env.VERCEL_ENV === "production") return "ai-gateway";
  return "none";
}

export function hasFlatLayImageProvider(): boolean {
  return detectFlatLayProvider() !== "none";
}

export type FlatLayAdapterInput = {
  /** White/cream plate PNG bytes (opaque) — twin of alpha rembg cutout. */
  platePng: Buffer;
  prompt: string;
};

export type FlatLayAdapterOk = {
  ok: true;
  png: Buffer;
  model: string;
  provider: FlatLayProviderKind;
};

export type FlatLayAdapterErr = {
  ok: false;
  code: "no_image_provider" | "polish_failed";
  error: string;
};

/**
 * Call gpt-image via AI Gateway only.
 * Swap body of this function later if provider changes — keep signature stable.
 */
export async function runFlatLayImagePolish(
  input: FlatLayAdapterInput
): Promise<FlatLayAdapterOk | FlatLayAdapterErr> {
  const provider = detectFlatLayProvider();
  if (provider === "none") {
    return { ok: false, code: "no_image_provider", error: "No AI Gateway provider configured" };
  }

  const model = closetFlatLayModel();

  try {
    // Gateway string model id — OIDC or AI_GATEWAY_API_KEY resolved by @ai-sdk/gateway.
    const result = await generateImage({
      model,
      prompt: {
        text: input.prompt,
        images: [input.platePng],
      },
      n: 1,
      providerOptions: {
        openai: { quality: "low" },
      },
    });

    const first = result.images[0];
    if (!first) {
      return { ok: false, code: "polish_failed", error: "No image returned from gateway" };
    }

    const bytes =
      first.uint8Array ??
      (first.base64 ? Buffer.from(first.base64, "base64") : null);
    if (!bytes?.length) {
      return { ok: false, code: "polish_failed", error: "Empty image payload from gateway" };
    }

    return {
      ok: true,
      png: Buffer.from(bytes),
      model,
      provider,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gateway polish failed";
    console.warn(`[closet-flat-lay-adapter] ${message}`);
    return { ok: false, code: "polish_failed", error: message };
  }
}
