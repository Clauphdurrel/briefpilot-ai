import { MarketingShell } from "@/components/marketing/marketing-shell";
import { WorkflowSection } from "@/components/marketing/content-sections";
import { FinalCta } from "@/components/marketing/final-cta";
import { marketingMetadata } from "@/lib/marketing-seo";
export const metadata = marketingMetadata(
  "Comment ça marche — BriefPilot AI",
  "/how-it-works",
  "Découvrez comment passer d’une demande client à un cahier des charges, un backlog technique et des livrables exportables en six étapes.",
);
export default function WorkflowPage() {
  return (
    <MarketingShell page="workflow">
      <div className="mk-container">
        <header className="mk-page-hero">
          <p className="mk-eyebrow">AVANCER AVEC MÉTHODE</p>
          <h1>Une conversation. Un brief. Un plan pour la suite.</h1>
          <p>
            Vous échangez avec votre client, puis complétez l’interview dans
            votre espace connecté. BriefPilot AI organise ces informations pour
            préparer le développement ; aucun envoi automatique d’interview au
            client n’est proposé.
          </p>
        </header>
      </div>
      <WorkflowSection />
      <div className="mk-container">
        <div className="mk-prose">
          <h2>Un exemple : le site d’un café</h2>
          <p>
            Commencez par décrire le café et son public. Précisez les pages
            attendues, les contenus disponibles et les contraintes. Si le budget
            est inconnu, le brief doit le signaler. Vous pouvez autoriser un
            brouillon, le relire, puis générer un backlog et exporter les
            documents.
          </p>
          <h2>La validation reste une étape humaine</h2>
          <p>
            Le document généré ne constitue pas un accord contractuel. Vérifiez
            les hypothèses, les exigences et les critères d’acceptation avec le
            client avant d’estimer ou de commencer à développer.
          </p>
        </div>
      </div>
      <FinalCta />
    </MarketingShell>
  );
}
