# Exports PDF professionnels

Les exports utilisent exclusivement les versions JSON enregistrées. Ils ne modifient ni les documents ni leur statut et n’appellent aucun agent ni OpenAI.

## Architecture

- `pdf.service.ts` charge les documents via les services propriétaires existants, valide Zod, vérifie la source exacte, les versions et le graphe du backlog. Les secrets reconnaissables sont refusés avant échappement ; ce contrôle heuristique ne remplace pas une relecture.
- `brief-pdf.ts`, `backlog-pdf.ts`, `project-pdf.ts` préparent les documents HTML. Les convertisseurs Markdown canoniques servent à réutiliser toutes les sections métier validées ; le petit convertisseur interne accepte uniquement titres, listes, paragraphes et tableaux. Il ne transforme jamais le HTML, les liens, images ou extensions fournis par le client en balises actives.
- `pdf-templates.ts` et `pdf-styles.ts` produisent couverture, sommaire à liens internes sans numéros inventés, chapitres A4 et styles print. La description de couverture est un extrait de 350 caractères maximum ; son intégralité reste dans le document. Aucun client ou entreprise n’est inventé : le schéma actuel ne possède pas de champ d’identité client dédié.
- `pdf-renderer.ts` est l’adaptateur Playwright isolé. Il ne connaît ni Prisma ni Auth.js ; son remplacement par un client de worker ne change pas les services métier.
- `pdf-export.ts` construit les réponses binaires privées et valide les paramètres. Le menu d’export conserve les choix Markdown et propose les PDF de la version affichée.

## Routes

- `GET /api/projects/:projectId/exports/pdf/brief/:briefId`
- `GET /api/projects/:projectId/exports/pdf/backlog/:backlogId`
- `GET /api/projects/:projectId/exports/pdf/project?briefId=...&backlogId=...`

Les identifiants sont explicites : aucune sélection silencieuse du dernier document. Dans la page backlog, le dossier utilise son brief source exact. Sur une page brief, le dossier indique « Backlog non disponible » si aucun backlog n’a été sélectionné ; il ne recherche pas arbitrairement un autre backlog. Les deux versions figurent en couverture et dans le nom de fichier. Une association incompatible est refusée (422).

Auth.js et les services existants imposent l’utilisateur, le projet propriétaire et l’appartenance de chaque document. Les noms sont ASCII, sans chemins ni caractères d’en-tête. Réponses : `application/pdf`, attachment, `private, no-store`, `nosniff`. Les erreurs ne révèlent aucun chemin, contenu sensible ou détail Chromium.

## Ressources et sécurité

- Deux rendus simultanés maximum par processus Node, un par propriétaire ; pas de file d’attente en mémoire. Les autres requêtes reçoivent 429. Plusieurs instances nécessiteront un ordonnanceur partagé dans le futur worker.
- 2 Mio de HTML, 8 Mio de PDF ; délai global de rendu 35 secondes, lancement 12 secondes, contenu 10 secondes. La fermeture est attendue dans `finally` avant libération de la capacité ; un lancement qui termine après expiration ferme aussi son navigateur.
- Chromium conserve sa sandbox (`chromiumSandbox: true`), sans `--no-sandbox`. JavaScript est désactivé, service workers bloqués, contexte hors ligne et toutes les requêtes interceptées/abandonnées. CSP restrictive ; aucun asset distant, aucune image ou police téléchargée. Le processus navigateur ne reçoit pas les variables applicatives ni leurs secrets.
- Les polices système Arial/sans-serif et les accents sont testés ; installer les mêmes polices sur les machines de production garantit la stabilité de mise en page.

## Hébergement

Ce module exige **Node.js et Chromium Linux avec sandbox opérationnelle** ; Edge est exclu. Ne pas considérer une fonction Vercel standard comme compatible par défaut. Le déploiement doit vérifier mémoire, taille de paquet, durée, polices et support du sandbox.

Installation sur un hôte Node compatible :

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install --with-deps chromium
pnpm build
pnpm start
```

La machine locale dispose déjà des dépendances système ; `playwright install chromium` et un rendu réel avec sandbox ont été vérifiés. Un chemin absolu vers un navigateur compatible peut être fourni via `PDF_CHROMIUM_EXECUTABLE_PATH` (configuration serveur uniquement) ; sinon Playwright utilise son Chromium installé.

Pour un hébergement conteneurisé, utiliser une image Playwright correspondant exactement à la version verrouillée (`mcr.microsoft.com/playwright:v1.64.1-noble`), un utilisateur **non root**, init, une mémoire partagée suffisante et un profil seccomp autorisant la sandbox Chromium. Vérifier avec les tests PDF réels dans l’image finale. Ne pas ajouter `--no-sandbox` pour contourner une erreur d’hébergement. Si l’hôte ne le permet pas, déplacer `renderPdf(html, ownerId)` vers un worker Node/Docker privé avec authentification, limites de capacité partagées et délais bornés ; ne jamais exposer une API publique acceptant une URL à imprimer.

## Vérification

```sh
pnpm lint
pnpm build
pnpm exec vitest run
node --test tests/pdf-exports.integration.test.mjs
MARKDOWN_VISUAL_TEST=1 node --test tests/markdown-exports.integration.test.mjs
```

Les intégrations utilisent PostgreSQL local, un serveur Next sur 3151 et un faux endpoint OpenAI sur 3152 dont le compteur doit rester nul. Elles nettoient leurs utilisateurs/projets, vérifient l’absence de mutation, produisent de vrais PDF, extraient le texte avec `pdftotext`, contrôlent A4/liens/pagination et téléchargent trois fichiers depuis le menu dans Chromium. `pdfinfo` et `pdftoppm` (Poppler) servent à la validation documentaire et visuelle. Les exemples utilisent seulement des données fictives.

Les fixtures et le rapport d’inspection figurent dans `docs/examples/pdf`. Les dates affichées proviennent des versions stockées, jamais de la date courante.
