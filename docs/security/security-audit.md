# Audit sécurité — étape21

Date 2026-10-21. Périmètre : Auth.js, accès objet, API/actions, services IA, quotas/facturation, Prisma, exports et configuration locale. Six spécialités sécurité couvertes : Auth, autorisations, API, IA, billing et infrastructure. Méthode : revue statique, analyse des chemins de données, scénarios locaux avec comptes A/B et tests simulant les fournisseurs. Référentiels : OWASP ASVS5 et API Security Top10 ; revue ciblée, sans certification de conformité exhaustive.

## Conclusions initiales et classification

- DEP-01 — HIGH de préparation : dépendances ayant des avis CRITICAL/HIGH. Versions et advisories pnpm sont une preuve de dépendance affectée, pas d'exploitation de tous ces chemins. Auth utilise Google, pas email ; Vitest n'est pas exposé ; Next ne tourne pas sur Windows. Correctifs ciblés requis.
- OPS-01 — HIGH conditionnel : mot de passe PostgreSQL connu et binding toutes interfaces dans Compose. Aucun scan ni preuve d'exposition actuelle. Correction configuration préventive prioritaire.
- SEC-01 — MEDIUM confirmé : navigation GET intersite vers URL PDF connue peut débiter un quota/consommer Chromium. SameSite=Lax et absence de garde GET. Pas de fuite interutilisateur. Refuser Fetch Metadata hostile/origine externe et tester avant rendu.
- DB-01 — MEDIUM confirmé : nouveaux UUID sur résultat réutilisable créent des registres sans borne. Limiter les créations d'alias sous verrou propriétaire, sans refacturer l'IA.
- WEB-01 — LOW préventif : headers anti-framing/type/référent absents. Aucune exploitation de clic démontrée.
- DB-02 — disponibilité probable : client global appelé depuis transaction backlog ; propager TransactionClient. Ne pas présenter comme vulnérabilité exploitée.

Initial : vulnérabilités applicatives CRITICAL confirmées=0, HIGH exploitables démontrées=0, MEDIUM confirmées=2 ; deux risques de préparation HIGH (dépendances/configuration), une amélioration LOW. Les compteurs d'avis de packages sont consignés séparément. Aucun secret applicatif exposé ni BOLA confirmé dans le code examiné.

## Contrôles vérifiés en lecture

Sessions en base Auth.js, expiration/révocation, cookies HttpOnly/Lax/Secure sousHTTPS ; userId serveur ; documents restreints au projet appartenant au compte ; HMAC brut et nonce de checkout ; état premium jamais déduit d'une URL. Zod, corps JSON bornés, erreurs génériques, SQL paramétré. Quotas atomiques et débit conservateur après dispatch. IA sans outil et données séparées des règles système, contrôle des sources/dépendances. PDF : HTML échappé, CSP restrictive, sandbox active, environnement sans secrets, offline, aucun script/serviceworker ni ressource réseau.

## Limites

Pas de pentest externe, Google réel, compte marchand, comptes Sentry/PostHog ni infrastructure de production. La prompt injection ne peut pas être déclarée impossible ; les sorties restent non fiables et ne sont jamais exécutées. Les quotas et limites de PDF par processus ne remplacent pas un rate limit d'entrée au reverse proxy pour un déploiement multinœud. Backups/alertes réelles doivent être vérifiés dans l'environnement choisi. Décision initiale : bloqué avant production jusqu'aux remédiations et preuves.

## Mise à jour — stabilisation étape 20, 24 octobre 2026

Les correctifs DEP-01, OPS-01, SEC-01, DB-01, WEB-01 et DB-02 sont revus et leurs preuves consignées dans `remediation-plan.md`. La campagne isolée a réussi 32 tests PostgreSQL et 93 tests HTTP/navigateur, dont 8 scénarios de sessions/actions/headers et le refus des trois routes PDF hostiles sans réservation de quota. Les unitaires couvrent aussi la limite d'alias, ses replays et le renouvellement de sa fenêtre. Le dernier audit pnpm ne signale aucun avis, toutes sévérités confondues.

Les risques de préparation bloquants identifiés par cet audit initial sont levés dans le périmètre local. L'étape 21 reste une revue approfondie distincte ; aucune sécurité ou disponibilité de production n'est déduite de cette campagne.
