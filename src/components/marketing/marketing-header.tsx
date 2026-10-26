import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MobileNav } from "./mobile-nav";
export function Brand() {
  return (
    <Link href="/" className="mk-brand" aria-label="BriefPilot AI, accueil">
      <span className="mk-brand-symbol" aria-hidden="true">
        <ArrowUpRight size={23} strokeWidth={2.5} />
      </span>
      <span>
        briefpilot<span className="mk-brand-ai"> AI</span>
      </span>
    </Link>
  );
}
export function MarketingHeader() {
  return (
    <header className="mk-header">
      <a href="#main-content" className="mk-skip">
        Aller au contenu
      </a>
      <div className="mk-container mk-header-inner">
        <Brand />
        <nav className="mk-desktop-nav" aria-label="Navigation principale">
          <Link href="/#fonctionnalites">Fonctionnalités</Link>
          <Link href="/#fonctionnement">Fonctionnement</Link>
          <Link href="/pricing">Tarifs</Link>
        </nav>
        <div className="mk-header-actions">
          <Link
            href="/login"
            prefetch={false}
            className="mk-login"
            data-marketing-signup="header"
          >
            Connexion
          </Link>
          <Button asChild className="mk-button mk-button-small">
            <Link href="/login" prefetch={false} data-marketing-signup="header">
              Créer un brief <ArrowUpRight aria-hidden="true" size={15} />
            </Link>
          </Button>
        </div>
        <MobileNav />
      </div>
    </header>
  );
}
