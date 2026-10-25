import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { planNames, plans } from "@/config/plans";
import { CheckoutButton } from "@/components/billing/checkout-button";
import { SectionHeading } from "./content-sections";
const descriptions = {
  FREE: "Pour découvrir la méthode sur vos premiers projets.",
  PRO: "Pour cadrer vos projets clients au quotidien.",
  AGENCY: "Pour un volume de projets plus important.",
  ENTERPRISE: "Pour échanger sur des besoins spécifiques.",
};
export function PricingCards({
  checkout = false,
  configured = false,
}: {
  checkout?: boolean;
  configured?: boolean;
}) {
  return (
    <div className="mk-pricing-grid">
      {planNames.map((id) => {
        const plan = plans[id];
        return (
          <article
            key={id}
            className={`mk-price-card ${id === "PRO" ? "mk-price-featured" : ""}`}
            aria-labelledby={`plan-${id}`}
          >
            {id === "PRO" && (
              <span className="mk-plan-tag">POUR LES INDÉPENDANTS</span>
            )}
            <h3 id={`plan-${id}`}>{plan.name}</h3>
            <p className="mk-plan-description">{descriptions[id]}</p>
            <p className="mk-price">
              {plan.monthlyPriceEuro === null ? (
                <span className="mk-price-custom">Sur devis</span>
              ) : (
                <>
                  {plan.monthlyPriceEuro}
                  <span> € / mois</span>
                </>
              )}
            </p>
            <ul>
              {[
                `${plan.limits.ACTIVE_PROJECTS ?? "Volume de"} projets ${plan.limits.ACTIVE_PROJECTS === null ? "à définir" : "actifs"}`,
                `${plan.limits.AI_INTERVIEW ?? "Volume de"} réponses IA d’interview${plan.limits.AI_INTERVIEW === null ? " à définir" : " / mois"}`,
                `${plan.limits.AI_BRIEF ?? "Volume de"} briefs${plan.limits.AI_BRIEF === null ? " à définir" : " / mois"}`,
                `${plan.limits.AI_BACKLOG ?? "Volume de"} backlogs${plan.limits.AI_BACKLOG === null ? " à définir" : " / mois"}`,
                `PDF : ${id === "ENTERPRISE" ? "conditions à définir" : plan.limits.PDF_EXPORT === null ? "sans quota mensuel de plan" : `${plan.limits.PDF_EXPORT} / mois`}`,
                "Markdown et prompts Codex",
              ].map((text) => (
                <li key={text}>
                  <Check size={15} aria-hidden="true" />
                  {text}
                </li>
              ))}
            </ul>
            {id === "ENTERPRISE" ? (
              <>
                <Button
                  asChild
                  variant="outline"
                  className="mk-button mk-button-outline"
                >
                  <Link href="/contact">
                    Parlons de vos besoins{" "}
                    <ArrowUpRight aria-hidden="true" size={15} />
                  </Link>
                </Button>
                <p className="mk-price-note">
                  Offre à définir, non souscriptible.
                </p>
              </>
            ) : checkout && (id === "PRO" || id === "AGENCY") ? (
              <CheckoutButton plan={id} configured={configured} />
            ) : (
              <Button
                asChild
                className={`mk-button ${id === "PRO" ? "" : "mk-button-outline"}`}
                variant={id === "PRO" ? "default" : "outline"}
              >
                <Link
                  href={id === "FREE" ? "/login" : "/pricing"}
                  prefetch={id === "FREE" ? false : undefined}
                  {...(id === "FREE"
                    ? { "data-marketing-signup": "pricing" }
                    : {})}
                >
                  {id === "FREE"
                    ? "Créer mon premier brief"
                    : `Découvrir ${plan.name}`}
                  <ArrowUpRight aria-hidden="true" size={15} />
                </Link>
              </Button>
            )}
          </article>
        );
      })}
    </div>
  );
}
export function PricingPreview() {
  return (
    <section id="tarifs" className="mk-section mk-pricing">
      <div className="mk-container">
        <SectionHeading
          number="06"
          eyebrow="COMMENCEZ À VOTRE RYTHME"
          title="Un cadre clair. Pour vos projets et votre budget."
        >
          Découvrez le plan Free, puis choisissez le volume adapté à votre
          activité.
        </SectionHeading>
        <PricingCards />
        <p className="mk-pricing-disclaimer">
          Le paiement est actuellement disponible en mode Test uniquement. Aucun
          achat réel sur ce Preview. Les fonctions d’équipe et de
          personnalisation avancée ne sont pas disponibles dans le MVP.{" "}
          <Link href="/pricing">Consulter les conditions des offres</Link>.
        </p>
      </div>
    </section>
  );
}
