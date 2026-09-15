import { TrustCard, TrustPage } from "@/components/trust-page";
import { ATELIER_CONTACT_EMAIL } from "@/lib/contact";

export const metadata = { title: "Terms · Atelier" };

export default function TermsPage() {
  return (
    <TrustPage
      title="Terms of use"
      lede="Atelier is a digital stylist lookbook. Use it to request outfits and shop the pieces."
    >
      <TrustCard title="The service">
        <p>
          Atelier offers styling suggestions and shoppable lookboards. Looks, prices, and availability can change.
          Retailer stock and product pages are theirs, not ours. The service is provided as-is.
        </p>
      </TrustCard>
      <TrustCard title="Affiliate relationships">
        <p>
          Some shop links are affiliate links. If you buy after clicking, Atelier may earn a commission. That does not
          change the price you pay. See our{" "}
          <a className="underline underline-offset-2" href="/disclosure">
            affiliate disclosure
          </a>
          .
        </p>
      </TrustCard>
      <TrustCard title="Your profile">
        <p>
          You’re responsible for what you upload. Don’t add photos of other people without their OK. We may remove
          content that doesn’t belong here.
        </p>
      </TrustCard>
      <TrustCard title="Intellectual property">
        <p>
          Atelier’s name, lookbook design, and original copy belong to Atelier. Retailer product names, images, and
          trademarks belong to those retailers. Outfit photography may be licensed stock or retailer media used to
          illustrate a look.
        </p>
      </TrustCard>
      <TrustCard title="Contact">
        <p>
          Terms questions:{" "}
          <a className="underline underline-offset-2" href={`mailto:${ATELIER_CONTACT_EMAIL}`}>
            {ATELIER_CONTACT_EMAIL}
          </a>
        </p>
      </TrustCard>
    </TrustPage>
  );
}
