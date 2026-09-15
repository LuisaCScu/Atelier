import { TrustCard, TrustPage } from "@/components/trust-page";
import { ATELIER_CONTACT_EMAIL } from "@/lib/contact";

export const metadata = { title: "Privacy · Atelier" };

export default function PrivacyPage() {
  return (
    <TrustPage
      title="Privacy"
      lede="We use what you share to style you. We don’t sell your personal information."
    >
      <TrustCard title="What we collect">
        <p>
          Your profile (name, color notes, style likes, occasions, budget, optional measurements) lives in a
          cookie on this device so the lookbook can find you. An optional daylight face photo, if you add one, stays in
          this browser — it is not required and is not used as a body photo.
        </p>
        <p>
          When you request looks, a styling packet is saved so a stylist can work. Closet photos you add stay on this
          device (`atelier.closet.v2`) and cutouts may be included on that packet when you generate looks.
        </p>
      </TrustCard>
      <TrustCard title="How we use it">
        <p>
          Photos and profile answers are used to dress you — color, fit, and vibe — and to return shoppable looks. We
          do not sell personal information. We do not scrape your social profiles.
        </p>
      </TrustCard>
      <TrustCard title="Storage">
        <p>
          Profile cookies and on-device closet media stay in your browser. Look requests and finished lookbooks are
          stored so you (and, when needed, our stylist tools) can open them again. You can clear site data in your
          browser to remove the local profile and closet.
        </p>
      </TrustCard>
      <TrustCard title="Contact">
        <p>
          Privacy questions:{" "}
          <a className="underline underline-offset-2" href={`mailto:${ATELIER_CONTACT_EMAIL}`}>
            {ATELIER_CONTACT_EMAIL}
          </a>
        </p>
      </TrustCard>
    </TrustPage>
  );
}
