# Exports Markdown

## Contrat et architecture

Les exports sont des lectures déterministes du JSON enregistré. Ils n’appellent aucun agent IA et ne modifient ni document, ni statut, ni fichier de repository client. Le même document et les mêmes références produisent les mêmes octets UTF-8 ; aucune date courante d’export n’est ajoutée.

- `briefToMarkdown` valide l’enveloppe `brief.v1`, ajoute les références de projet/version/date et réutilise `renderBriefMarkdown`, le convertisseur canonique existant. `Brief.content` n’est pas réutilisé comme source de vérité.
- `backlogToMarkdown` valide `backlog.v1` et produit résumé, phases, épics, stories, tâches, priorités, complexités, fourchettes indicatives, dépendances, critères, tests, contraintes, risques et fichiers hypothétiques.
- `codexTasksToMarkdown` expose chaque tâche et son prompt exact dans un bloc de code dont la clôture est plus longue que toute séquence de backticks du prompt. Les retours de ligne, accents et caractères spéciaux des prompts sont conservés. Les prompts ne sont ni reconstruits, ni exécutés pendant l’export.
- Les utilitaires gèrent tableaux, listes, blocs de code et noms de fichiers. Le convertisseur existant échappe HTML, pipes et syntaxe Markdown dans les champs de présentation. Les prompts restent littéraux à l’intérieur de leur bloc protégé.

`export.service.ts` réutilise `getBrief` et `getBacklogById`, avec les contrôles de propriétaire/projet existants et la validation Zod des versions exactes. Un export de backlog recharge son brief source, vérifie le numéro de version source et contrôle les références/dépendances par `validateBacklog`. Une version incohérente est refusée, sans correction silencieuse des données.

## Routes

```text
GET /api/projects/[projectId]/exports/brief/[briefId]
GET /api/projects/[projectId]/exports/backlog/[backlogId]
GET /api/projects/[projectId]/exports/backlog/[backlogId]?format=codex-tasks
```

`format=backlog` est également accepté pour le backlog. Les valeurs inconnues, paramètres inattendus et doublons sont refusés. Le brief n’accepte pas de paramètre de mode. Il n’existe aucun remplacement automatique par la dernière version.

Les routes réutilisent le wrapper Auth.js/projet existant, enrichi d’une fabrique de réponse optionnelle pour le téléchargement. Le comportement JSON par défaut reste inchangé pour les autres endpoints.

Réponse réussie :

```text
Content-Type: text/markdown; charset=utf-8
Content-Disposition: attachment; filename="reservations-a-evry-brief-v2.md"
Cache-Control: private, no-store
X-Content-Type-Options: nosniff
```

Le nom est calculé côté serveur depuis un slug ASCII borné, le type d’export et la version validée. Une seconde validation interdit quotes, chemins et caractères d’injection HTTP. Les erreurs restent des JSON publics sans détails internes, avec cache désactivé.

## Données sensibles et limites

Seuls les champs documentaires nécessaires sont exportés. Comptes, sessions, tokens, modèle OpenAI, identifiants techniques de génération et configuration serveur ne sont pas sérialisés. Les données brutes et le nom du projet sont contrôlés contre les motifs courants de credentials avant échappement/normalisation ; le résultat final est aussi contrôlé. Si une donnée sensible est détectée, l’export est refusé avec 422 au lieu d’altérer un prompt enregistré. La détection par motifs ne garantit pas de reconnaître tous les secrets : une relecture avant partage reste nécessaire.

Les fichiers sont générés en mémoire, sans stockage public, avec une limite de 8 Mio par export. Aucun ZIP, dossier combiné, export PDF ou traitement automatique des prompts n’est ajouté à cette étape.

## Interface

`ExportMenu` utilise le menu shadcn/ui existant. Le lecteur de brief offre l’export du brief sélectionné. Le lecteur de backlog offre le backlog sélectionné, ses tâches Codex et son brief source exact, qui peut être une ancienne version. Aucun export d’un document absent n’est proposé.

Le menu ne charge aucun document au rendu. Un clic effectue le GET authentifié, vérifie MIME et nom de fichier, télécharge un Blob et libère son URL temporaire. Un verrou bloque les doubles clics ; chargement, lancement du téléchargement, indisponibilité, session expirée, erreur réseau et réponse invalide sont signalés. Une navigation annule la requête client en cours. Le statut « téléchargement lancé » ne présume pas que l’utilisateur a conservé le fichier sur disque.

## Vérification

Avec Node 24 et PostgreSQL de développement :

```bash
pnpm test
pnpm lint
pnpm build
MARKDOWN_VISUAL_TEST=1 node --test tests/markdown-exports.integration.test.mjs
```

Le test d’intégration crée et nettoie ses utilisateurs/projets et démarre Next sur 3141. Un fournisseur IA local sur 3142 compte les éventuels appels indésirables : le compteur doit rester nul. Le test Chrome optionnel utilise le port 9351 et télécharge les trois vrais fichiers dans un répertoire temporaire nettoyé après contrôle. Aucun crédit OpenAI n’est consommé.

Les tests couvrent versions précises, titres/accents, tables, fences imbriquées, immutabilité, permissions, paramètres, headers, noms malveillants, JSON invalide, graphes cycliques, données sensibles, conservation des prompts et erreurs du menu.

Test manuel : ouvrir un brief et choisir « Exporter → Télécharger le cahier des charges ». Ouvrir un backlog puis télécharger le backlog et les tâches Codex. Comparer le numéro de version au document consulté et ouvrir les fichiers dans l’aperçu Markdown de VS Code. Vérifier les critères, dépendances et prompts avant de les utiliser dans un outil de développement.
