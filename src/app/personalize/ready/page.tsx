import { PostProfileDemo } from "@/components/post-profile-demo";
import { isReturningSignedIn, shouldAutoFirstStoreFirst } from "@/lib/onboarding";
import { readSession } from "@/lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Lands here right after budget / profile complete.
 * Client: fire first storeFirst in background + spotlight tab tour, then `/style`.
 */
export default async function PersonalizeReadyPage() {
  const session = await readSession();
  if (!session) {
    redirect("/personalize");
  }

  // Returning signed-in never re-see the post-profile demo.
  if (isReturningSignedIn(session) && !shouldAutoFirstStoreFirst(session)) {
    redirect("/lookbook");
  }

  const profileReady = Boolean(
    session.deepDone?.budget || (session.likedStyleIds?.length ?? 0) >= 2
  );
  if (!profileReady) {
    redirect("/personalize");
  }

  // If first board already queued / used, still allow demo once (client key gates);
  // autoGenerate only when first-board semantics still apply.
  const autoGenerate = shouldAutoFirstStoreFirst(session);

  return <PostProfileDemo autoGenerate={autoGenerate} />;
}
