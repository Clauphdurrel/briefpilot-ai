import Link from "next/link";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { marketingConfig } from "@/config/marketing";
import { marketingMetadata } from "@/lib/marketing-seo";
export const metadata = {
  ...marketingMetadata("Contact — BriefPilot AI", "/contact"),
  robots: { index: false, follow: false },
};
export default function ContactPage() {
  const { contactEmail } = marketingConfig();
  return (
    <MarketingShell page="contact">
      <div className="mk-container">
        <header className="mk-page-hero">
          <p className="mk-eyebrow">ÉCHANGEONS SUR VOTRE BESOIN</p>
          <h1>Un projet particulier ?</h1>
          <p>
            Les modalités Enterprise et le canal de contact commercial sont en
            cours de préparation.
          </p>
        </header>
        <div className="mk-prose">
          {contactEmail ? (
            <p>
              Vous pouvez nous écrire à{" "}
              <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
            </p>
          ) : (
            <div className="mk-draft-note">
              Aucune adresse de contact publique n’a encore été définie. Cette
              page ne recueille aucun message et aucun devis ne peut être
              demandé en ligne pour le moment.
            </div>
          )}
          <h2>Découvrir le produit en attendant</h2>
          <p>
            <Link href="/features">Explorer les fonctionnalités</Link> ou{" "}
            <Link href="/login">accéder à votre espace</Link>.
          </p>
        </div>
      </div>
    </MarketingShell>
  );
}
