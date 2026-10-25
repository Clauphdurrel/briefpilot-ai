import { Check, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { BriefStatements } from "@/components/brief/brief-requirements-status";
import { SectionHeading } from "./content-sections";
export function ProductShowcase() {
  return (
    <section className="mk-showcase mk-section" aria-label="Aperçu du produit">
      <div className="mk-container">
        <div className="mk-showcase-header">
          <SectionHeading
            number="04"
            eyebrow="DU CONCRET À RELIRE"
            title="Un document qui pose les bonnes bases."
          />
          <p>
            Vos décisions, vos hypothèses et vos questions ouvertes restent
            identifiables. L’IA prépare ; vous gardez la main.
          </p>
        </div>
        <div className="mk-showcase-layout">
          <aside className="mk-showcase-outline">
            <p className="mk-step-label">CAHIER DES CHARGES</p>
            <h3>Café Aube</h3>
            <span>Site vitrine · Exemple fictif</span>
            <ol>
              <li className="mk-outline-active">01 Présentation du projet</li>
              <li>02 Objectifs métier</li>
              <li>03 Public cible</li>
              <li>04 Périmètre</li>
              <li>05 Fonctionnalités</li>
              <li>06 Pages et écrans</li>
            </ol>
            <p className="mk-outline-more">… et les autres sections du brief</p>
          </aside>
          <div className="mk-showcase-document">
            <div className="mk-document-toolbar">
              <span>EXTRAIT DU DOCUMENT</span>
              <span>Version de démonstration</span>
            </div>
            <h3>
              Un café de quartier.
              <br />
              Une présence en ligne claire.
            </h3>
            <p className="mk-showcase-lead">
              Présenter le lieu, mettre la carte à disposition et faciliter la
              première visite.
            </p>
            <div className="mk-showcase-statements">
              <BriefStatements
                items={[
                  {
                    sourceIds: [],
                    status: "confirmed",
                    text: "Le site présente les horaires, l’adresse du café et sa carte.",
                  },
                  {
                    sourceIds: [],
                    status: "assumed",
                    text: "Les photos et les textes seront fournis par le client.",
                  },
                  {
                    sourceIds: [],
                    status: "missing",
                    text: "Le budget et la date de livraison restent à préciser.",
                  },
                ]}
              />
            </div>
          </div>
          <div className="mk-showcase-notes">
            <span className="mk-step-label">LA SUITE DU PROJET</span>
            <h3>De quoi préparer le développement.</h3>
            <ul>
              {[
                "Fonctionnalités et pages structurées",
                "Critères d’acceptation explicites",
                "Backlog lié au cahier des charges",
                "Exports Markdown et PDF",
              ].map((text) => (
                <li key={text}>
                  <Check size={17} aria-hidden="true" />
                  {text}
                </li>
              ))}
            </ul>
            <Link href="/features" className="mk-text-link">
              Voir les fonctionnalités{" "}
              <ArrowUpRight aria-hidden="true" size={17} />
            </Link>
          </div>
        </div>
        <p className="mk-showcase-caption">
          Contenu fictif. Les statuts ci-dessus utilisent le composant du
          lecteur de brief réel ; cette composition est une présentation
          simplifiée, pas une capture d’un compte client.
        </p>
      </div>
    </section>
  );
}
