import { PostProfileDemo } from "@/components/post-profile-demo";
import { readSession } from "@/lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Lands here right after budget / profile complete.
 * Client: spotlight tab tour, then `/style` for occasion chat (no auto generate — 1/day cap).
 */
export default async function PersonalizeReadyPage() {
  const session = await readSession();
  if (!session) {
    redirect("/personalize");
  }

  if (session.generated || session.stylistRequestId) {
    redirect("/style");
  }

  const profileReady = Boolean(
    session.deepDone?.budget || (session.likedStyleIds?.length ?? 0) >= 2
  );
  if (!profileReady) {
    redirect("/personalize");
  }

  return <PostProfileDemo autoGenerate={false} />;
}
