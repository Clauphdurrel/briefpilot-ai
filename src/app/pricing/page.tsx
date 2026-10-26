import Link from "next/link";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { PricingCards } from "@/components/marketing/pricing-preview";
import { billingConfigured } from "@/server/billing/config";
import { marketingMetadata } from "@/lib/marketing-seo";
export const dynamic = "force-dynamic";
export const metadata = marketingMetadata(
  "Tarifs et plans — BriefPilot AI",
  "/pricing",
  "Comparez les plans Free, Pro, Agency et Enterprise de BriefPilot AI. Découvrez les quotas de projets, briefs, backlogs et exports PDF.",
);
export default function PricingPage() {
  return (
    <MarketingShell page="pricing">
      <div className="mk-container">
        <header className="mk-page-hero">
          <p className="mk-eyebrow">UN PLAN ADAPTÉ À VOS PROJETS</p>
          <h1>
            Préparez mieux.
            <br />
            Choisissez votre rythme.
          </h1>
          <p>
            Commencez avec Free. Les paiements Pro et Agency sont disponibles en
            mode Test uniquement : aucun achat réel. Les droits sont confirmés
            par le prestataire après le checkout.
          </p>
        </header>
        <section
          className="mk-subpage-section"
          aria-label="Comparaison des offres"
        >
          <h2 className="sr-only">Les quatre plans BriefPilot AI</h2>
          <PricingCards checkout configured={billingConfigured()} />
          <p className="mk-pricing-disclaimer">
            Les quotas IA et PDF se renouvellent mensuellement ; la capacité de
            projets actifs ne se réinitialise pas. Chaque réponse IA consomme
            une unité, y compris la première question et les appels envoyés au
            fournisseur qui échouent. Pro et Agency incluent l’historique
            complet ; Free donne accès aux deux dernières versions par type de
            document. Les limites techniques de sécurité restent applicables à
            tous les plans.
          </p>
          <p className="mk-pricing-disclaimer">
            Personnalisation documentaire, équipes et support prioritaire :
            capacités prévues, non disponibles dans le MVP. Enterprise est une
            offre à définir, non souscriptible en ligne.{" "}
            <Link href="/dashboard/settings/subscription">
              Consulter mon abonnement
            </Link>
            .
          </p>
        </section>
      </div>
    </MarketingShell>
  );
}
