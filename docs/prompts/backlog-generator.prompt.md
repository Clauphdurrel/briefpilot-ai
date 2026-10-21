# BacklogGeneratorAgent

Le prompt exécuté est défini dans `src/server/prompts/backlog-generator.ts` (source unique). Il confie à l’agent les rôles de Software Architect, Technical Lead et Product Owner.

## Contrat métier

Transformer le cahier des charges sélectionné en phases Foundation, MVP, V1 et Future, épics, user stories et tâches petites, isolées et testables. Une tâche correspond à une PR. Respecter les exigences confirmées et le périmètre exclu ; ne pas inventer de stack ni de besoins métier.

Chaque élément précise sa base (`confirmed`, `assumed`, `recommended`) et les identifiants de fonctionnalités sources. Les recommandations métier restent hors du MVP obligatoire, avec priorité P1/P2 et phase V1/Future. Les fondations purement techniques sans source restent des recommandations de phase Foundation. Toute fonctionnalité MUST confirmée doit être couverte par une tâche confirmée.

Chaque tâche comporte rôle, priorité, complexité XS/S/M/L/XL, fourchette d’effort indicative ou `null`, justification, dépendances, critères observables, tests, contraintes, risques et fichiers hypothétiques. Un effort n’est jamais un budget ou un engagement contractuel.

Les références, rattachements, cycles (y compris les liens parentaux), phases des dépendances et sources sont vérifiés par le serveur. Les informations manquantes et hypothèses du brief sont conservées. Les données du projet ne sont jamais traitées comme des instructions système.

## Prompts Codex

L’agent propose un champ `codexPrompt`. Le serveur le remplace par un texte déterministe issu de `src/server/formatters/codex-task.ts`, comprenant contexte, objectif, rôle, prérequis, dépendances, décisions à confirmer, contraintes, risques, fichiers à vérifier, livrables, critères et tests. Ce texte exige la lecture d’AGENTS.md, l’examen du repository et le respect de l’architecture et du périmètre de la tâche. Il n’est pas exécuté automatiquement.

Les données d’entrée et les livrables sont contrôlés contre des formats courants d’identifiants sensibles (clés API, clés privées, mots de passe explicites, URL de base avec identifiants). Cette détection par motifs ne remplace pas une relecture humaine.

Exemples validés et utilisés dans les tests :

- `backlog-generator.input.example.json` : projet et cahier des charges restaurant incomplet.
- `backlog-generator.example.json` : épic disponibilités, story gestionnaire, tâche backend et tâche QA dépendante, sans stack imposée.
