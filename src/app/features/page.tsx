import { MarketingShell } from "@/components/marketing/marketing-shell";
import { FeaturesSection } from "@/components/marketing/content-sections";
import { ProductShowcase } from "@/components/marketing/product-showcase";
import { FinalCta } from "@/components/marketing/final-cta";
import { marketingMetadata } from "@/lib/marketing-seo";
export const metadata = marketingMetadata(
  "Fonctionnalités — BriefPilot AI",
  "/features",
  "Interview IA, analyse des besoins, cahier des charges, backlog et exports : explorez les fonctionnalités de BriefPilot AI pour préparer vos projets.",
);
export default function FeaturesPage() {
  return (
    <MarketingShell page="features">
      <div className="mk-container">
        <header className="mk-page-hero">
          <p className="mk-eyebrow">LES OUTILS DU CADRAGE</p>
          <h1>Du besoin client aux livrables de développement.</h1>
          <p>
            Un logiciel de brief client pour préparer un site web, un projet
            SaaS ou une application. Les informations manquantes restent
            visibles ; les documents restent à valider avec votre client.
          </p>
        </header>
      </div>
      <FeaturesSection />
      <ProductShowcase />
      <FinalCta />
    </MarketingShell>
  );
}
