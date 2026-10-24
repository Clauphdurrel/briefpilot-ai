# Audit de préproduction — étapes 20–22

Date : 2026-10-21. Référence initiale : da91ffd. Audit initial effectué en lecture seule avant corrections applicatives. Aucun accès à la production ni test de paiement/OpenAI réel.

## Six domaines examinés

| Spécialité | Périmètre et observations initiales |
|---|---|
| QA | Auth, projets, interview, documents, exports, abonnements ; suites existantes examinées. Manquent runner E2E et garantie de DB isolée. |
| Sécurité | Sessions Prisma, ownership serveur, validation, CSRF, PDF, signature HMAC et liaison checkout ; aucun BOLA constaté. GET PDF accepte une navigation intersite débitant un quota. |
| Backend | Transactions, verrous, historique, idempotence ; nouveaux UUID de réutilisation créent des alias sans borne ; lecture globale depuis transaction backlog. |
| IA | Agents sans outils, store:false, Structured Outputs, validation métier, contexte et tokens bornés, quotas avant dispatch ; pas de contournement établi. |
| Frontend | Loading/empty/error et responsive existants ; erreurs OAuth ignorées et absence de pending login. |
| DevOps | Build Node24, PostgreSQL et sandbox Chromium ; Compose expose 5432 avec secret trivial, absence de runbook et dépendances signalées par audit. |

Les six spécialités ont été couvertes par trois agents aux périmètres complémentaires et le responsable de consolidation. Chaque agent a fourni preuves, limites et recommandations ; aucun problème n'est déduit de la seule existence d'un fichier.

## Constats initiaux consolidés

| ID | Priorité | Preuve / impact | Traitement |
|---|---|---|---|
| DEP-01 | P1 | package.json et audit pnpm : versions Next/Auth/Vitest et transitives signalées ; exposition variable selon chemin exécuté. | Mises à jour ciblées puis audit et régressions. |
| OPS-01 | P1 conditionnel | docker-compose.yml port 5432 toutes interfaces et secret public ; exposition réelle non prouvée. | Loopback et secret injecté, conserver volume. |
| TEST-01 | P1 de validation | Les suites d'intégration lisent DATABASE_URL local par défaut. Pas de garantie dédiée. | Harness base créée pour chaque campagne, sans données réelles. |
| SEC-01 | P2 | GET PDF déclenche travail/quota, SameSite=Lax autorise navigation top-level. | Contrôle Fetch Metadata/origine avant rendu. |
| DB-01 | P2 | brief.service/backlog.service : alias créés lors d'une réutilisation avant limite d'abus. | Borne persistante des nouveaux alias, replay gratuit. |
| DB-02 | P2 risque probable | backlog transaction appelle assertHistoryAccess via client global. | Réutiliser TransactionClient ; test pool réduit. |
| WEB-01 | P2 préventif | next.config.ts sans politique anti-framing globale. | Headers défensifs compatibles Next. |
| UI-01 | P2 | login ignore erreurs OAuth et pending. | Messages allowlist et état de soumission. |
| OPS-02 | P2 | README template, restauration et runtime non documentés. | Runbooks et exigences Chromium/Node. CI distante relève étape23. |
| AI-01 | P3 préventif | Les sources client peuvent contenir des secrets saisis par l'utilisateur. | Documenter minimisation des données, sans promettre détection exhaustive. |

Comptage initial : P0=0 ; P1=3 (incluant deux conditions de préparation/exposition) ; P2=6 ; P3=1. Ce comptage concerne les constats applicatifs consolidés, pas le nombre d'avis transitifs pnpm.

## Décision et preuves

Statut initial : BLOQUÉ avant production. La présence d'avis critiques dans un package ne démontre pas une exploitation dans cette application ; elle requiert traitement ou justification documentée. Les correctifs et résultats effectifs sont suivis dans stabilization-plan.md et test-matrix.md. Google réel, boutique Lemon Squeezy et comptes de monitoring ne sont pas validés à distance.

## Consolidation de l'étape 20 — 24 octobre 2026

La revue et les corrections couvrent les six domaines ci-dessus. La consolidation finale est séquentielle ; elle ne prétend pas à six nouveaux audits indépendants. Les suites complètes ont été rejouées sur le code corrigé, et non déduites de l'existence des fichiers.

| Constat initial | Résolution et preuve |
|---|---|
| DEP-01 | Next/eslint-config-next 16.4.1, Auth beta.32/core corrigé, Vitest 4.1.12, Zod 4.6.7 et overrides transitifs ; audit pnpm final sans avis, build et tests réussis |
| OPS-01 | Compose limité à 127.0.0.1 et secret obligatoire injecté ; procédure pour volume déjà initialisé documentée, aucune suppression |
| TEST-01 | Runners PostgreSQL/intégration/E2E utilisant une base locale aléatoire créée par la campagne, migrations versionnées et nettoyage exclusif |
| SEC-01 | Refus Fetch Metadata/Origin hostile avant génération ; tests routes et test HTTP vérifiant l'absence de débit de quota |
| DB-01 | Nouveaux alias de réutilisation limités par propriétaire et fenêtre ; replay connu conservé, tests concurrence/429/fenêtre suivante |
| DB-02 | TransactionClient propagé jusqu'aux droits d'historique ; vérification réelle sur un pool PostgreSQL à une connexion |
| WEB-01 | En-têtes anti-framing, nosniff, referrer et permissions ; vérification sur pages publiques/privées |
| UI-01 | Messages OAuth fixes et bouton en attente ; tests de non-réflexion de texte arbitraire et parcours de session |
| OPS-02 | README et runbook d'installation, migrations, runtime PDF, sauvegarde/restauration ; CI distante conservée pour l'étape 23 |
| AI-01 | Minimisation des textes client et limites des filtres documentées dans le runbook, sans promesse de détection exhaustive |

Les nouveaux blocages découverts pendant la validation ont aussi été corrigés : identifiant interdit par ESLint, types Sentry incompatibles avec le build, dépendance shadcn requise par le CSS absente et script de purge pointant vers un fichier inexistant. Les fondations d'observabilité déjà présentes restent couvertes par leurs tests unitaires ; l'intégration, la rétention et la validation externe relèvent de l'étape 22.

Le parcours Playwright a également confirmé puis permis de corriger un défaut responsive sur le détail projet : les boutons comprimaient le titre à une largeur illisible sur tablette. Le titre dispose désormais de toute la largeur et les actions reviennent à la ligne. Les fixtures respectent le cooldown serveur de l'interview en simulant le temps écoulé sur le seul registre du compte de test, et l'alerte de quota est distinguée de l'annonceur Next. Les 24 parcours finaux passent sans retry ni scénario ignoré.

Le contrôle de nettoyage a aussi identifié l'arrêt par SIGKILL utilisé par défaut par Playwright : les deux premières campagnes E2E de cette session avaient laissé leurs bases et manifestes. `webServer.gracefulShutdown` impose désormais SIGTERM et laisse dix secondes au runner pour arrêter ses processus et nettoyer sa propre base. Les deux bases ont été supprimées individuellement après vérification de leurs manifestes, de leurs heures correspondant à cette session et de l'absence de connexion active ; aucun nettoyage par préfixe n'est employé.

**Constats initiaux ouverts dans le périmètre étape 20 : P0 = 0, P1 = 0, P2 = 0, P3 = 0.** Ce compteur ne mesure pas les travaux de déploiement ou de validation externe des étapes suivantes. Voir `test-matrix.md` et `step20-final-report.md` pour les résultats réels et la décision finale.
