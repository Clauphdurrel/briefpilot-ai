import { MarketingShell } from "./marketing-shell";
export function LegalDraft({ kind }: { kind: "privacy" | "terms" }) {
  const privacy = kind === "privacy";
  return (
    <MarketingShell page="legal">
      <div className="mk-container">
        <header className="mk-page-hero">
          <p className="mk-eyebrow">DOCUMENT EN PRÉPARATION</p>
          <h1>{privacy ? "Confidentialité" : "Conditions d’utilisation"}</h1>
        </header>
        <div className="mk-prose">
          <div className="mk-draft-note">
            Brouillon informatif — à compléter et faire valider avant
            publication commerciale. Ce document n’est pas une politique
            juridique définitive.
          </div>
          {privacy ? (
            <>
              <h2>Fonctionnement actuel</h2>
              <p>
                La connexion utilise Google. Les projets et livrables sont
                enregistrés dans la base de données du service ; les textes
                nécessaires aux générations sont transmis au fournisseur IA. Les
                exports PDF utilisent un service de rendu dédié.
              </p>
              <h2>Statistiques facultatives</h2>
              <p>
                Les statistiques produit du compte reposent sur une préférence
                dans les paramètres. Les statistiques de cette vitrine, si elles
                sont activées par l’opérateur, demandent un accord distinct ;
                elles ne contiennent ni textes de projets ni email. La
                préférence est conservée dans le navigateur. Un identifiant
                aléatoire de session, transformé côté serveur avant transmission
                à PostHog, est utilisé après accord. Aucun rejeu de session
                n’est activé.
              </p>
              <h2>Informations à compléter</h2>
              <ul>
                <li>Identité et coordonnées du responsable du traitement.</li>
                <li>
                  Finalités détaillées, bases légales, sous-traitants et
                  transferts.
                </li>
                <li>Durées de conservation, droits et procédure de demande.</li>
                <li>
                  Politique relative aux cookies et stockage du navigateur.
                </li>
              </ul>
            </>
          ) : (
            <>
              <h2>Périmètre du service</h2>
              <p>
                BriefPilot AI aide à préparer des cahiers des charges, backlogs
                et prompts. Les sorties IA doivent être relues ; elles ne
                remplacent pas une validation métier, technique ou
                contractuelle. Les plans et quotas sont décrits sur la page des
                tarifs. Le checkout actuel fonctionne uniquement en mode Test.
              </p>
              <h2>Informations à compléter</h2>
              <ul>
                <li>
                  Identité de l’éditeur, coordonnées et conditions d’accès.
                </li>
                <li>
                  Modalités des abonnements, résiliation et remboursements.
                </li>
                <li>
                  Responsabilités, propriété des contenus et usages autorisés.
                </li>
                <li>
                  Droit applicable, règlement des litiges et date d’entrée en
                  vigueur.
                </li>
              </ul>
            </>
          )}
          <h2>Avant le lancement public</h2>
          <p>
            Les coordonnées de l’éditeur et les documents définitifs doivent
            être renseignés et validés. Aucune certification, garantie de
            conformité ou adresse d’entreprise n’est inventée ici.
          </p>
        </div>
      </div>
    </MarketingShell>
  );
}
