import { ScreenHeader } from "@/components/app-shell";
import { FavoriteColorsForm } from "@/components/personalize/favorite-colors-form";
import { pageWrap } from "@/components/marks";
import { isProfileEdit } from "@/lib/profile-edit";
import { readSession } from "@/lib/session";

export default async function FavoriteColorsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; edit?: string }>;
}) {
  const session = await readSession();
  const fromProfile = isProfileEdit(await searchParams);
  return (
    <div className={pageWrap}>
      <ScreenHeader {...(fromProfile ? { closeHref: "/profile" } : { backHref: "/profile" })} />
      <p className="text-[12px] text-black/40">{fromProfile ? "Profile" : "You"}</p>
      <h1 className="mt-2 font-serif text-[32px] leading-tight">Favorite colors</h1>
      <p className="mt-2 text-[14px] leading-6 text-black/50">
        What you like to wear. Season analysis stays on Color — this is not a flattering-skin picker.
      </p>
      <FavoriteColorsForm initial={session?.favColors ?? []} nextHref={fromProfile ? "/profile" : "/profile"} doneLabel={fromProfile ? "Done" : "Save favorites"} />
    </div>
  );
}
