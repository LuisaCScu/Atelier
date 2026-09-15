import { BrandWord } from "@/components/app-shell";
import { LandingMagazine } from "@/components/landing-magazine";
import { ctaPrimary } from "@/components/marks";
import { isReturningSignedIn } from "@/lib/onboarding";
import { seasonalClash } from "@/lib/seasonal-clash";
import { readSession } from "@/lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  const session = await readSession();
  if (!session) {
    return <FirstRunHome />;
  }

  // Returning signed-in → Style (chat Generate). Lookbook is a saved archive, not home.
  if (isReturningSignedIn(session)) {
    redirect("/style");
  }

  const clash = seasonalClash();
  return (
    <div
      className="mx-auto flex min-h-full w-full max-w-[460px] flex-col"
      style={{ backgroundColor: clash.cream }}
    >
      <div className="h-1 w-full" style={{ backgroundColor: clash.cover }} />
      <div className="flex flex-1 flex-col items-center px-6 pt-10 pb-12 text-center">
        <BrandWord height={52} />
        <h1 className="mt-16 font-serif text-[36px] leading-[1.08] tracking-tight">Finish your profile</h1>
        <p className="mt-4 max-w-[320px] text-[15px] leading-6 text-black/50">
          A few more answers and Atelier can style looks for you.
        </p>
        <a href="/personalize" className={`${ctaPrimary} mt-10`}>
          Continue profile
        </a>
        <a href="/how" className="mt-5 text-[13px] text-black/45">
          What is Atelier
        </a>
      </div>
    </div>
  );
}

function FirstRunHome() {
  return <LandingMagazine />;
}
