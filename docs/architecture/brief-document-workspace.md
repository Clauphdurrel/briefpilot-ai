# Espace documentaire des cahiers des charges

## Présentation et navigation

La page de détail charge le projet et la version demandée côté serveur avec les contrôles de propriété existants. `BriefWorkspace` compose un sommaire à gauche, le document au centre et les analyses/actions à droite à partir de 1280 px. Sur mobile et tablette, le sommaire se replie et un bouton donne accès au panneau d’analyse, avec retour au document et gestion du focus.

`BriefViewer` reste un Server Component pour le document. Le contrat JSON courant possède 17 sections obligatoires : elles sont toutes rendues avec leurs données réelles ou un état vide explicite. Le sommaire n’a donc aucun lien vers une section absente. Un document d’ancien format conserve le traitement d’erreur existant.

`BriefToc` suit la position des sections, indique la section active avec `aria-current`, gère les ancres et le focus clavier, et respecte la préférence de réduction des animations. Il devient sticky et défilable sur ordinateur. `BriefFeatures` réserve JavaScript à la recherche et au filtre MoSCoW. Les détails utilisent des éléments `details` natifs et exposent acteurs, règles, critères, complexité et dépendances sans modifier les données enregistrées.

Le texte est échappé par React. Aucun HTML du modèle n’est injecté, et aucune nouvelle bibliothèque UI ni dépendance Markdown n’est nécessaire.

## Statistiques et statuts

`src/lib/brief-presentation.ts` centralise les calculs purs et les filtres. Les nombres de fonctionnalités, pages, rôles, risques et informations manquantes correspondent exactement aux longueurs des listes enregistrées. Le compteur d’hypothèses inclut les objets classés `assumed`, y compris dans les règles métier, les risques et les contraintes.

Les éléments structurés ayant un statut sont recensés et les énoncés de texte identique et de même statut sont dédupliqués (normalisation Unicode, casse et espaces). Les fonctionnalités/pages/parcours/rôles restent distincts par identifiant et section. Des énoncés identiques de statuts différents restent distincts. Ces règles sont indiquées dans le panneau : il s’agit d’un inventaire documentaire, pas d’un score de qualité ni d’une preuve d’exhaustivité. Les informations manquantes déclarées et les énoncés classés `missing` sont présentés séparément.

`BriefRequirementsStatus` sépare confirmations enregistrées, hypothèses, recommandations et manques, avec liens vers les sections d’origine. Aucune consultation ne modifie un statut. Aucun bouton d’approbation, signature ou validation contractuelle n’est ajouté. Les critères de réception et le retour à l’interview préparent une relecture explicite avec le client.

## Versions et performances

Le lecteur utilise `getBriefReaderContext` pour la préparation de la régénération et la liste des versions. La requête paramétrée PostgreSQL ne lit pour l’historique que les titres, dates et métadonnées de génération (`json->'generation'`), avec filtre de projet et propriétaire. Les JSON complets des autres documents ne sont pas transmis au navigateur ni chargés pour afficher l’historique.

`BriefVersions` affiche les versions réellement stockées, dates et titres, la version consultée et un accès à la dernière version. Les documents sans métadonnée de version sont désignés comme anciens formats, sans numéro inventé. Un bandeau signale la consultation d’une version antérieure. Le changement de version réinitialise les filtres et panneaux locaux.

Les services de génération existants conservent les anciennes versions. Une régénération depuis le lecteur utilise l’interview actuelle ; si les sources n’ont pas changé, le service peut réutiliser le document existant. Cela est expliqué dans l’interface.

## Actions coordonnées

`BriefActions` utilise un verrou client partagé entre les deux boutons de génération. Une génération en cours bloque l’autre, y compris pour des déclenchements synchrones avant le rendu React suivant. Les boutons conservent aussi leurs propres protections et les contrôles/idempotences serveur existants. Les autres écrans gardent le comportement par défaut des boutons, les nouvelles propriétés étant optionnelles.

La génération du backlog envoie exactement le `briefId` consulté, même depuis une ancienne version. Elle exige toujours le consentement au brouillon lorsque nécessaire. Les liens vers le projet, l’interview et les backlogs réutilisent les routes existantes.

Les agents IA, l’authentification et les modèles Prisma ne sont pas modifiés. Aucun export PDF ou téléchargement Markdown n’est ajouté à cette étape.

## Vérifications

Avec Node 24 et PostgreSQL de développement :

```bash
pnpm test
pnpm lint
pnpm build
BRIEF_VISUAL_TEST=1 node --test tests/briefs.integration.test.mjs
BACKLOG_VISUAL_TEST=1 node --test tests/backlogs.integration.test.mjs
```

Les tests unitaires couvrent calculs, déduplication, statuts, filtres, HTML non fiable, sections/ancres, états vides, numéros réels et requête d’historique allégée. Les tests Chrome couvrent recherche, priorité, détail, ancres/focus/section active, statistiques stables pendant le filtrage, générations coordonnées, navigation vers les modules, versions et écrans mobile/ordinateur. Un test génère et régénère un backlog depuis une version ancienne alors qu’une version plus récente existe, puis vérifie l’association exacte en base. Les services IA sont simulés localement et ne consomment aucun crédit.

Pour tester manuellement : ouvrir un cahier des charges, utiliser le sommaire, rechercher une fonctionnalité et afficher ses critères, puis consulter « Analyse et actions ». Examiner les hypothèses et les questions manquantes. Changer de version, revenir à la dernière, ou générer le backlog de la version sélectionnée. Une relecture métier et technique reste nécessaire avant tout engagement.
