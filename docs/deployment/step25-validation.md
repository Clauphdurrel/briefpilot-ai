# Étape 25 — Neon staging connecté et migré

Validation le 25 octobre 2026. Le projet Neon a été créé par l'utilisateur, puis ses connexions ont été renseignées dans le fichier privé. Le dry-run a vérifié une base briefpilot_staging vide, TLS avec certificat/hostname autorisés et six migrations additives. L'utilisateur a explicitement autorisé l'application des six migrations.

**Résultat distant : 6 migrations appliquées, 0 en attente, 16 tables présentes, Prisma migrate status up-to-date.** SELECT 1 fonctionne sur les connexions poolée et directe. Un test opt-in du vrai Prisma Client réussit SELECT 1 et des lectures User/Project/Session/AIUsageLog dans une transaction READ ONLY. Aucun seed, session, paiement ou appel IA n'a été créé.

## Livré et testé localement

- Prisma 7 : DIRECT_URL pour la CLI, DATABASE_URL poolée pour l'app ; fallback local préservé, aucun changement de modèle/migration.
- Singleton Prisma par processus chaud et pool borné (5 connexions par défaut, paramètres validés).
- Script staging dédié : fichier privé mode 600, paire Neon/direct-pooler cohérente, base briefpilot_staging, TLS avec certificat/hostname vérifiés et comparaison des checksums de migrations. Check et status sont en lecture seule ; deploy/seed sont dry-run par défaut et exigent des arguments explicites d'application.
- Gardes contre cible locale/production incohérente, historique échoué/modifié, schéma inconnu et données déjà présentes avant initialisation. Seed uniquement fictif, idempotent, sans session ni identifiant Google.
- 628 tests unitaires réussis, dont 12 sur la configuration et les migrations ; TypeScript, ESLint, Prisma validate/generate et build réussis.
- 38 tests PostgreSQL et 95 HTTP/navigateur réussis sur une base locale jetable avec une DIRECT_URL externe synthétique volontairement héritée. Le harness l'a remplacée par sa cible locale ; les exemples PDF ont été restaurés.
- Les harnesses imposent également APP_ENV development, renderer local et paramètres worker vides : aucune configuration privée de l'opérateur ne doit exporter des données de test vers un service distant.

Le fichier .env local reste inchangé. .env.staging.local est ignoré et protégé ; aucune valeur sensible n'est incluse dans Git ou ce rapport. Le check sans connexions a d’abord échoué proprement avec une erreur générique ; après leur fourniture, les vérifications distantes décrites ci-dessous ont réussi. Aucune URL n’est affichée.

## Commandes distantes réellement exécutées

- staging-database.mjs check/status : lecture seule, TLS client vérifié, tables initiales 0, migrations en attente 6.
- staging-database.mjs deploy sans arguments : dry-run, aucune modification.
- Après le « Oui, appliquer les 6 migrations staging » de l'utilisateur : deploy --apply --confirm-staging=briefpilot_staging, puis status. Application réussie, historique à jour et 16 tables.
- NEON_READONLY_CHECK=1 Vitest sur neon.readonly.test.ts : 1 test réussi avec le Prisma Client du projet et la connexion poolée. Aucune fixture distante ni nettoyage destructif.

La lecture directe du TypeScript généré avec Node seul n'est pas adaptée à ses imports sans extension ; le test utilise le runner TypeScript du projet, comme l'application et les suites existantes. Aucun fichier généré n'est modifié pour contourner ce point.

## Restant avant production

Les sauvegardes, limites du plan, permissions du compte, RPO/RTO et restauration sur branche séparée restent à vérifier dans Neon. Aucun backup ou exercice de restauration n'est annoncé comme effectué. Le seed est disponible mais n'a pas été lancé. Les identifiants restent privés et le développement local n'est pas remplacé par Neon.

L'étape 25 est validée dans son périmètre staging. L'étape 26 exige encore le projet Vercel, le worker HTTPS distant et les vrais parcours utilisateurs en ligne ; une migration réussie n'est pas un déploiement.

L'infrastructure précédente a ses six jobs GitHub réussis : [run étape 24](https://github.com/Clauphdurrel/briefpilot-ai/actions/runs/40197078131), SHA aa47874fcbd4af3721af11e3f508ee2f2e05e953 ; PR #4 vers develop. Les PR préparatoires restent à intégrer après revue, sans fusion automatique.
