# Interface de cadrage et suivi du projet

## Écran et données

La page d’interview conserve l’authentification et le contrôle du propriétaire existants. Sur ordinateur (à partir de 1280 px), elle présente le contexte/navigation, la conversation et le suivi du brief. Sur mobile, la conversation est prioritaire ; les boutons « Projet et navigation » et « Suivi du projet » donnent accès aux panneaux secondaires.

`InterviewChat` réutilise les endpoints d’interview et le bouton de génération du brief existants. `InterviewProgress`, `InterviewSummary` et `ProjectContentChecklist` isolent les panneaux réutilisables. Les fonctions de présentation et de sérialisation vivent dans `src/lib/interview-presentation.ts`.

L’état d’interview expose désormais un champ additionnel optionnel `analysis`, issu de la dernière analyse valide enregistrée dans `InterviewMessage.metadata`. Aucun ledger technique, modèle interne ou secret n’est exposé. Les anciens états sans ce champ restent acceptés. Les agents, leurs prompts, les modèles Prisma et les règles serveur de complétude restent inchangés.

Le pourcentage affiché est exclusivement le `completionScore` serveur. Les catégories reprennent la couverture enregistrée, sans recalculer de pourcentage dans React. Le schéma actuel distingue `missing`, `partial`, `confirmed` mais pas un statut « non applicable » : l’interface invite l’utilisateur à le préciser dans sa réponse et n’ajoute aucune pénalité locale. Le score n’est pas présenté comme une garantie d’exhaustivité.

Le résumé distingue informations collectées, hypothèses et manques. Les informations collectées restent une synthèse de l’assistant à relire ; la prochaine clarification et son éventuelle aide proviennent de `nextQuestion` enregistré. Le contrat ne contient pas d’options de réponse : aucune liste métier fictive n’est générée. La réponse rapide « Je ne sais pas encore » ne peut pas effacer une saisie existante.

## Conversation et reprise

- Entrée envoie la réponse, Maj + Entrée insère une ligne ; la composition IME ne déclenche pas l’envoi.
- Un verrou client par référence et les boutons désactivés évitent les doubles soumissions ; les protections serveur restent en place entre onglets.
- Les identifiants idempotents sont conservés en cas d’échec. La réponse et la fiche de contenu ne sont effacées qu’après succès validé ou récupération d’un échange effectivement enregistré.
- « Reprendre l’interview » recharge l’historique par GET sans appel IA. Les échanges envoyés survivent au rechargement. La saisie non envoyée reste en mémoire dans cet onglet et n’est pas persistée après rechargement ; cela est indiqué dans le champ.
- L’historique défile vers une réponse locale ou lorsque le lecteur est déjà en bas. Une arrivée distante pendant la lecture d’anciens messages laisse la position intacte et propose « Voir les nouveaux messages ».
- Un message peut être copié ; si le presse-papiers est indisponible, une indication invite à sélectionner le texte.
- Les erreurs de session, projet, quota, timeout, conflit et réseau affichent une consigne compréhensible sans reprendre les détails techniques inconnus du serveur.

La génération du brief conserve le service existant, le consentement explicite au brouillon et la redirection. Le chat est bloqué pendant la génération du brief et le bouton de brief pendant un échange de chat pour éviter des opérations concurrentes depuis cet écran.

## Fiches de contenu et futurs uploads

L’utilisateur peut identifier un contenu demandé/proposé et déclarer son nom, statut (`available`, `missing`, `not_applicable`), importance, description et éventuel lien http/https sans identifiants. L’interface n’impose pas automatiquement de logo, photos ou documents et ne déduit pas leur disponibilité de la seule couverture du sujet « contenus ».

La fiche est préparée puis envoyée explicitement avec la réponse par l’endpoint existant. Elle est sérialisée dans un bloc `[Contenu projet]` du message utilisateur et validée avant d’être reconnue par le lecteur. Son texte reste disponible au même titre qu’une réponse pour les agents suivants. Le lecteur et la copie proposent une représentation lisible plutôt que le JSON technique. Pour chaque nom normalisé, la dernière déclaration utilisateur est retenue ; les déclarations de l’assistant ne modifient pas la checklist. Les contenus ne sont affichés comme enregistrés qu’une fois la réponse persistée.

Aucun fichier n’est transmis, chargé, téléchargé par le serveur ou stocké publiquement. Les liens sont des références fournies par l’utilisateur, ouvertes seulement à son initiative. Un futur service de stockage privé pourra remplacer ces références par des identifiants d’assets avec permissions, validation de type/taille et contrôle d’accès ; il devra conserver les déclarations de contenu séparément de la présence réelle d’un fichier.

## Tests et vérification manuelle

Avec Node 24 et la base de développement :

```bash
pnpm test
pnpm lint
pnpm build
INTERVIEW_VISUAL_TEST=1 node --test tests/interview.integration.test.mjs
BRIEF_VISUAL_TEST=1 node --test tests/briefs.integration.test.mjs
```

Les tests Chrome utilisent les serveurs Next et fournisseurs IA locaux simulés existants, sans crédits OpenAI. Ils vérifient le clavier, la prévention des doubles envois, une erreur simulée sans fuite, une reprise sans POST, la réutilisation de la clé de requête, la copie réelle, la déclaration d’un contenu, la conservation après rechargement, les panneaux mobiles et l’absence de débordement à 375/1440 px. Les tests unitaires vérifient les états vides, l’analyse additionnelle, les catégories/score, les hypothèses/manques, les liens et la sérialisation des contenus.

Pour une vérification réelle, configurer le service OpenAI côté serveur, ouvrir un projet, démarrer/reprendre l’interview, envoyer une réponse avec Entrée, ouvrir « Suivi du projet », préparer une fiche de contenu puis l’envoyer. Rafraîchir pour retrouver les échanges et la fiche. Générer un brouillon de cahier des charges si l’interview est incomplète. Aucun fichier n’est uploadé et aucun prompt Codex n’est exécuté.
