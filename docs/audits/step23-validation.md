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

Le dépôt origin existant est `Clauphdurrel/briefpilot-ai` (public), accessible en SSH et désormais via GitHub CLI authentifié comme Clauphdurrel avec accès administrateur. Actions est activé. La branche main est conservée (commit initial 1c9fa76), sans reset ni merge automatique. Les branches develop (3b20cb5), feature/observability (db327d0) et chore/github-ci ont été publiées sans force push.

- PR observabilité : https://github.com/Clauphdurrel/briefpilot-ai/pull/2, vers develop.
- PR CI : https://github.com/Clauphdurrel/briefpilot-ai/pull/3, vers develop.
- Premier run : https://github.com/Clauphdurrel/briefpilot-ai/actions/runs/40142262118.

Le connecteur est toujours lié à Clauphy-work et avait rejeté la création avec 403 ; le rétablissement de GitHub CLI a permis de créer les deux PR. Le premier run a révélé un test Sentry dont le scénario SDK simulé activé héritait du drapeau E2E : ses drapeaux sont maintenant explicitement isolés dans ce seul scénario. Les 600 tests passent localement avec les variables exactes de protection CI, ainsi que lint et le build sous ces variables.

Une nouvelle révision relancera la CI. La réussite distante n'est pas encore déclarée. Les protections de branches sont documentées, sans modification distante à ce stade ; les PR ne sont pas fusionnées automatiquement. L'étape 24 n'est pas exécutée.

## Liens de reprise

- [Ouvrir la PR observabilité vers develop](https://github.com/Clauphdurrel/briefpilot-ai/compare/develop...feature/observability?expand=1)
- [Ouvrir la PR CI vers develop](https://github.com/Clauphdurrel/briefpilot-ai/compare/develop...chore/github-ci?expand=1)
- [Consulter Actions](https://github.com/Clauphdurrel/briefpilot-ai/actions)

Les PR existent désormais aux URLs #2 et #3 ci-dessus. Ces liens de comparaison restent disponibles pour consulter leurs différences. L'ouverture de la PR CI déclenchera le workflow si GitHub Actions est activé pour le dépôt. Ne déclarer sa réussite qu'après lecture des cinq résultats.
