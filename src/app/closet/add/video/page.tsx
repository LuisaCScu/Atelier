import { ScreenHeader } from "@/components/app-shell";
import { ctaPrimary, ctaSecondary, pageWrap } from "@/components/marks";

export default function VideoAddPage() {
  return (
    <div className={pageWrap}>
      <ScreenHeader backHref="/closet" title="Video" />
      <h1 className="font-serif text-[30px] leading-tight">Video is parked.</h1>
      <p className="mt-3 text-[14px] leading-6 text-black/50">
        Rack video → stills comes later. Add a photo or type a piece for now.
      </p>
      <a href="/closet/add/photo" className={`${ctaPrimary} mt-8`}>
        Add a photo
      </a>
      <a href="/closet/add/note" className={`${ctaSecondary} mt-2.5`}>
        Add a note
      </a>
    </div>
  );
}
