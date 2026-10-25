# Étape 25 — préparation Neon, validation distante en attente

État au 25 octobre 2026 : l'utilisateur indique avoir créé le projet Neon. La connexion à ce projet n'est pas encore établie dans les outils et les URLs privées ne sont pas encore disponibles à la validation. **Aucune migration distante n'est appliquée et l'étape 25 n'est pas déclarée terminée.**

## Livré et testé localement

- Prisma 7 : DIRECT_URL pour la CLI, DATABASE_URL poolée pour l'app ; fallback local préservé, aucun changement de modèle/migration.
- Singleton Prisma par processus chaud et pool borné (5 connexions par défaut, paramètres validés).
- Script staging dédié : fichier privé mode 600, paire Neon/direct-pooler cohérente, base briefpilot_staging, TLS avec certificat/hostname vérifiés et comparaison des checksums de migrations. Check et status sont en lecture seule ; deploy/seed sont dry-run par défaut et exigent des arguments explicites d'application.
- Gardes contre cible locale/production incohérente, historique échoué/modifié, schéma inconnu et données déjà présentes avant initialisation. Seed uniquement fictif, idempotent, sans session ni identifiant Google.
- 628 tests unitaires réussis, dont 12 sur la configuration et les migrations ; TypeScript, ESLint, Prisma validate/generate et build réussis.
- 38 tests PostgreSQL et 95 HTTP/navigateur réussis sur une base locale jetable avec une DIRECT_URL externe synthétique volontairement héritée. Le harness l'a remplacée par sa cible locale ; les exemples PDF ont été restaurés.
- Les harnesses imposent également APP_ENV development, renderer local et paramètres worker vides : aucune configuration privée de l'opérateur ne doit exporter des données de test vers un service distant.

Le fichier .env local reste inchangé. .env.staging.local est ignoré et protégé ; aucune valeur sensible n'est incluse dans Git ou ce rapport. Une exécution de check sans ses connexions a correctement échoué avec une erreur générique, sans contacter un fournisseur ni afficher d'URL.

## Vérifications à terminer avec accès Neon

1. Confirmer que le projet/branche et la base briefpilot_staging sont neufs et exclusivement réservés au staging. Le nom initial de branche Neon peut être production dans un projet nouvellement créé ; cela ne remplace pas la vérification du rôle de ce projet.
2. Renseigner les connexions poolée/directe dans le fichier privé ou connecter Neon ici, puis exécuter check et status.
3. Lire le plan de deploy dry-run, vérifier les tables/données et demander l'application explicite avant toute migration distante.
4. Appliquer migrate deploy autorisé, revérifier historique/contraintes et, si souhaité, appliquer le seed fictif explicite.
5. Vérifier le plan, les accès, les quotas et les sauvegardes/restauration dans Neon ; aucune sauvegarde distante n'est revendiquée active.

Voir [database.md](database.md) pour les commandes. Le provisioning et la preuve SELECT 1 distant restent distincts des tests locaux. L'étape 26 ne peut être validée en ligne avant ces résultats.

L'infrastructure précédente a ses six jobs GitHub réussis : [run étape 24](https://github.com/Clauphdurrel/briefpilot-ai/actions/runs/40197078131), SHA aa47874fcbd4af3721af11e3f508ee2f2e05e953 ; PR #4 vers develop. Les PR préparatoires restent à intégrer après revue, sans fusion automatique.
