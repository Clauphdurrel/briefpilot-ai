# Étape 22 — validation locale

Validation le 24 octobre 2026, branche feature/observability.

## Livré

- Instrumentation des services critiques, corrélation AsyncLocalStorage, logs Pino filtrés et erreurs Sentry dédupliquées dans une requête.
- PostHog serveur : événements métier, identités HMAC, consentement enregistré et révocable dans les réglages, suppression des propriétés sensibles, délai borné.
- Monitoring IA existant raccordé aux opérations ; prix versionnés vérifiés, coûts inconnus conservés comme inconnus, séparation des quotas.
- GET /api/health minimal, rapport agrégé IA et purge explicite avec dry-run.
- Trois guides opérateur : observabilité, incidents et coûts IA. Aucun changement de schéma nécessaire.

## Vérifications

| Contrôle | Résultat |
| --- | --- |
| Prisma validate | Réussi |
| TypeScript | Réussi |
| ESLint | Réussi |
| Build Next.js production via Node 24 | Réussi |
| Vitest unitaire | 600 réussis ; 38 tests PostgreSQL volontairement exclus de cette commande |
| PostgreSQL temporaire, migrations et concurrence | 38 réussis, dont 5 observabilité et 1 transition analytics d'abonnement |
| Intégration HTTP/navigateur | 95 réussis |
| Playwright desktop/tablette/mobile | 27 réussis, dont consentement et révocation |
| git diff --check | Réussi |

Total : 760 exécutions de tests réussies, avec recouvrement volontaire des parcours. Les bases jetables sont créées/migrées/supprimées par les harnesses ; aucune base utilisateur n'est réinitialisée. Les exemples PDF réécrits par les tests ont été restaurés. Les fournisseurs externes sont simulés. Un test utilise le SDK PostHog réel avec transport simulé et vérifie le message transmis sans contenu sensible.

Le lanceur pnpm du contexte restreint a rencontré un refus de socket Turbopack ; l'exécution directe `node node_modules/next/dist/bin/next build` autorisée a réussi. Les sorties locales sont dans `/tmp/briefpilot-step22-{build,integration,e2e}.log` et ne sont pas des preuves CI distantes durables.

## Revue finale

Aucun blocage identifié dans le périmètre livré. La revue a corrigé le format d'identité transmis au SDK PostHog, préservé les arguments optionnels des services et déplacé la détection de transition d'abonnement sous verrou transactionnel. Les tests vérifient les pannes de télémétrie, les données sensibles, les timeouts à coût inconnu et la comptabilisation unique des quotas.

## Limites d'exploitation

- Alertes réellement configurées et vérifiées dans les comptes distants : **0**. Les règles et seuils à créer manuellement sont documentés ; aucune réception distante n'est revendiquée.
- Sans outbox, les analytics restent best effort ; les UUID permettent la déduplication d'ingestion mais pas une livraison garantie.
- La sonde publique vérifie la liveness uniquement. Les performances sont mesurées dans les logs, sans tracing ni profiling distant.
- La purge IA n'est pas planifiée automatiquement. Rétention des logs hébergeur et des outils distants à définir côté opérateur.

Prochaine étape : CI GitHub (étape 23), sans déploiement.
