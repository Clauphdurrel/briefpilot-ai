import { Plus } from "lucide-react";
import { plans } from "@/config/plans";
import { SectionHeading } from "./content-sections";
export const faqs = [
  [
    "À qui s’adresse BriefPilot AI ?",
    "Aux développeurs freelances, agences digitales, chefs de projet et entrepreneurs qui souhaitent clarifier une demande avant de créer un site, un SaaS ou une application.",
  ],
  [
    "Peut-on utiliser BriefPilot AI gratuitement ?",
    `Oui. Le plan Free inclut ${plans.FREE.limits.ACTIVE_PROJECTS} projets actifs, ${plans.FREE.limits.AI_INTERVIEW} réponses IA d’interview, ${plans.FREE.limits.AI_BRIEF} briefs, ${plans.FREE.limits.AI_BACKLOG} backlog et ${plans.FREE.limits.PDF_EXPORT} exports PDF par mois. Chaque réponse IA, y compris la première question, consomme une unité. Les quotas de génération se renouvellent mensuellement ; la capacité de projets actifs ne se réinitialise pas.`,
  ],
  [
    "Quels documents peut-on générer ?",
    "Un cahier des charges structuré, puis un backlog technique lié à ce brief, avec des tâches et des prompts Codex pour préparer le développement. Les informations absentes restent signalées comme manquantes ou à valider.",
  ],
  [
    "Peut-on exporter les documents ?",
    "Oui, en Markdown et PDF. Les exports PDF sont soumis aux quotas du plan et aux limites techniques du service. Le Markdown permet aussi de reprendre les livrables dans vos outils habituels.",
  ],
  [
    "BriefPilot AI remplace-t-il un chef de projet ?",
    "Non. L’IA aide à recueillir, organiser et préciser les besoins. Vous restez responsable de la validation du contenu avec votre client et des décisions techniques, contractuelles et budgétaires.",
  ],
  [
    "Les données des clients sont-elles protégées ?",
    "L’accès aux projets requiert une connexion et des contrôles d’autorisation côté serveur. Les textes nécessaires à la génération sont transmis au fournisseur IA. Pour les essais, privilégiez des données fictives et ne saisissez pas de secrets. Aucune certification ou conformité particulière n’est revendiquée ici.",
  ],
  [
    "Faut-il être développeur pour l’utiliser ?",
    "Non. Vous pouvez décrire votre idée et répondre aux questions avec vos mots. Les livrables techniques doivent ensuite être relus avec les personnes chargées de construire le produit.",
  ],
];
export function FaqSection() {
  return (
    <section className="mk-section mk-container mk-faq">
      <SectionHeading
        number="07"
        eyebrow="AVANT DE VOUS LANCER"
        title="Les questions sont toujours les bienvenues."
      />
      <div>
        {faqs.map(([question, answer]) => (
          <details key={question}>
            <summary>
              {question}
              <Plus aria-hidden="true" size={19} />
            </summary>
            <p>{answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
