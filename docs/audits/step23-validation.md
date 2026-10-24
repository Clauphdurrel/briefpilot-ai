# Étape 23 — CI GitHub

## Livrables

- `.github/workflows/ci.yml` : cinq jobs quality/unit/database/e2e/security, permissions minimales, SHA des actions et digest PostgreSQL verrouillés, artifacts temporaires, aucun déploiement.
- `.github/actions/setup/action.yml` : Node 24.18.0, pnpm 11.9.0, cache et installation frozen-lockfile.
- Quatre helpers navigateur de test adaptés au Chromium Playwright installé sur le runner.
- `docs/operations/ci-cd.md` : variables synthétiques, isolation des bases, règles de sécurité, procédure de publication, revue et protections GitHub.

## Validation locale

- ESLint, TypeScript et actionlint 1.7.9 : réussis.
- 600 tests unitaires réussis avec la commande et le format JUnit prévus en CI.
- Build de production et Prisma : validés à l'étape 22 sur le même code applicatif. L'étape 23 ne modifie pas l'application.
- 27 E2E desktop/tablette/mobile réussis à l'étape 22 sur le même code et les mêmes fixtures E2E.
- La campagne complète relancée avec Chromium Playwright portable réussit : 38 tests PostgreSQL et 95 tests HTTP/navigateur. Les exemples PDF écrits par cette campagne ont été restaurés.
- `pnpm audit --audit-level=high` : aucune vulnérabilité connue au 24 octobre 2026 ; aucune exception configurée.
- L'historique Git a été analysé pour les formats usuels de clés et comparé aux secrets locaux sans en afficher les valeurs. Un motif synthétique dans le test de rejet de credentials est identifié et exclu précisément ; aucune autre détection. Ce contrôle n'est pas un certificat d'absence de tout secret.

## Validation distante

Le dépôt origin existant est `Clauphdurrel/briefpilot-ai`, accessible en SSH. Sa branche main est conservée (commit initial 1c9fa76), sans reset ni merge automatique. Les branches develop (3b20cb5), feature/observability (db327d0) et chore/github-ci (83e1dfc, suivi du présent rapport) ont été publiées sans force push. Elles permettent des PR successives observabilité puis CI.

La connexion API disponible affiche encore Clauphy-work, sans accès au dépôt ; gh renvoie 401. Une tentative effective de création de la PR observabilité vers develop a été rejetée par GitHub avec **403 Resource not accessible by integration**. Aucun numéro de PR n'a été retourné. La reconnexion demandée à l'utilisateur est en attente. La création des PR, les runs Actions et les protections ne sont donc pas vérifiés. Aucun résultat GitHub vert n'est revendiqué. L'étape 23 ne peut être déclarée terminée sans une PR et ses cinq jobs réussis.

Prochaine action : vérifier la connexion du compte ayant accès au dépôt, ouvrir les PR vers develop, contrôler les cinq jobs du SHA publié, puis protéger les branches selon le guide. Ne pas passer au déploiement (étape 24) dans cette tâche.

## Liens de reprise

- [Ouvrir la PR observabilité vers develop](https://github.com/Clauphdurrel/briefpilot-ai/compare/develop...feature/observability?expand=1)
- [Ouvrir la PR CI vers develop](https://github.com/Clauphdurrel/briefpilot-ai/compare/develop...chore/github-ci?expand=1)
- [Consulter Actions](https://github.com/Clauphdurrel/briefpilot-ai/actions)

Ces liens ouvrent le formulaire de création ; ils ne représentent pas des PR déjà créées. L'ouverture de la PR CI déclenchera le workflow si GitHub Actions est activé pour le dépôt. Ne déclarer sa réussite qu'après lecture des cinq résultats.
