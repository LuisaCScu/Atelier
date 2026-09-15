import { TrustCard, TrustPage } from "@/components/trust-page";
import { ATELIER_CONTACT_EMAIL } from "@/lib/contact";

export const metadata = { title: "Contact · Atelier" };

export default function ContactPage() {
  return (
    <TrustPage title="Contact" lede="We’re a small lookbook. Email is the fastest way to reach us.">
      <TrustCard title="Email">
        <p>
          <a className="underline underline-offset-2" href={`mailto:${ATELIER_CONTACT_EMAIL}`}>
            {ATELIER_CONTACT_EMAIL}
          </a>
        </p>
      </TrustCard>
      <TrustCard title="What to write about">
        <p>Styling questions, a look that didn’t land, privacy, or a retailer partnership — send it there.</p>
      </TrustCard>
    </TrustPage>
  );
}
