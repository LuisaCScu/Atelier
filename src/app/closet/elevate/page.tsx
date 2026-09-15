import { ScreenHeader } from "@/components/app-shell";
import { ctaPrimary, pageWrap } from "@/components/marks";

export default function ElevatePage() {
  return (
    <div className={pageWrap}>
      <ScreenHeader backHref="/closet" title="Elevate" />
      <h1 className="font-serif text-[30px] leading-tight">Elevate is parked.</h1>
      <p className="mt-3 text-[14px] leading-6 text-black/50">
        Buy suggestions from your closet come later. Generate already mixes closet pieces with the store when you have
        at least one item.
      </p>
      <a href="/closet" className={`${ctaPrimary} mt-8`}>
        Back to closet
      </a>
    </div>
  );
}
