import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
export function FinalCta() {
  return (
    <section className="mk-final">
      <div className="mk-container mk-final-inner">
        <div>
          <p className="mk-eyebrow">
            VOTRE PROCHAIN PROJET MÉRITE UN BON DÉPART
          </p>
          <h2>
            Commencez par la clarté.
            <br />
            <span>Le code viendra ensuite.</span>
          </h2>
        </div>
        <div>
          <Button asChild className="mk-button mk-button-light">
            <Link href="/login" prefetch={false} data-marketing-signup="final">
              Créer mon premier brief{" "}
              <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
          </Button>
          <p>Plan Free disponible · Connexion Google</p>
        </div>
      </div>
    </section>
  );
}
