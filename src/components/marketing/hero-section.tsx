import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  FileText,
  ListChecks,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
export function HeroSection() {
  return (
    <section className="mk-hero mk-container" aria-labelledby="hero-title">
      <div className="mk-hero-copy">
        <p className="mk-eyebrow">
          <span className="mk-status-dot" /> LE CADRAGE A SON COPILOTE
        </p>
        <h1 id="hero-title">
          Des besoins clients aux spécifications{" "}
          <span>prêtes à développer.</span>
        </h1>
        <p className="mk-hero-description">
          Les bonnes questions. Un cahier des charges clair. Un backlog
          exploitable. BriefPilot AI transforme les idées de vos clients en un
          point de départ solide pour développer.
        </p>
        <div className="mk-hero-actions">
          <Button asChild className="mk-button">
            <Link
              href="/login"
              prefetch={false}
              data-marketing-signup="hero"
              data-marketing-hero
            >
              Créer mon premier brief{" "}
              <ArrowUpRight aria-hidden="true" size={18} />
            </Link>
          </Button>
          <Link className="mk-text-link" href="#fonctionnement">
            Découvrir comment ça marche{" "}
            <ArrowRight aria-hidden="true" size={17} />
          </Link>
        </div>
        <p className="mk-hero-note">
          <Check aria-hidden="true" size={15} /> Un plan Free pour commencer{" "}
          <span aria-hidden="true">·</span> Connexion Google
        </p>
      </div>
      <div className="mk-hero-visual">
        <div className="mk-orbit-label">
          <span aria-hidden="true">↗</span> Votre idée, avec un plan.
        </div>
        <div className="mk-product-window">
          <div className="mk-window-top">
            <span className="mk-window-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span>BriefPilot AI / Projet de démonstration</span>
            <span className="mk-mini-pill">Brouillon</span>
          </div>
          <div className="mk-window-body">
            <aside
              className="mk-demo-sidebar"
              aria-label="Étapes de cet exemple"
            >
              <span className="mk-demo-project">
                CA
                <br />
                <small>Café Aube</small>
              </span>
              <span>
                <MessageSquare size={15} aria-hidden="true" /> Interview
              </span>
              <span className="mk-demo-selected">
                <FileText size={15} aria-hidden="true" /> Cahier des charges
              </span>
              <span>
                <ListChecks size={15} aria-hidden="true" /> Backlog
              </span>
            </aside>
            <div className="mk-demo-document">
              <p className="mk-document-overline">SITE VITRINE · CAFÉ AUBE</p>
              <h2>
                Une idée qui
                <br />
                prend forme.
              </h2>
              <p className="mk-demo-description">
                Un site pour découvrir le café, consulter la carte et préparer
                sa visite.
              </p>
              <div className="mk-demo-rule" />
              <p className="mk-demo-section">
                01 <strong>Objectifs du projet</strong>
              </p>
              <div className="mk-demo-requirement">
                <span className="mk-confirmed">Confirmé</span>
                <p>Présenter le lieu et ses horaires.</p>
              </div>
              <div className="mk-demo-requirement">
                <span className="mk-missing">À préciser</span>
                <p>Quels contenus le client peut-il fournir ?</p>
              </div>
              <div className="mk-demo-pages">
                <span>Accueil</span>
                <span>La carte</span>
                <span>Contact</span>
              </div>
            </div>
          </div>
        </div>
        <div className="mk-output-tag">
          <span className="mk-output-icon">
            <ListChecks aria-hidden="true" size={20} />
          </span>
          <div>
            <strong>Prêt pour la prochaine étape</strong>
            <span>Du brief au backlog technique</span>
          </div>
          <ArrowRight size={17} aria-hidden="true" />
        </div>
        <p className="mk-visual-caption">
          Exemple fictif · interface simplifiée et éditable
        </p>
      </div>
    </section>
  );
}
