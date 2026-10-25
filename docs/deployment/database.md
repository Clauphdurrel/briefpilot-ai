# PostgreSQL Neon Staging — étape 25

## État

Neon staging est connecté et vérifié le 25 octobre 2026 : après autorisation explicite de l’utilisateur, les 6 migrations ont été appliquées, 16 tables sont présentes et Prisma migrate status confirme un historique à jour. Le Prisma Client réel réussit SELECT 1 et les lectures de modèles dans une transaction en lecture seule. Aucun seed n’a été exécuté. Les sauvegardes et fenêtres de restauration du plan n’ont pas été vérifiées ; aucune sauvegarde active n’est revendiquée.

## Cibles et secrets

Development conserve PostgreSQL Docker local et `.env`. Créer un projet Neon staging indépendant, région proche de Vercel (ex. Frankfurt), base `briefpilot_staging`. Ne pas dériver staging d'une branche contenant des données de production. La production sera créée ultérieurement dans une base/projet indépendant.

Le fichier `.env.staging.local` est ignoré par Git et doit être un fichier régulier non symlink, chmod 600. Y définir APP_ENV=staging, NODE_ENV=production, DATABASE_URL poolée et DIRECT_URL directe du même endpoint/base/utilisateur. Ne jamais coller les URL dans le chat ni copier `.env` dans Docker. Le formulaire Neon Connect permet de choisir la connexion poolée (`-pooler` dans le hostname) ou directe. [Guide officiel Neon](https://neon.com/docs/guides/prisma).

Le garde exige un endpoint Neon `.neon.tech`, base exactement `briefpilot_staging`, TLS et paire d'URL cohérente. Le client normalise sslmode=require vers verify-full pour vérifier certificat et hostname ; les paramètres affaiblissant TLS ou chargeant des fichiers locaux sont refusés. Le runtime staging utilise la connexion poolée. Cette vérification ne remplace pas la lecture du projet/branche dans Neon : un nom de base seul ne prouve pas l'origine des données.

## Prisma 7 et pooling

`prisma.config.ts` utilise DIRECT_URL si non vide, sinon DATABASE_URL pour préserver le local. La syntaxe historique directUrl du schéma n'est pas utilisée. `src/lib/prisma.ts` conserve un singleton par processus chaud, y compris en production, et un pool pg borné par DATABASE_POOL_MAX (1..20, défaut 5), connexion 10 s et idle 30 s. Dimensionner le nombre total de connexions en fonction des instances et du plan Neon ; ces limites ne sont pas un plafond distribué. [Connexions Prisma](https://www.prisma.io/docs/postgres/database/connecting-to-your-database).

Les harnesses de test imposent un environnement de test local et le renderer local, puis remplacent **DATABASE_URL et DIRECT_URL** par leur base jetable : une URL directe héritée de l'opérateur ne doit jamais détourner une migration de test vers staging. Le build génère le client sans appliquer de migration ni se connecter à Neon.

## Commandes dédiées

```bash
pnpm db:staging:check
pnpm db:staging:status
pnpm db:staging:deploy
```

check/status lisent seulement `.env.staging.local`, vérifient SELECT 1, current_database(), le socket TLS client (chiffrement et certificat autorisé) et les tables sur les connexions poolée/directe, puis comparent l'historique aux checksums des migrations locales. status exécute aussi Prisma migrate status avec la cible directe explicite ; sa sortie fournisseur n'est pas recopiée pour éviter la fuite d'URL. deploy est **dry-run par défaut**.

Après vérification du projet Neon, revue du plan et autorisation explicite d'application sur la base staging vide :

```bash
pnpm db:staging:deploy --apply --confirm-staging=briefpilot_staging
pnpm db:staging:status
```

L'application utilise Prisma migrate deploy et vérifie le résultat. Le script refuse un historique modifié/échoué/inconnu, des instructions destructives évidentes, un schéma préexistant sans historique et une migration en attente sur une base contenant des données. Ce garde est prévu pour l'initialisation vide de l'étape 25, pas pour toutes les futures migrations. Le détecteur statique ne prouve pas la sûreté de tout SQL : toute nouvelle migration reste à relire. Aucune commande reset/db push/migrate dev n'est offerte. Ne pas contourner un refus avec une commande CLI générique.

## Seed fictif et idempotent

```bash
pnpm db:staging:seed
# Après vérification, seulement si les données fictives sont souhaitées :
pnpm db:staging:seed --apply --confirm-staging=briefpilot_staging
```

Dry-run par défaut, toutes les migrations requises. Deux identifiants réservés sont utilisés pour `staging-demo@example.invalid` et un projet exemple. Un conflit d'identité/ownership est refusé ; aucune donnée existante n'est écrasée. Aucune session, identité Google, clé, mot de passe ou génération IA n'est créée. Ce seed n'offre aucun moyen de se connecter et n'est jamais appelé au build/déploiement.

## Migrations, sauvegarde et diagnostic

Toutes les migrations existantes sont ordonnées et additives à ce stade ; contraintes d'ownership, unicité de versions, quotas, relations et journal IA sont testés sur une base locale neuve. Aucun modèle ni migration n'est modifié par cette configuration.

Dans Neon, vérifier la fenêtre réelle de restauration, les limites du plan, les droits des rôles et l'accès aux sauvegardes ; consigner RPO/RTO et tester la restauration vers une branche indépendante. Les branches et snapshots ne garantissent pas seuls une sauvegarde externalisée. Séparer le rôle d'application de celui des migrations lorsque le provisioning le permettra, puis adapter explicitement le garde de paire actuellement prévu pour les identifiants initiaux du même rôle. Ne pas annoncer une sauvegarde ou restauration testée sans preuve.

En cas d'échec : le script affiche uniquement une erreur générique. Vérifier présence/perms du fichier, région/projet/base, URL poolée/directe, TLS, réveil du compute, droits et historique depuis l'interface sécurisée. Ne pas afficher les erreurs brutes de drivers ou les URLs dans les tickets. Rotation : renouveler les identifiants dans Neon, mettre à jour le stockage privé et l'environnement Preview develop, vérifier l'accès et révoquer l'ancien secret. Voir [rollback](rollback.md).
