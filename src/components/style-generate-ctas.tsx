"use client";

import { StyleGenerateChat } from "@/components/style-generate-chat";
import type { GenerateAccess } from "@/lib/freemium";
import type { OccasionId } from "@/lib/types";

/** Pinned Style-tab Generate — chat (occasion + details) → 4 looks. */
export function StyleGenerateCtas({
  className,
  autoFirstStoreFirst: _autoFirstStoreFirst = false,
  action = "/generate",
  quotaExhausted = false,
  generateAccess,
  generateUserKey,
  defaultOccasion,
  defaultDetails,
}: {
  className?: string;
  /** @deprecated Style chat replaced auto storeFirst so the 1/day cap is not burned without an occasion. */
  autoFirstStoreFirst?: boolean;
  action?: "/generate" | "/regenerate";
  quotaExhausted?: boolean;
  generateAccess?: GenerateAccess;
  generateUserKey?: string | null;
  defaultOccasion?: OccasionId;
  defaultDetails?: string;
}) {
  return (
    <StyleGenerateChat
      className={className}
      action={action}
      quotaExhausted={quotaExhausted}
      generateAccess={generateAccess}
      generateUserKey={generateUserKey}
      defaultOccasion={defaultOccasion}
      defaultDetails={defaultDetails}
    />
  );
}
