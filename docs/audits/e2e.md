# Parcours E2E reproductibles

La configuration Playwright exécute huit parcours sur Chromium desktop (1440 px), tablette (768 px) et mobile (375 px), avec un seul worker : session et déconnexion, création/isolation projet, interview persistante, brief brouillon, backlog sourcé, téléchargements Markdown/PDF, quota Free/archivage et abonnement Lemon Squeezy simulé. Les sessions Auth.js sont de véritables lignes PostgreSQL ; aucun contournement d’authentification n’est ajouté à l’application. Google OAuth externe reste à vérifier manuellement.

## Exécution

Utiliser Node indiqué par `.nvmrc`, installer avec `pnpm install --frozen-lockfile`, générer Prisma puis construire l’application. Chromium Playwright et ses dépendances système doivent être présents avec sandbox opérationnelle. Le serveur PostgreSQL local doit permettre au rôle de créer une base. Ne pas lancer plusieurs builds ou suites utilisant les ports 3181/3182 en même temps.

```sh
pnpm prisma generate
pnpm build
pnpm exec playwright test
```

`DATABASE_URL` doit viser exclusivement localhost, 127.0.0.1 ou ::1. Le harness crée une nouvelle base `briefpilot_test_<uuid>`, applique les migrations versionnées avec `migrate deploy`, lance Next et les fournisseurs simulés sur loopback, puis arrête les processus et supprime uniquement la base qu’il vient de créer. La base de développement n’est jamais utilisée par les fixtures. Un fichier temporaire de permissions 0600 transmet uniquement le nom aléatoire, sans secret. Les erreurs du serveur ne publient pas les chaînes de connexion.

Les sorties et traces restent sous `/tmp/briefpilot-playwright-results`. Elles contiennent uniquement des comptes et projets fictifs. Une interruption brutale SIGKILL peut laisser une base de test ; retrouver son nom exact et confirmer sa provenance avant toute suppression manuelle. Aucun nettoyage par préfixe ni suppression de base existante n’est effectué.

La configuration `webServer.gracefulShutdown` envoie SIGTERM avec dix secondes de délai pour permettre le nettoyage du runner. Le comportement SIGKILL par défaut de Playwright ne permet pas au bloc `finally` de supprimer la base ; ne pas retirer cette option. Une panne de l'hôte ou un SIGKILL externe peuvent toujours interrompre ce nettoyage.

## Isolation fournisseurs

OpenAI Responses et Lemon Squeezy utilisent un serveur HTTP de simulation local. Un preload chargé exclusivement dans le processus Next de test redirige les origines officielles ; il n’est importé par aucun module applicatif. Aucun endpoint de contrôle simulé n’est exposé par l’application. Le navigateur intercepte la navigation checkout avant accès externe et refuse toute autre requête hors loopback ; le preload serveur refuse aussi les origines externes restantes. Le webhook signé parcourt réellement le handler applicatif et synchronise les droits à partir du faux fournisseur ; un retour avec `plan=AGENCY` est vérifié sans activation.

Ces tests complètent les suites unitaires et HTTP existantes. Ils ne prouvent pas la disponibilité de Google, OpenAI, Lemon Squeezy, d’un hébergement de production ou d’un lecteur d’écran. Le PDF utilise réellement Chromium, pas un fichier factice.

Le scénario d'interview avance de quatre secondes la date du seul registre système créé dans sa fixture pour simuler la lecture de la première question. Le cooldown de trois secondes reste actif dans le service de production et testé par les intégrations ; aucun bypass ni variable de désactivation n'est ajouté à l'application. Le test de quota cible l'alerte par son texte pour la distinguer de l'annonceur de navigation Next. Le scénario backlog attend explicitement l'apparition du bouton puis l'ouverture du panneau aux tailles compactes ; un simple `isVisible()` ponctuel ne doit pas permettre de sauter cette action pendant le streaming Next.

Campagne finale du 24 octobre 2026 : **24 tests réussis en 32,0 secondes**, sans retry, échec ou scénario ignoré. Après terminaison du runner : manifeste supprimé et zéro base `briefpilot_test_*` restante, confirmé en lecture seule via PostgreSQL. Le test de création couvre aussi la lisibilité du titre et l'absence de débordement après correction du détail projet sur tablette. Résultats globaux et limites : `step20-final-report.md`.

## Campagne d’intégration isolée

```sh
pnpm build
node scripts/test-integration.mjs
```

Ce runner réutilise `withIsolatedDatabase` de `scripts/test-database.mjs` : nouvelle base locale, migrations et suppression exclusive de cette base en `finally`. Il active les tests PostgreSQL opt-in (quotas, facturation et lecture de l’historique avec pool à une connexion), puis les intégrations Auth/dashboard/projets/sécurité sur le serveur 3109. Il arrête ce serveur avant d’exécuter séquentiellement les suites auto-hébergées interview, briefs, backlogs, Markdown, PDF, quotas et Lemon Squeezy. Les quatre options visuelles sont activées. Les ports 3109–3172 doivent être disponibles.

`NODE_OPTIONS` charge dans les sous-processus de test un filtre `fetch` exclusivement loopback. Les faux fournisseurs des suites existantes restent utilisables, tandis qu’une tentative de requête HTTP externe échoue. Les clés OAuth/IA sont fictives ; la télémétrie Next est désactivée. Ce filtre de test n’est jamais importé en production. Les tests PDF existants régénèrent leurs exemples fictifs versionnés : vérifier leur diff et restaurer ces seules sorties si aucune évolution documentaire n’est voulue.

Une interruption gracieuse termine les commandes actives et passe par le nettoyage ; SIGKILL ou l’arrêt brutal de l’hôte ne permet aucune garantie de nettoyage. Ne jamais utiliser de commande destructive globale contre toutes les bases portant un préfixe.
