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


## Audit approfondi étape 21 — constats initiaux du 24 octobre 2026

Référence : b409221. Six missions spécialisées distinctes, toutes en lecture seule avant correctifs : authentification, autorisations, API, IA, facturation et infrastructure. Les conclusions sont consolidées ci-dessous ; les résultats de l'étape 20 ne sont pas présentés comme une nouvelle campagne exécutée.

| ID | Gravité | Nature et preuve initiale | Correction prévue |
|---|---|---|---|
| AUTH-LOG-21 | MEDIUM | Journalisation brute confirmée : Auth.js sans logger spécifique transmet une cause synthétique d'erreur adaptateur aux logs lors de GET session. Aucune fuite de vrai secret démontrée. `src/auth.ts`, logger par défaut du core Auth.js 0.41.3 | Logger complet par liste autorisée, aucune cause/message/stack/metadata, reproduction par le véritable handler |
| ENV-MODE-21 | LOW | Préventif : `.env` local mode 0664, répertoires traversables ; contenu non lu, aucun accès tiers démontré | Mode 0600 et création sécurisée documentée |
| ENV-GIT-21 | LOW | Préventif : `.env.production`, `.env.test` et `.env.staging` non ignorés, aucun de ces fichiers actuellement versionné | `.env.*` et exception explicite pour `.env.example` |
| API-MIME-21 | LOW | Préventif : comparaison par préfixe acceptant `application/jsonp` ; pas de bypass CSRF établi | Type média JSON exact, paramètres charset acceptés |
| BILLING-BODY-21 | LOW | Préventif conditionnel : 512 Ko vérifiés après `response.text()`, donc allocation déjà réalisée ; fournisseur fixe de confiance | Lecture du flux bornée avant concaténation et annulation à dépassement |
| API-TIME-21 | INFORMATIONAL | Risque probable dépendant du runtime : tailles de corps bornées mais attente du flux sans deadline applicative | Deadline de lecture partagée et tests de flux non terminé |

Comptage initial de cette revue : CRITICAL 0, HIGH 0, MEDIUM 1 (journalisation brute confirmée), LOW 4 (préventifs), INFORMATIONAL 1. Aucun BOLA/IDOR, contournement premium, dépassement de quota, injection SQL ou SSRF PDF confirmé. Ces constats ne constituent pas une certification d'absence de vulnérabilités.

Le scan local de 437 blobs texte de l'historique accessible n'identifie, pour les motifs OpenAI/Google OAuth/AWS/clé privée recherchés, que les données synthétiques du test backlog. Les noms de fichiers sensibles versionnés et historiques ne révèlent que `.env.example`. Ce scan par motifs ne peut exclure tous formats de secrets. Les valeurs du fichier `.env` n'ont pas été lues ou envoyées à un outil externe.
