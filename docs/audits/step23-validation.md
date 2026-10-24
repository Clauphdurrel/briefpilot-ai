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

## Validation distante réussie

Validation le 24 octobre 2026 dans le dépôt public `Clauphdurrel/briefpilot-ai`. Connexion GitHub CLI vérifiée comme Clauphdurrel ; Actions activé. Les branches develop (base sécurité 3b20cb5), feature/observability (db327d0) et chore/github-ci sont publiées sans force push. La branche main existante (1c9fa76) est conservée.

- [PR observabilité #2](https://github.com/Clauphdurrel/briefpilot-ai/pull/2), vers develop.
- [PR CI #3](https://github.com/Clauphdurrel/briefpilot-ai/pull/3), vers develop.
- [Run entièrement réussi 40142732221](https://github.com/Clauphdurrel/briefpilot-ai/actions/runs/40142732221), événement pull_request, SHA `4e690cbe378460cf1fcd014d6add1c2dbbe283b5`, statut completed/success vérifié par API.

| Job GitHub | Résultat confirmé |
| --- | --- |
| quality | Installation verrouillée, génération/validation Prisma, ESLint et build réussis |
| unit | 600 tests réussis, 38 tests PostgreSQL exclus de cette commande puis exécutés dans database ; rapport JUnit publié |
| database | 38 tests PostgreSQL et 95 tests HTTP/navigateur réussis, migrations sur base neuve, inspections PDF réelles |
| e2e | 27 tests desktop/tablette/mobile réussis |
| security | Audit pnpm réussi sans vulnérabilité connue |

Total : 760 exécutions de tests réussies avec recouvrement volontaire de certains parcours. Les huit suites HTTP/navigateur comptent 35 + 7 + 8 + 8 + 7 + 12 + 7 + 11 tests, toutes sans échec. Les logs de jobs GitHub ont été lus, pas seulement le statut global.

Les premiers runs ont permis de corriger deux différences avec l'environnement local : isoler les drapeaux E2E du scénario Sentry dont le SDK est simulé, et installer poppler-utils pour pdftotext/pdfinfo. Aucun test n'est désactivé pour obtenir le résultat vert. La présente mise à jour documentaire est publiée après ce run ; les nouveaux commits de la PR déclenchent à nouveau les mêmes contrôles.

## Revue et suites

Revue du périmètre CI selon review-code : actions officielles verrouillées, jeton contents:read, aucun secret de production ni déploiement, bases jetables, sandbox PDF conservée, artifacts synthétiques adaptés au dépôt public. Aucun problème bloquant restant identifié dans ce périmètre.

Les PR restent ouvertes ; aucune fusion automatique n'a été effectuée. Intégrer après revue l'observabilité puis la CI, puis activer les protections documentées dans [ci-cd.md](../operations/ci-cd.md). Attendre l'intégration des deux PR avant d'exiger les jobs sur develop : la PR initiale d'observabilité ne contient pas encore de workflow.

Les protections ne sont pas modifiées à distance dans cette tâche (lecture des rulesets : liste vide). Les alertes Sentry/PostHog restent à configurer et tester manuellement selon le guide d'observabilité. Le connecteur GitHub reste lié à Clauphy-work, mais GitHub CLI fournit l'accès utilisé pour cette livraison. L'étape 24 (hébergement/déploiement) n'est pas exécutée.
