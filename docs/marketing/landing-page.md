# Landing page — étape 27

## Positionnement et périmètre

BriefPilot AI est un assistant de cadrage et de préparation des projets digitaux pour les développeurs freelances, agences digitales, chefs de projet et entrepreneurs. La promesse : transformer des besoins clients en spécifications prêtes à développer. La validation métier et les décisions restent humaines.

L’opérateur considère l’étape 26 validée et demande exclusivement l’étape 27. Aucun lancement public, ressource payante, changement des données de production ou déploiement n’est inclus.

## Composition

Douze sections : header ; hero ; problème ; solution ; six fonctionnalités ; workflow en six étapes ; aperçu produit ; trois publics ; quatre plans ; FAQ ; CTA final ; footer. La page `/` assemble des Server Components dans `src/components/marketing`. Seuls le menu mobile et les préférences/statistiques demandent du JavaScript client. La FAQ utilise les disclosures HTML natifs.

Le hero annonce « Des besoins clients aux spécifications prêtes à développer ». L’aperçu Café Aube est explicitement fictif, simplifié et éditable en React/CSS. Le showcase réutilise `BriefStatements`, composant du lecteur réel, sur des énoncés de démonstration avec statuts confirmés/hypothèses/manquants. Aucune capture artificielle n’est présentée comme un compte réel. Aucun avis, nombre de clients, gain de temps chiffré ou certification n’est inventé.

## Direction artistique

Tokens isolés sous `.marketing` dans `marketing.css` : violet `#6155f5`, bleu nuit `#171b35`, accent `#ad9fff`, fond `#fafbff`, texte secondaire `#606378`. Typographie système sans téléchargement externe, titres resserrés, grilles éditoriales, séparateurs fins, panneaux clairs et sections bleu nuit. Icônes Lucide et favicon SVG éditable. Pas de modification des tokens globaux du dashboard.

Les composants de base utilisent shadcn/ui lorsque pertinent (Button et badges du produit). Les styles marketing spécifiques sont scopés ; les pages dashboard restent sous leur layout existant. Le menu mobile propose Escape et retour du focus. Les liens ont un focus visible ; les cibles principales atteignent 40–51 px. Les transitions sont désactivées avec `prefers-reduced-motion`.

## Parcours et offres

Le produit possède une connexion Google, aucun système d’invitation ou liste d’attente applicative. Les CTA d’entrée utilisent donc `/login`, sans créer un nouveau parcours public ni modifier Auth.js. La protection Vercel du Preview reste indépendante et inchangée.

Les quatre cartes utilisent exclusivement `src/config/plans.ts`. La landing renvoie vers les tarifs ; seul `/pricing` conserve le checkout existant, en mode Test et seulement si la configuration serveur est complète. Les capacités futures d’équipe/personnalisation/support ne sont pas présentées comme livrées. Enterprise n’est pas souscriptible ; le lien contact ne promet pas une prise en charge inexistante.

Pages complémentaires : `/features`, `/how-it-works`, `/pricing`, `/contact`, `/privacy`, `/terms`. Contact affiche un état explicite sans formulaire ni coordonnées inventées. Confidentialité et conditions restent des brouillons visibles et non indexables : validation éditoriale/juridique nécessaire avant publication commerciale.

## Maintenance

- Tarifs/quotas : modifier `src/config/plans.ts`, jamais recopier les montants dans une page.
- Textes/sections : composants marketing ; le workflow et les fonctionnalités sont partagés avec leurs pages détaillées.
- Domaine/contact : voir `seo-strategy.md` ; rien n’est configuré à distance automatiquement.
- Conversion : voir `conversion-tracking.md` ; instrumentation inactive par défaut.
- Captures, audits et limites : voir `validation.md`.

Skills accessibles examinés : `create-saas-feature` et `review-code`. Revue finale selon `review-code`. Aucun skill Vercel frontend, UI UX Pro Max ou autre skill frontend spécialisé n’était installé ; aucune utilisation de ces skills n’est revendiquée.
