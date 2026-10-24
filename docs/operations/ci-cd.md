# CI GitHub — étape 23

## Fonctionnement

`.github/workflows/ci.yml` déclenche cinq jobs sur PR vers `develop`/`main`, push sur ces branches et lancement manuel. Les branches de fonctionnalité ne déclenchent pas un second pipeline de push. Une nouvelle révision annule les exécutions obsolètes de la même PR/branche. Aucun déploiement n'est configuré.

| Job obligatoire | Contrôles |
| --- | --- |
| quality | Installation verrouillée, génération et validation Prisma, ESLint, build Next.js et contrôle TypeScript |
| unit | Vitest avec rapport JUnit, fournisseurs simulés |
| database | PostgreSQL temporaire, migrations sur bases neuves, concurrence/idempotence/quotas/ownership et parcours HTTP/navigateur |
| e2e | PostgreSQL temporaire, Chromium et 9 parcours sur desktop/tablette/mobile |
| security | `pnpm audit --audit-level=high`, échec sur avis high/critical et erreurs de registre |

`quality` construit une seule fois l'application. Une archive de `.next` sans cache est transférée aux jobs database/e2e du même run, conservée 1 jour. Le rapport unitaire et les captures/traces E2E en cas d'échec sont conservés 7 jours ; toutes les données sont synthétiques. Restreindre l'accès aux artifacts du dépôt privé. Les jobs n'écrivent aucun rapport dans une PR avec un jeton privilégié.

## Versions et permissions

Node vient de `.nvmrc` (24.18.0), pnpm de `packageManager` (11.9.0), installation `--frozen-lockfile`. L'action locale `.github/actions/setup` active Corepack, configure le cache pnpm et génère Prisma. Les actions officielles checkout/setup-node/upload-artifact/download-artifact sont fixées à des SHA complets vérifiés dans leurs dépôts officiels le 24 octobre 2026. PostgreSQL 16-bookworm est fixé par digest d'image officiel. Mettre à jour ces références par PR avec lecture des changements et exécution CI.

Le workflow utilise uniquement `contents: read`, checkout sans persistance des credentials, des runners GitHub éphémères Ubuntu 22.04, aucun `pull_request_target` et aucune commande de déploiement. Le cache des dépendances ne contient ni `.env` ni données PostgreSQL. [Recommandations de sécurité GitHub](https://docs.github.com/en/actions/reference/security/secure-use), [setup-node](https://github.com/actions/setup-node), [upload-artifact](https://github.com/actions/upload-artifact).

## Données et services simulés

**Aucun secret GitHub n'est nécessaire à cette CI.** Les variables du workflow sont des valeurs publiques de test, y compris le mot de passe de PostgreSQL jetable. Ne pas ajouter de DATABASE_URL de production, de clé OpenAI, de secret OAuth réel ou Lemon Squeezy, ni de token Sentry/PostHog.

Chaque job DB a son propre service PostgreSQL. Les harnesses `test-database.mjs`/`test-e2e-server.mjs` créent une nouvelle base `briefpilot_test_<UUID>`, appliquent les migrations avec `prisma migrate deploy` et suppriment uniquement cette base en finally. Les tests exigent une URL locale ; ils n'utilisent ni migrate reset, ni db push, ni base distante. Le rôle CI doit pouvoir créer/supprimer ses bases. Un échec ou kill du runner reste contenu dans le service éphémère.

Les fournisseurs OpenAI/Lemon Squeezy sont simulés localement ; les sessions utilisateurs sont créées en base de test, sans compte Google réel et sans bypass d'authentification dans l'application. Sentry/PostHog restent désactivés et les modes de test empêchent les envois distants. Le monitoring IA est activé uniquement par certains tests sur leurs propres fixtures.

Chromium s'installe via `pnpm exec playwright install --with-deps chromium`. Les helpers navigateur utilisent le navigateur fourni par Playwright. Les tests PDF conservent `chromiumSandbox: true` et doivent tourner sans root. Ne pas désactiver la sandbox PDF pour contourner un runner incompatible ; corriger son environnement. Les anciens helpers CDP de test utilisent leur contexte de test éphémère avec `--no-sandbox` ; ils ne sont jamais utilisés par le renderer PDF de l'application.

## Validation locale

```bash
corepack enable
corepack prepare pnpm@11.9.0 --activate
pnpm install --frozen-lockfile
pnpm prisma generate
pnpm prisma validate
pnpm lint
pnpm build
pnpm exec vitest run
pnpm exec playwright install --with-deps chromium
pnpm test:integration
pnpm exec playwright test
pnpm audit --audit-level=high
```

Configurer une DATABASE_URL locale avec un rôle autorisé à créer une base. Ne jamais lancer build, intégration et E2E simultanément : les suites démarrent des serveurs sur des ports fixes et réutilisent le build. Les deux jobs GitHub sont isolés et peuvent tourner simultanément. `actionlint .github/workflows/ci.yml` valide statiquement le workflow. Le build doit être exécuté dans un environnement qui autorise les sous-processus et sockets locaux de Turbopack.

La suite d'export PDF écrit des exemples dans `docs/examples/pdf` : sur le checkout CI éphémère cela n'est pas conservé ; localement sauvegarder/restaurer ces fichiers si l'on souhaite éviter les différences binaires.

## Publication et protections

Conserver `origin` existant : `Clauphdurrel/briefpilot-ai`. Ne pas pousser les notes personnelles non suivies. Vérifier l'historique avant le premier push : la session a comparé les valeurs secrètes locales avec les blobs Git et recherché des formats usuels de clés ; un seul match de motifs correspond au test de rejet de clés synthétiques connu. Ce contrôle limité ne garantit pas l'absence de tout secret imaginable. Aucun fichier `.env` réel n'apparaît dans l'historique vérifié.

La branche `main` distante existante n'est ni réinitialisée ni fusionnée automatiquement. `develop` peut être initialisée depuis la base validée de l'étape 21 (3b20cb5) ; publier `feature/observability` puis `chore/github-ci`, créer les PR vers develop et les intégrer dans cet ordre après revue. La seconde branche inclut l'étape 22 ; sa PR restera cumulative jusqu'à intégration de la première. Ne pas forcer de push.

Après le premier pipeline vert, dans Settings → Rules → Rulesets, cibler séparément main/develop : PR obligatoire, contrôles `quality`, `unit`, `database`, `e2e`, `security` obligatoires, pas de suppression ni force push. Exiger un reviewer seulement si un second reviewer est disponible. Adapter aux possibilités du plan GitHub et tester le blocage d'une PR avec contrôle échoué. Aucune protection distante ne doit être annoncée active sans lecture de sa configuration.

## Revue et exceptions

Revue manuelle avec le skill local `review-code` contre develop. Aucun appel automatique à une API Codex/OpenAI et aucune clé additionnelle ne sont nécessaires. Pour un avis sécurité high/critical : corriger et retester ; ne pas ajouter continue-on-error. Toute exception doit être justifiée dans une PR, limitée à l'avis exact, avec responsable et date d'expiration ; aucune exception n'est actuellement configurée. Une indisponibilité du registre échoue le job et nécessite une relance après vérification.

## Critère de fin

Une réussite locale ou actionlint ne valide pas une exécution GitHub. Enregistrer l'URL de la PR, le SHA et le run Actions avec les cinq jobs réussis. Tant que ces preuves sont absentes, l'étape 23 est préparée mais sa validation distante reste en attente. L'étape 24 (hébergement/déploiement) n'est pas exécutée par ces workflows.
