# Backlog et tâches Codex

## Architecture

Le bouton du lecteur de brief envoie uniquement l’identifiant du brief choisi et les options de génération. Le service recharge le projet et le JSON canonique de ce brief en vérifiant leur propriétaire. Un brief d’un autre projet ne peut pas être utilisé. Les anciens formats de brief sont rejetés explicitement.

Le client OpenAI serveur existant effectue un appel Responses avec Structured Outputs (`responses.parse`, `zodTextFormat`, `store: false`, maximum 20 000 tokens de sortie). Aucun outil d’exécution n’est fourni. L’entrée et le contexte sont bornés à 100 000 caractères ; les contextes trop grands sont refusés sans être tronqués silencieusement. Les refus, sorties incomplètes, erreurs de réseau, timeouts et quotas sont traduits en erreurs publiques sûres.

Zod valide le contrat JSON strict sans raffinements incompatibles avec Structured Outputs. Une validation déterministe distincte contrôle les identifiants globaux, relations épic/story/tâche, sources, exclusions WONT, recommandations, couverture des MUST, fourchettes d’effort et chemins suggérés. Un parcours de graphe détecte les cycles entre les prérequis explicites et les rattachements parentaux ; un prérequis ne peut pas être dans une phase ultérieure.

Les prompts Codex sont assemblés par le serveur et restent des livrables textuels à relire et copier. Les chemins suggérés ne sont pas présentés comme des fichiers existants. Les données du client n’imposent pas la stack de BriefPilot aux projets générés.

## Persistance et concurrence

`Backlog` conserve le JSON enveloppé dans `backlog.v1`, le projet, le brief source, la version, le statut `DRAFT`/`READY`, une empreinte du contexte et les dates. La contrainte unique `(projectId, version)` garantit l’unicité des versions. Une clé étrangère composite `(sourceBriefId, projectId)` garantit que le brief appartient au projet. Aucune migration ne supprime de données existantes.

`BacklogGeneration` conserve UUID de demande, empreinte des options, état, résultat, lease et dates de toutes les tentatives payantes, même échouées. `(projectId, requestId)` est unique. Un verrou transactionnel par propriétaire protège la réservation et la sauvegarde ; l’appel IA reste hors transaction. La sauvegarde revérifie la propriété, le contexte et le lease. Une modification pendant l’appel empêche l’enregistrement d’un résultat périmé.

Les reprises d’une même demande retournent le même résultat. Sans `regenerate`, un contexte identique réutilise une version existante sans appel payant. `regenerate: true` crée explicitement une nouvelle version et consomme un appel. La réutilisation d’un résultat conserve les tentatives payantes d’une demande précédemment échouée.

Limites par propriétaire pour ce générateur : 10 appels par 24 heures glissantes, 2 par minute, 10 secondes entre appels d’un même projet et 3 essais par UUID. Maximum 50 versions par projet. Le client partagé utilise un timeout de 45 secondes sans retry automatique ; le lease dure 90 secondes. Les limites sont indépendantes de celles des autres agents.

Un brief incomplet exige un consentement explicite au brouillon. Les manques et hypothèses du brief sont conservés. Les manques, hypothèses techniques ou besoins supposés maintiennent le backlog en `DRAFT`. `READY` signifie prêt pour relecture, sans validation automatique par le client ni garantie d’exactitude sémantique.

## API et pages

- `POST /api/projects/[projectId]/backlogs` : `{ requestId: UUID, sourceBriefId, allowDraft: false, regenerate: false, language: "fr" }`.
- `GET /api/projects/[projectId]/backlogs` : 50 versions maximum, triées de la plus récente à la plus ancienne.
- `GET /api/projects/[projectId]/backlogs/[backlogId]` : document précis du projet.
- `/dashboard/projects/[projectId]/backlogs` : historique ou état vide, choix du brief via la liste de cahiers des charges.
- `/dashboard/projects/[projectId]/backlogs/[backlogId]` : lecteur, filtres phase/priorité/rôle, détails, copie des prompts et régénération depuis le même brief source.

Session Auth.js et utilisateur en base sont requis. Le service contrôle systématiquement le propriétaire. Les mutations contrôlent aussi l’origine et la taille du corps JSON ; aucun contenu HTML généré n’est injecté dans le lecteur. Loading/error/not-found sont fournis par le layout et les pages dashboard existants.

## Vérifications et test manuel

Avec Node 24, PostgreSQL de développement et les dépendances installées :

```bash
pnpm prisma migrate deploy
pnpm prisma generate
pnpm test
pnpm lint
pnpm build
BACKLOG_VISUAL_TEST=1 node --test tests/backlogs.integration.test.mjs
```

Le test d’intégration crée et nettoie ses propres utilisateurs/projets. Il démarre Next sur 3131 et un fournisseur OpenAI simulé sur 3132. Le test Chrome optionnel utilise Google Chrome et le port 9341. Il couvre la génération depuis le brief sélectionné, les filtres, la copie, l’affichage mobile/ordinateur et la navigation entre versions. Aucun crédit API n’est consommé.

Pour tester réellement : configurer `OPENAI_API_KEY` et `OPENAI_MODEL` côté serveur, se connecter, ouvrir un cahier des charges, cliquer « Générer le backlog » (accepter le brouillon si nécessaire), puis ouvrir une tâche et copier son prompt. Vérifier les exigences, les dépendances, les décisions techniques et les estimations avant d’utiliser le prompt. Régénérer puis consulter une ancienne version pour vérifier sa conservation.

## Limites

Un appel unique borne le coût mais peut être insuffisant pour un très grand brief ; aucune génération multi-passes n’est implémentée. Les limites du schéma sont de 20 épics, 50 stories et 80 tâches. Les règles de sources réduisent les inventions sans démontrer automatiquement la fidélité sémantique de chaque phrase. Une revue métier et technique reste nécessaire. Aucun code client, dépôt, tâche Codex ou déploiement n’est exécuté par ce module.
