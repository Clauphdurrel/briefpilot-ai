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

Le dépôt origin existant est `Clauphdurrel/briefpilot-ai`, accessible en SSH. Sa branche main est conservée (commit initial 1c9fa76), sans reset ni merge automatique. Une base develop issue de la validation sécurité 3b20cb5 permet des PR successives observabilité puis CI.

La connexion API disponible affiche encore Clauphy-work, sans accès au dépôt ; gh renvoie 401. La reconnexion demandée à l'utilisateur est en attente. Tant que cet accès n'est pas établi, la création des PR, les runs Actions et les protections ne sont pas vérifiés. Aucun résultat GitHub vert n'est revendiqué. L'étape 23 ne peut être déclarée terminée sans une PR et ses cinq jobs réussis.

Prochaine action : vérifier la connexion du compte ayant accès au dépôt, ouvrir les PR vers develop, contrôler les cinq jobs du SHA publié, puis protéger les branches selon le guide. Ne pas passer au déploiement (étape 24) dans cette tâche.
