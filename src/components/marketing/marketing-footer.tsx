import Link from "next/link";
import { Brand } from "./marketing-header";
export function MarketingFooter() {
  return (
    <footer className="mk-footer">
      <div className="mk-container">
        <div className="mk-footer-top">
          <div>
            <Brand />
            <p>
              Moins de flou.
              <br />
              Plus de projets bien cadrés.
            </p>
          </div>
          <nav aria-label="Navigation de pied de page">
            <div>
              <h2>Le produit</h2>
              <Link href="/features">Fonctionnalités</Link>
              <Link href="/how-it-works">Comment ça marche</Link>
              <Link href="/pricing">Tarifs</Link>
            </div>
            <div>
              <h2>Pour aller plus loin</h2>
              <Link
                href="/login"
                prefetch={false}
                data-marketing-signup="footer"
              >
                Connexion
              </Link>
              <Link href="/contact">Contact</Link>
              <Link href="/privacy">Confidentialité</Link>
              <Link href="/terms">Conditions d’utilisation</Link>
            </div>
          </nav>
        </div>
        <div className="mk-footer-bottom">
          <span>© {new Date().getFullYear()} BriefPilot AI</span>
          <span>Conçu pour clarifier, avant de développer.</span>
        </div>
      </div>
    </footer>
  );
}
