import { ColorStep } from "@/components/personalize/color-step";
import { isProfileEdit } from "@/lib/profile-edit";
import { readSession } from "@/lib/session";

export default async function ColorPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; edit?: string }>;
}) {
  const session = await readSession();
  const fromProfile = isProfileEdit(await searchParams);
  return (
    <ColorStep
      initialFavs={session?.favColors ?? []}
      initialAppearance={session?.appearance ?? {}}
      fromProfile={fromProfile}
    />
  );
}
