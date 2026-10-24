# Runbook technique

## Runtime et PDF

Utiliser Node 24.18.0 et pnpm 11.9.0. Installer les dépendances avec le lockfile versionné, générer Prisma puis construire Next. PostgreSQL 16 est utilisé par les tests locaux. En production, appliquer les migrations existantes avec `pnpm db:deploy`, jamais `migrate dev`, `db push --force-reset` ou suppression de volume.

Le rendu PDF requiert Chromium Playwright et ses bibliothèques système. `pnpm exec playwright install chromium` installe le navigateur ; l'installation de ses dépendances système relève de l'image ou de l'administrateur de l'hôte. Le service doit tourner sous un compte non root avec sandbox opérationnelle. `PDF_CHROMIUM_EXECUTABLE_PATH` peut désigner un binaire préinstallé compatible. Ne pas désactiver la sandbox pour contourner une erreur de lancement.

Le rendu est hors réseau, sans JavaScript ni héritage des secrets applicatifs, limité à deux exports simultanés par processus et un par propriétaire. Un déploiement à plusieurs instances doit prévoir des limites d'entrée partagées. Tester le rendu sur l'hébergement choisi : un build Next réussi ne prouve pas la compatibilité Chromium d'un runtime Vercel ou serverless. Prévoir un conteneur ou un service de rendu adapté si nécessaire.

## Sauvegarde et restauration

Avant une migration de production, effectuer une sauvegarde PostgreSQL chiffrée ou utiliser un snapshot géré avec restauration à un instant donné. Ne pas enregistrer d'URL contenant un mot de passe dans les logs ni dans le dépôt. Fournir les accès via la configuration sécurisée de PostgreSQL (`PGSERVICE`, fichier de mots de passe de permissions 0600 ou gestionnaire de secrets).

Exemple avec des services PostgreSQL configurés par l'opérateur :

```sh
pg_dump --dbname=service=briefpilot_backup --format=custom --file=/chemin/securise/briefpilot.dump
pg_restore --list /chemin/securise/briefpilot.dump
pg_restore --dbname=service=briefpilot_restore_test --no-owner --no-acl /chemin/securise/briefpilot.dump
```

Le service `briefpilot_restore_test` doit viser une **nouvelle base dédiée vide**, créée pour cet exercice ; ne jamais restaurer cet exemple sur la base active. Vérifier les comptes, projets, versions, abonnements et compteurs sur cette copie sans connecter les fournisseurs réels. Consigner la date, la durée et le résultat ; appliquer la politique de conservation et d'accès aux sauvegardes. Aucune restauration réelle n'a été effectuée lors de l'étape 20.

## Déploiement et incidents

1. Vérifier lint, build, tests, audit des dépendances et rapport de préproduction.
2. Définir les variables d'environnement de l'environnement cible, des clés distinctes et une origine HTTPS correcte. Configurer Google et les webhooks pour cette origine.
3. Sauvegarder, appliquer les migrations additives et démarrer la version construite. Une évolution de schéma nécessite une revue de compatibilité avec la version précédente avant tout retour arrière applicatif.
4. Vérifier connexion, isolation des projets, générations, PDF et facturation sandbox. La boutique actuelle et son code restent en mode test ; le mode commercial réel exige un travail distinct.
5. En cas d'erreur, utiliser des codes assainis et des identifiants de corrélation, jamais les prompts, réponses, sessions ou clés. La livraison à Sentry/PostHog doit faire l'objet de sa validation propre à l'étape 22.

Un webhook qui échoue doit pouvoir être renvoyé depuis la boutique après résolution ; ne pas attribuer manuellement un plan sur la seule base d'un retour de checkout. Vérifier les résultats ignorés et l'état distant. Les tests de l'étape 20 simulent les fournisseurs et ne valident ni les comptes externes, ni les sauvegardes ou alertes de production.

## Données envoyées à l'IA

Limiter les informations client à celles nécessaires au brief. Ne pas saisir de clés, mots de passe, données de carte ou données personnelles inutiles dans les descriptions/interviews ; les passages sélectionnés sont transmis au fournisseur IA. `store: false`, les filtres d'export et l'absence de contenu dans les logs ne constituent pas une détection exhaustive des secrets ni une garantie d'anonymisation du texte saisi. Vérifier les conditions de traitement et de conservation du fournisseur pour le compte utilisé avant ouverture aux clients.

## Protections de l'étape 21

- Créer les fichiers d'environnement avec `umask 077` ou appliquer `chmod 600 .env` après copie. Vérifier le propriétaire du compte de service et les permissions dans chaque environnement. Les fichiers `.env.*` sont ignorés par Git, sauf `.env.example` ; cela ne remplace pas un scan d'historique ni la révocation d'un secret déjà publié.
- Auth.js utilise un logger complet à codes fixes : aucune cause, stack, adresse, session, argument adaptateur ou métadonnée OAuth n'est transmis. Les erreurs Auth.js des Server Actions reviennent vers des messages de connexion fixes. Ne pas rétablir le logger brut pour diagnostiquer un incident ; utiliser les codes autorisés et la reproduction locale avec données fictives.
- Les corps JSON privés sont limités à 20 000 octets, les webhooks à 256 000 et les réponses Lemon Squeezy à 512 000. La limite s'applique au flux avant concaténation, sans confiance dans `Content-Length`. Un flux non terminé est annulé après dix secondes ; les erreurs publiques restent assainies. Le webhook conserve ses octets exacts pour la vérification HMAC.
- Ces limites commencent lorsque le handler lit le corps. Elles ne remplacent pas les délais d'en-tête, limites de connexions, taille des Server Actions, protection des endpoints Auth.js et rate limiting partagé du proxy/hébergeur. Vérifier ces paramètres sur la cible de déploiement, y compris en présence de plusieurs instances.
